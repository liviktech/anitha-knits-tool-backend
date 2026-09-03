/**
 * Formats a Date as 'yyyy-MM-dd' using LOCAL getters, not UTC ones.
 *
 * node-postgres (via the `postgres-date` package) parses a `DATE` column back
 * into a JS Date at LOCAL midnight (e.g. `new Date(2026, 7, 25)`), not UTC
 * midnight. Calling `.toISOString()` on that value — directly, via
 * `JSON.stringify`/`res.json()`, or via `.slice(0, 10)` — converts it to UTC
 * first, which rolls the date back to the previous day on any server whose
 * local timezone is ahead of UTC (e.g. IST, UTC+5:30). Always use this
 * instead whenever a `DATE` column's value crosses a serialization boundary.
 */
export function formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
