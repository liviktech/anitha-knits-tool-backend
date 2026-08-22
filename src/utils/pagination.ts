import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

/**
 * A boolean query-string param ("true"/"false"). Use this instead of
 * z.coerce.boolean() for query params — z.coerce.boolean() calls JS's
 * Boolean(value), so the literal string "false" (a truthy, non-empty string)
 * incorrectly coerces to `true`.
 */
export const booleanQueryParam = z.enum(['true', 'false']).transform((value) => value === 'true');

export type Pagination = z.infer<typeof paginationSchema>;

export function toSkipTake(pagination: Pagination): { skip: number; take: number } {
    return { skip: (pagination.page - 1) * pagination.limit, take: pagination.limit };
}

export function toPageMeta(pagination: Pagination, total: number) {
    return {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
}
