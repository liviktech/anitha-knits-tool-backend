const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;

const UNIT_TO_MS: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
};

/** Converts a short duration string (e.g. '15m', '7d') to milliseconds. Time: O(1); Space: O(1). */
export function parseDurationMs(duration: string): number {
    const match = DURATION_PATTERN.exec(duration);
    if (!match) {
        throw new Error(`Invalid duration "${duration}"; expected formats like 15m, 1h, 7d, 30s, 500ms`);
    }
    return Number(match[1]) * UNIT_TO_MS[match[2]];
}
