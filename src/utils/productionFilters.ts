import type { ProductionStage } from '../types/enums.js';

export type ProductionListFilters = {
    date_from?: Date;
    date_to?: Date;
    color_id?: string;
    size?: string;
    type?: 'PRODUCTION' | 'SAMPLE';
};

export interface ProductionWhereClause {
    /** SQL conditions (no leading "WHERE"), referencing unqualified column names — prefix with a table alias yourself if the caller's query needs one. */
    conditions: string[];
    values: unknown[];
}

/** Builds the common ProductionRecord WHERE conditions shared by every stage's list endpoint (PRD §17). */
export function buildProductionWhere(stage: ProductionStage, filters: ProductionListFilters, companyId: string): ProductionWhereClause {
    const conditions: string[] = [];
    const values: unknown[] = [];

    values.push(companyId);
    conditions.push(`company_id = $${values.length}`);
    values.push(stage);
    conditions.push(`stage = $${values.length}`);
    if (filters.color_id) {
        values.push(filters.color_id);
        conditions.push(`color_id = $${values.length}`);
    }
    if (filters.size) {
        values.push(filters.size);
        conditions.push(`size_id = $${values.length}`);
    }
    if (filters.type) {
        values.push(filters.type);
        conditions.push(`type = $${values.length}`);
    }
    if (filters.date_from) {
        values.push(filters.date_from);
        conditions.push(`production_date >= $${values.length}`);
    }
    if (filters.date_to) {
        values.push(filters.date_to);
        conditions.push(`production_date <= $${values.length}`);
    }

    return { conditions, values };
}
