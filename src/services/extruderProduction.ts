import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type {
    CreateExtruderProductionInput,
    ListExtruderProductionQuery,
    UpdateExtruderProductionInput,
} from '../validators/extruderProduction.js';

const include = {
    color: true,
    size: true,
    rawProduct: { include: { brand: true } },
    waste: true,
    chemical: { include: { chemical: true } },
} satisfies Prisma.ExtruderProcessInclude;

type ExtruderProcessWithRelations = Prisma.ExtruderProcessGetPayload<{ include: typeof include }>;

function toNumber(value: Prisma.Decimal): number {
    return value.toNumber();
}

function toDto(process: ExtruderProcessWithRelations) {
    return {
        id: process.id,
        productionDate: process.productionDate,
        size: { id: process.size.id, name: process.size.name },
        color: { id: process.color.id, name: process.color.name },
        colorWeightKg: toNumber(process.colorWeightKg),
        totalWeightKg: toNumber(process.totalWeightKg),
        loomsWeightKg: toNumber(process.loomsWeightKg),
        rawProduct: process.rawProduct
            ? {
                  brand: { id: process.rawProduct.brand.id, name: process.rawProduct.brand.name },
                  bagCount: process.rawProduct.bagCount,
                  weightKg: toNumber(process.rawProduct.weightKg),
              }
            : null,
        waste: process.waste
            ? {
                  looseWasteKg: toNumber(process.waste.looseWasteKg),
                  lumsWasteKg: toNumber(process.waste.lumsWasteKg),
              }
            : null,
        chemical: process.chemical
            ? {
                  chemical: { id: process.chemical.chemical.id, name: process.chemical.chemical.name },
                  weightKg: toNumber(process.chemical.weightKg),
              }
            : null,
        createdAt: process.createdAt,
        createdBy: process.createdBy,
        updatedAt: process.updatedAt,
        updatedBy: process.updatedBy,
    };
}

/**
 * totalWeightKg is the gross output (raw material + waste captured during extrusion).
 * loomsWeightKg is what's actually forwarded to the loom stage, i.e. total minus waste.
 */
function deriveWeights(rawWeightKg: number, looseWasteKg: number, lumsWasteKg: number) {
    const totalWeightKg = new Prisma.Decimal(rawWeightKg).add(looseWasteKg).add(lumsWasteKg);
    const loomsWeightKg = totalWeightKg.sub(looseWasteKg).sub(lumsWasteKg);
    return { totalWeightKg, loomsWeightKg };
}

export async function createExtruderProduction(input: CreateExtruderProductionInput) {
    const { totalWeightKg, loomsWeightKg } = deriveWeights(
        input.rawProduct.weightKg,
        input.waste.looseWasteKg,
        input.waste.lumsWasteKg,
    );

    const created = await prisma.extruderProcess.create({
        data: {
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            colorWeightKg: input.colorWeightKg,
            totalWeightKg,
            loomsWeightKg,
            createdBy: input.createdBy,
            rawProduct: {
                create: {
                    brandId: input.rawProduct.brandId,
                    bagCount: input.rawProduct.bagCount,
                    weightKg: input.rawProduct.weightKg,
                    createdBy: input.createdBy,
                },
            },
            waste: {
                create: {
                    looseWasteKg: input.waste.looseWasteKg,
                    lumsWasteKg: input.waste.lumsWasteKg,
                    createdBy: input.createdBy,
                },
            },
            ...(input.chemical
                ? {
                      chemical: {
                          create: {
                              chemicalId: input.chemical.chemicalId,
                              weightKg: input.chemical.weightKg,
                              createdBy: input.createdBy,
                          },
                      },
                  }
                : {}),
        },
        include,
    });

    return toDto(created);
}

export async function listExtruderProductions(query: ListExtruderProductionQuery) {
    const where: Prisma.ExtruderProcessWhereInput = {
        ...(query.productionDate ? { productionDate: query.productionDate } : {}),
        ...(query.sizeId ? { sizeId: query.sizeId } : {}),
        ...(query.colorId ? { colorId: query.colorId } : {}),
    };

    const [items, total] = await prisma.$transaction([
        prisma.extruderProcess.findMany({
            where,
            include,
            orderBy: [{ productionDate: 'desc' }, { createdAt: 'desc' }],
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma.extruderProcess.count({ where }),
    ]);

    return {
        items: items.map(toDto),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
    };
}

export async function getExtruderProductionById(id: string) {
    const process = await prisma.extruderProcess.findUnique({ where: { id }, include });
    if (!process) {
        throw new ApiError(404, `Extruder production ${id} not found`);
    }
    return toDto(process);
}

export async function updateExtruderProduction(id: string, input: UpdateExtruderProductionInput) {
    return prisma.$transaction(async (tx) => {
        const existing = await tx.extruderProcess.findUnique({
            where: { id },
            include: { rawProduct: true, waste: true, chemical: true },
        });
        if (!existing) {
            throw new ApiError(404, `Extruder production ${id} not found`);
        }

        const rawWeightKg = input.rawProduct?.weightKg ?? existing.rawProduct?.weightKg.toNumber() ?? 0;
        const looseWasteKg = input.waste?.looseWasteKg ?? existing.waste?.looseWasteKg.toNumber() ?? 0;
        const lumsWasteKg = input.waste?.lumsWasteKg ?? existing.waste?.lumsWasteKg.toNumber() ?? 0;
        const { totalWeightKg, loomsWeightKg } = deriveWeights(rawWeightKg, looseWasteKg, lumsWasteKg);

        const updated = await tx.extruderProcess.update({
            where: { id },
            data: {
                ...(input.productionDate ? { productionDate: input.productionDate } : {}),
                ...(input.colorId ? { colorId: input.colorId } : {}),
                ...(input.sizeId ? { sizeId: input.sizeId } : {}),
                ...(input.colorWeightKg !== undefined ? { colorWeightKg: input.colorWeightKg } : {}),
                totalWeightKg,
                loomsWeightKg,
                updatedBy: input.updatedBy,
                ...(input.rawProduct
                    ? {
                          rawProduct: existing.rawProduct
                              ? { update: { ...input.rawProduct, updatedBy: input.updatedBy } }
                              : { create: { ...input.rawProduct, createdBy: input.updatedBy } },
                      }
                    : {}),
                ...(input.waste
                    ? {
                          waste: existing.waste
                              ? { update: { ...input.waste, updatedBy: input.updatedBy } }
                              : { create: { ...input.waste, createdBy: input.updatedBy } },
                      }
                    : {}),
                ...(input.chemical === null
                    ? existing.chemical
                        ? { chemical: { delete: true } }
                        : {}
                    : input.chemical
                      ? {
                            chemical: {
                                upsert: {
                                    create: { ...input.chemical, createdBy: input.updatedBy },
                                    update: { ...input.chemical, updatedBy: input.updatedBy },
                                },
                            },
                        }
                      : {}),
            },
            include,
        });

        return toDto(updated);
    });
}

export async function deleteExtruderProduction(id: string): Promise<void> {
    try {
        await prisma.extruderProcess.delete({ where: { id } });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new ApiError(404, `Extruder production ${id} not found`);
        }
        throw err;
    }
}
