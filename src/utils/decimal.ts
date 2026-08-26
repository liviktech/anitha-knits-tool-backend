/** Rounds a kg quantity to the schema's Decimal(_, 3) precision (3 decimal places). */
export function roundKg(value: number): number {
    return Math.round(value * 1000) / 1000;
}
