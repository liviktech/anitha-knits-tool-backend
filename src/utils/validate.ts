import type { z } from 'zod';
import { ValidationError } from './errors.js';

/** Parses `data` against `schema`, or throws a ValidationError with flattened zod issues. */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new ValidationError('Request failed validation', 'VALIDATION_ERROR', result.error.flatten());
    }
    return result.data;
}
