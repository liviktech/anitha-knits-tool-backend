/**
 * Stable WastageType codes, matching scripts/seed.ts §6 exactly. Branch on
 * these, not on the human-readable `name` (which operators may rename).
 */
export const WASTAGE_CODES = {
    YARN_WASTE: 'YARN_WASTE',
    LUMPS: 'LUMPS',
    LOOMS_WASTE: 'LOOMS_WASTE',
    FW: 'FW',
    BW: 'BW',
} as const;
