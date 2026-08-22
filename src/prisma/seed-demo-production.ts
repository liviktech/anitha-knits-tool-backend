/**
 * prisma/seed-demo-production.ts — Backfills demo production data (Extruder,
 * Looms, Fabric Checking, Load Sent, Inventory) for one company across a date
 * range, so dashboards/reports/Postman testing have realistic data to work
 * against.
 *
 * Goes through the real service functions (createExtruderProduction, etc.),
 * not raw prisma.create — so wastage-type lookups, recipe-standard colour
 * consumption, and every other business rule those services enforce still
 * apply here exactly as they would through the API.
 *
 * Requires master data (brands/chemicals/colors/sizes/wastage types) to
 * already exist for the company — run `prisma/seed.ts` first.
 *
 * Extruder entries are auto-approved after creation (the only stage with an
 * approve endpoint today). Looms/Fabric Checking stay PENDING_APPROVAL —
 * there is no approve/reject service for those stages yet. Inventory/Load
 * Sent have no approval concept at all.
 *
 * Not idempotent — re-running adds MORE records, it does not upsert/dedupe.
 *
 *   SEED_COMPANY_ID=<company.id> npx tsx --env-file=.env src/prisma/seed-demo-production.ts
 *
 * Optional env overrides: SEED_FROM / SEED_TO (YYYY-MM-DD, both inclusive;
 * default to June 1st of the current year and today), SEED_ENTRIES_PER_DAY
 * (default 2, applied per module per day).
 */

import { InventoryType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { createExtruderProduction, approveExtruderProduction } from '../services/extruderService.js';
import { createLoomsProduction } from '../services/loomsService.js';
import { createFabricCheckingRecord } from '../services/fabricCheckingService.js';
import { createLoadSent } from '../services/loadSentService.js';
import { createInventory } from '../services/inventoryService.js';

const SYSTEM = 'system:seed-demo';

const companyId: string = process.env.SEED_COMPANY_ID ?? (() => {
    throw new Error(
        'SEED_COMPANY_ID is required — sign up/find a company first, then run: SEED_COMPANY_ID=<company.id> npx tsx --env-file=.env src/prisma/seed-demo-production.ts',
    );
})();

const ENTRIES_PER_DAY = process.env.SEED_ENTRIES_PER_DAY ? Number(process.env.SEED_ENTRIES_PER_DAY) : 2;

function currentYearJuneFirst(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), 5, 1));
}

const startDate = process.env.SEED_FROM ? new Date(`${process.env.SEED_FROM}T00:00:00.000Z`) : currentYearJuneFirst();
const endDate = process.env.SEED_TO ? new Date(`${process.env.SEED_TO}T00:00:00.000Z`) : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');

function eachDate(from: Date, to: Date): Date[] {
    const days: Date[] = [];
    for (let d = new Date(from); d.getTime() <= to.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(new Date(d));
    }
    return days;
}

function randomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)]!;
}

function randomFloat(min: number, max: number, decimals = 2): number {
    return Number((min + Math.random() * (max - min)).toFixed(decimals));
}

function randomInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
}

/** ~30% of entries get a small non-zero wastage figure; the rest omit it entirely. */
function maybeWastage(min: number, max: number): number | undefined {
    return Math.random() < 0.3 ? randomFloat(min, max) : undefined;
}

async function main() {
    const [colors, sizes, brands, chemicals] = await Promise.all([
        prisma.color.findMany({ where: { companyId }, select: { id: true, name: true } }),
        prisma.size.findMany({ where: { companyId }, select: { id: true } }),
        prisma.brand.findMany({ where: { companyId }, select: { id: true, name: true } }),
        prisma.chemical.findMany({ where: { companyId }, select: { id: true, name: true } }),
    ]);

    if (colors.length === 0 || sizes.length === 0 || brands.length === 0 || chemicals.length === 0) {
        throw new Error('Missing master data (colors/sizes/brands/chemicals) for this company — run prisma/seed.ts first.');
    }

    const days = eachDate(startDate, endDate);
    console.log(
        `Seeding ${ENTRIES_PER_DAY} entries/day x 5 modules across ${days.length} days ` +
        `(${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}) for company ${companyId}...`,
    );

    let created = 0;

    for (const day of days) {
        const dayTasks: Promise<unknown>[] = [];

        for (let i = 0; i < ENTRIES_PER_DAY; i++) {
            const color = randomItem(colors);
            const size = randomItem(sizes);
            const rawMaterialKg = randomFloat(20, 30);

            dayTasks.push(
                createExtruderProduction(
                    {
                        productionDate: day,
                        colorId: color.id,
                        sizeId: size.id,
                        brandId: randomItem(brands).id,
                        chemicalId: randomItem(chemicals).id,
                        rawMaterialKg,
                        chemicalKg: randomFloat(0.4, 0.8),
                        yarnOutputKg: randomFloat(rawMaterialKg * 0.95, rawMaterialKg * 1.02),
                        yarnWasteKg: maybeWastage(0.05, 0.3),
                        lumpsKg: maybeWastage(0.05, 0.2),
                    },
                    companyId,
                    SYSTEM,
                ).then((record) => approveExtruderProduction(record.id, companyId, SYSTEM, undefined)),
            );

            const yarnInputKg = randomFloat(18, 28);
            dayTasks.push(
                createLoomsProduction(
                    {
                        productionDate: day,
                        colorId: color.id,
                        sizeId: size.id,
                        yarnInputKg,
                        fabricOutputKg: randomFloat(yarnInputKg * 0.9, yarnInputKg * 0.97),
                        loomsWasteKg: maybeWastage(0.05, 0.3),
                    },
                    companyId,
                    SYSTEM,
                ),
            );

            const fabricInputKg = randomFloat(15, 25);
            dayTasks.push(
                createFabricCheckingRecord(
                    {
                        productionDate: day,
                        colorId: color.id,
                        sizeId: size.id,
                        fabricInputKg,
                        pieceCount: randomInt(8, 25),
                        firstGradeKg: randomFloat(fabricInputKg * 0.85, fabricInputKg * 0.93),
                        secondGradeKg: randomFloat(fabricInputKg * 0.03, fabricInputKg * 0.08),
                        fwKg: maybeWastage(0.02, 0.2),
                        bwKg: maybeWastage(0.02, 0.2),
                    },
                    companyId,
                    SYSTEM,
                ),
            );

            dayTasks.push(
                createLoadSent(
                    {
                        date: day,
                        colorId: color.id,
                        sizeId: size.id,
                        pieceCount: randomInt(8, 25),
                        weightKg: randomFloat(15, 25),
                    },
                    companyId,
                    SYSTEM,
                ),
            );

            const invType = randomItem([InventoryType.RAW_MATERIAL, InventoryType.CHEMICAL, InventoryType.COLOR]);
            const invName =
                invType === InventoryType.RAW_MATERIAL
                    ? randomItem(brands).name
                    : invType === InventoryType.CHEMICAL
                      ? randomItem(chemicals).name
                      : color.name;
            dayTasks.push(
                createInventory(
                    { date: day, type: invType, name: invName, weightKg: randomFloat(100, 500) },
                    companyId,
                    SYSTEM,
                ),
            );
        }

        await Promise.all(dayTasks);
        created += dayTasks.length;
        console.log(`  ${day.toISOString().slice(0, 10)} done (${created} records so far)`);
    }

    console.log(`Seed complete: ${created} records created across ${days.length} days.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
