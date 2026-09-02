import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const listLivikEmployeesQuerySchema = paginationSchema
    .extend({
        search: z.string().trim().max(150).optional(),
    })
    .strict();

export type ListLivikEmployeesQuery = z.infer<typeof listLivikEmployeesQuerySchema>;
