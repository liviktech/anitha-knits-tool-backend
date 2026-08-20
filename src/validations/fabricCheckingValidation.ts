import { z } from 'zod';
import { ProductionStatus } from '@prisma/client';
import { paginationSchema } from '../utils/pagination.js';

export const fabricCheckingIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

const wastageKg = z.coerce.number().nonnegative('must not be negative').optional();

export const createFabricCheckingSchema = z
    .object({
        productionDate: z.coerce.date(),
        colorId: z.string().uuid(),
        sizeId: z.string().uuid(),
        fabricInputKg: z.coerce.number().positive('must be a positive number'),
        pieceCount: z.coerce.number().int().positive('must be a positive integer'),
        firstGradeKg: z.coerce.number().nonnegative(),
        secondGradeKg: z.coerce.number().nonnegative(),
        remarks: z.string().trim().max(500).optional(),
        // Wastage entered alongside this record (PRD §9/§10): optional, and
        // only turns into a WastageRecord when > 0 — see wastageService.ts.
        // BW ("Bit Wastage") is colour-tracked (PRD "B White"/"B Blue"), so it
        // is stored against this record's own colorId; FW is not.
        fwKg: wastageKg,
        bwKg: wastageKg,
    })
    .strict();

export const listFabricCheckingQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        color_id: z.string().uuid().optional(),
        size: z.string().uuid().optional(),
        status: z.nativeEnum(ProductionStatus).optional(),
    })
    .strict();

export type CreateFabricCheckingInput = z.infer<typeof createFabricCheckingSchema>;
export type ListFabricCheckingQuery = z.infer<typeof listFabricCheckingQuerySchema>;
