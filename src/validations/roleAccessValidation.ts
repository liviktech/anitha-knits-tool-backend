import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const roleAccessIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createRoleAccessSchema = z
    .object({
        roleName: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
        rightIds: z.array(z.string().uuid()).default([]),
        effectiveDate: z.string().date().optional(),
    })
    .strict();

export const updateRoleAccessSchema = z
    .object({
        roleName: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).nullable(),
        rightIds: z.array(z.string().uuid()),
        effectiveDate: z.string().date().optional(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listRoleAccessQuerySchema = paginationSchema
    .extend({
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export const assignRoleAccessSchema = z
    .object({
        employeeIds: z.array(z.string().uuid()).min(1, 'At least one employee must be selected'),
    })
    .strict();

export type CreateRoleAccessInput = z.infer<typeof createRoleAccessSchema>;
export type UpdateRoleAccessInput = z.infer<typeof updateRoleAccessSchema>;
export type ListRoleAccessQuery = z.infer<typeof listRoleAccessQuerySchema>;
export type AssignRoleAccessInput = z.infer<typeof assignRoleAccessSchema>;
