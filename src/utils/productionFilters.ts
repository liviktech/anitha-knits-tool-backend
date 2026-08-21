import type { Prisma, ProductionStage, ProductionStatus } from '@prisma/client';

export type ProductionListFilters = {
    date_from?: Date;
    date_to?: Date;
    color_id?: string;
    size?: string;
    status?: ProductionStatus;
};

/** Builds the common ProductionRecord `where` clause shared by every stage's list endpoint (PRD §17). */
export function buildProductionWhere(
    stage: ProductionStage,
    filters: ProductionListFilters,
    companyId: string,
): Prisma.ProductionRecordWhereInput {
    return {
        companyId,
        stage,
        ...(filters.color_id ? { colorId: filters.color_id } : {}),
        ...(filters.size ? { sizeId: filters.size } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.date_from || filters.date_to
            ? {
                  productionDate: {
                      ...(filters.date_from ? { gte: filters.date_from } : {}),
                      ...(filters.date_to ? { lte: filters.date_to } : {}),
                  },
              }
            : {}),
    };
}
