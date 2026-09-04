import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const koraLedgerParamsSchema = z
    .object({
        colorId: z.string().uuid('colorId must be a valid UUID'),
        sizeId: z.string().uuid('sizeId must be a valid UUID'),
    })
    .strict();

export const listKoraLedgerQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
    })
    .strict();

export type ListKoraLedgerQuery = z.infer<typeof listKoraLedgerQuerySchema>;

export const koraBalanceExcludingRecordParamsSchema = z
    .object({
        colorId: z.string().uuid('colorId must be a valid UUID'),
        sizeId: z.string().uuid('sizeId must be a valid UUID'),
        recordId: z.string().uuid('recordId must be a valid UUID'),
    })
    .strict();
