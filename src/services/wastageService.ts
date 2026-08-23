import { Prisma, ProductionStage } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * Wastage entered alongside a production record (PRD §9/§26: "Wastage must be
 * linked to a production record whenever applicable"). The dedicated Wastage
 * API (list/get/edit, PRD §16.6) isn't built yet, so this is the only way
 * wastage gets into WastageRecord today — created in the same nested write as
 * the production record, so it's atomic with it and always has a
 * productionRecordId.
 */

export const wastageSelect = {
    id: true,
    wastageType: { select: { id: true, code: true, name: true } },
    color: { select: { id: true, name: true } },
    quantityKg: true,
} satisfies Prisma.WastageRecordSelect;

type WastageRow = Prisma.WastageRecordGetPayload<{ select: typeof wastageSelect }>;

export function mapWastageRecord(row: WastageRow) {
    return {
        id: row.id,
        wastageType: row.wastageType,
        color: row.color,
        quantityKg: row.quantityKg.toNumber(),
    };
}

export type WastageEntryInput = {
    code: string;
    quantityKg: number | undefined;
    /** Only meaningful for colour-tracked types (e.g. BW / "B White", "B Blue"). */
    colorId?: string;
};

/**
 * Resolves (code, quantity) pairs into Prisma nested-create inputs for
 * WastageRecord, looking up each WastageType's id by (stage, code). Entries
 * with an undefined or non-positive quantity are skipped entirely — a
 * WastageRecord is only created when a real positive quantity was supplied,
 * so "no wastage of this type" never produces a zero-quantity row.
 *
 * Time: O(k) — k = number of wastage entries for the stage (at most 2 today).
 */
export async function buildWastageCreates(
    stage: ProductionStage,
    companyId: string,
    actor: string,
    entries: WastageEntryInput[],
): Promise<Prisma.WastageRecordCreateWithoutProductionRecordInput[]> {
    const withQuantity = entries.filter(
        (entry): entry is WastageEntryInput & { quantityKg: number } => typeof entry.quantityKg === 'number' && entry.quantityKg > 0,
    );
    if (withQuantity.length === 0) return [];

    const types = await Promise.all(
        withQuantity.map((entry) =>
            prisma.wastageType.findUnique({
                where: { companyId_stage_code: { companyId, stage, code: entry.code } },
                select: { id: true, isActive: true },
            }),
        ),
    );

    return withQuantity.map((entry, index) => {
        const type = types[index];
        if (!type || !type.isActive) {
            throw new NotFoundError(
                `Wastage type "${entry.code}" is not configured for stage ${stage}`,
                'WASTAGE_TYPE_NOT_FOUND',
                { stage, code: entry.code },
            );
        }
        return {
            company: { connect: { id: companyId } },
            wastageType: { connect: { id: type.id } },
            color: entry.colorId ? { connect: { id: entry.colorId } } : undefined,
            quantityKg: entry.quantityKg,
            createdBy: actor,
        };
    });
}
