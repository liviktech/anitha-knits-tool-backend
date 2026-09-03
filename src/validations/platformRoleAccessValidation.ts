import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const platformRoleAccessIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createPlatformRoleAccessSchema = z
    .object({
        roleName: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
        rightIds: z.array(z.string().uuid()).default([]),
        // Accepted for parity with the form, not persisted — same convention as the
        // company-side createRoleAccessSchema (see roleAccessValidation.ts).
        effectiveDate: z.string().date().optional(),
    })
    .strict();

export const updatePlatformRoleAccessSchema = z
    .object({
        roleName: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).nullable(),
        rightIds: z.array(z.string().uuid()),
        effectiveDate: z.string().date().optional(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listPlatformRoleAccessQuerySchema = paginationSchema
    .extend({
        name: z.string().trim().min(1).optional(),
    })
    .strict();

// livikEmpIds — not employee UUIDs, since Livik employees aren't rows in this database (see
// PlatformEmployeeAccess.livikEmpId on the schema).
export const assignPlatformRoleAccessSchema = z
    .object({
        livikEmpIds: z.array(z.string().trim().min(1)).min(1, 'At least one employee must be selected'),
    })
    .strict();

export type CreatePlatformRoleAccessInput = z.infer<typeof createPlatformRoleAccessSchema>;
export type UpdatePlatformRoleAccessInput = z.infer<typeof updatePlatformRoleAccessSchema>;
export type ListPlatformRoleAccessQuery = z.infer<typeof listPlatformRoleAccessQuerySchema>;
export type AssignPlatformRoleAccessInput = z.infer<typeof assignPlatformRoleAccessSchema>;
