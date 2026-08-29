import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreateModuleInput, UpdateModuleInput, ListModuleQuery } from '../validations/moduleValidation.js';

const moduleSelect = {
    id: true,
    moduleCode: true,
    moduleName: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.ModuleSelect;

/** Maps a unique-constraint violation on [companyId, moduleCode] to a stable conflict error. */
function mapModuleCodeConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A module with this code already exists', 'MODULE_CODE_EXISTS');
}

export async function createModule(input: CreateModuleInput, companyId: string) {
    try {
        return await prisma.module.create({
            data: { companyId, moduleCode: input.moduleCode, moduleName: input.moduleName },
            select: moduleSelect,
        });
    } catch (err) {
        mapModuleCodeConflict(err);
        throw err;
    }
}

export async function listModules(query: ListModuleQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.ModuleWhereInput = {
        companyId,
        ...(query.name ? { moduleName: { contains: query.name, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.module.findMany({ where, select: moduleSelect, orderBy: { moduleName: 'asc' }, skip, take }),
        prisma.module.count({ where }),
    ]);

    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getModuleById(id: string, companyId: string) {
    const record = await prisma.module.findFirst({ where: { id, companyId }, select: moduleSelect });
    if (!record) throw new NotFoundError('Module not found', 'MODULE_NOT_FOUND', { id });
    return record;
}

export async function updateModule(id: string, input: UpdateModuleInput, companyId: string) {
    const existing = await prisma.module.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Module not found', 'MODULE_NOT_FOUND', { id });

    try {
        return await prisma.module.update({
            where: { id },
            data: {
                ...(input.moduleCode !== undefined ? { moduleCode: input.moduleCode } : {}),
                ...(input.moduleName !== undefined ? { moduleName: input.moduleName } : {}),
            },
            select: moduleSelect,
        });
    } catch (err) {
        mapModuleCodeConflict(err);
        throw err;
    }
}

export async function deleteModule(id: string, companyId: string) {
    const existing = await prisma.module.findFirst({
        where: { id, companyId },
        select: { id: true, _count: { select: { tabs: true } } },
    });
    if (!existing) throw new NotFoundError('Module not found', 'MODULE_NOT_FOUND', { id });
    if (existing._count.tabs > 0) {
        throw new ConflictError(
            `Cannot delete module: it still has ${existing._count.tabs} tab(s). Remove them first.`,
            'MODULE_HAS_TABS',
        );
    }

    await prisma.module.delete({ where: { id } });
}
