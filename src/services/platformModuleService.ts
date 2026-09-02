import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type {
    CreatePlatformModuleInput,
    UpdatePlatformModuleInput,
    ListPlatformModuleQuery,
} from '../validations/platformModuleValidation.js';

const platformModuleSelect = {
    id: true,
    moduleCode: true,
    moduleName: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.PlatformModuleSelect;

/** Maps a unique-constraint violation on moduleCode to a stable conflict error. */
function mapModuleCodeConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A module with this code already exists', 'PLATFORM_MODULE_CODE_EXISTS');
}

export async function createPlatformModule(input: CreatePlatformModuleInput) {
    try {
        return await prisma.platformModule.create({
            data: { moduleCode: input.moduleCode, moduleName: input.moduleName },
            select: platformModuleSelect,
        });
    } catch (err) {
        mapModuleCodeConflict(err);
        throw err;
    }
}

export async function listPlatformModules(query: ListPlatformModuleQuery) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.PlatformModuleWhereInput = {
        ...(query.name ? { moduleName: { contains: query.name, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.platformModule.findMany({ where, select: platformModuleSelect, orderBy: { moduleName: 'asc' }, skip, take }),
        prisma.platformModule.count({ where }),
    ]);

    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getPlatformModuleById(id: string) {
    const record = await prisma.platformModule.findUnique({ where: { id }, select: platformModuleSelect });
    if (!record) throw new NotFoundError('Module not found', 'PLATFORM_MODULE_NOT_FOUND', { id });
    return record;
}

export async function updatePlatformModule(id: string, input: UpdatePlatformModuleInput) {
    const existing = await prisma.platformModule.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Module not found', 'PLATFORM_MODULE_NOT_FOUND', { id });

    try {
        return await prisma.platformModule.update({
            where: { id },
            data: {
                ...(input.moduleCode !== undefined ? { moduleCode: input.moduleCode } : {}),
                ...(input.moduleName !== undefined ? { moduleName: input.moduleName } : {}),
            },
            select: platformModuleSelect,
        });
    } catch (err) {
        mapModuleCodeConflict(err);
        throw err;
    }
}

export async function deletePlatformModule(id: string) {
    const existing = await prisma.platformModule.findUnique({
        where: { id },
        select: { id: true, _count: { select: { tabs: true } } },
    });
    if (!existing) throw new NotFoundError('Module not found', 'PLATFORM_MODULE_NOT_FOUND', { id });
    if (existing._count.tabs > 0) {
        throw new ConflictError(
            `Cannot delete module: it still has ${existing._count.tabs} tab(s). Remove them first.`,
            'PLATFORM_MODULE_HAS_TABS',
        );
    }

    await prisma.platformModule.delete({ where: { id } });
}
