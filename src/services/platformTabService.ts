import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreatePlatformTabInput, UpdatePlatformTabInput, ListPlatformTabQuery } from '../validations/platformTabValidation.js';

const platformTabSelect = {
    id: true,
    moduleId: true,
    tabCode: true,
    tabName: true,
    createdAt: true,
    updatedAt: true,
    module: { select: { moduleName: true } },
} satisfies Prisma.PlatformTabSelect;

type PlatformTabRow = Prisma.PlatformTabGetPayload<{ select: typeof platformTabSelect }>;

function mapPlatformTabRecord(record: PlatformTabRow) {
    const { module, ...rest } = record;
    return { ...rest, moduleName: module.moduleName };
}

async function assertModuleExists(moduleId: string) {
    const module = await prisma.platformModule.findUnique({ where: { id: moduleId }, select: { id: true } });
    if (!module) throw new ValidationError('moduleId does not reference an existing module', 'INVALID_MODULE_ID');
}

/** Maps a unique-constraint violation on [moduleId, tabCode] to a stable conflict error. */
function mapTabCodeConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A tab with this code already exists in this module', 'PLATFORM_TAB_CODE_EXISTS');
}

export async function createPlatformTab(input: CreatePlatformTabInput) {
    await assertModuleExists(input.moduleId);

    try {
        const record = await prisma.platformTab.create({
            data: { moduleId: input.moduleId, tabCode: input.tabCode, tabName: input.tabName },
            select: platformTabSelect,
        });
        return mapPlatformTabRecord(record);
    } catch (err) {
        mapTabCodeConflict(err);
        throw err;
    }
}

export async function listPlatformTabs(query: ListPlatformTabQuery) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.PlatformTabWhereInput = {
        ...(query.moduleId ? { moduleId: query.moduleId } : {}),
        ...(query.name ? { tabName: { contains: query.name, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.platformTab.findMany({ where, select: platformTabSelect, orderBy: { tabName: 'asc' }, skip, take }),
        prisma.platformTab.count({ where }),
    ]);

    return { items: rows.map(mapPlatformTabRecord), meta: toPageMeta(query, total) };
}

export async function getPlatformTabById(id: string) {
    const record = await prisma.platformTab.findUnique({ where: { id }, select: platformTabSelect });
    if (!record) throw new NotFoundError('Tab not found', 'PLATFORM_TAB_NOT_FOUND', { id });
    return mapPlatformTabRecord(record);
}

export async function updatePlatformTab(id: string, input: UpdatePlatformTabInput) {
    const existing = await prisma.platformTab.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Tab not found', 'PLATFORM_TAB_NOT_FOUND', { id });

    if (input.moduleId !== undefined) {
        await assertModuleExists(input.moduleId);
    }

    try {
        const record = await prisma.platformTab.update({
            where: { id },
            data: {
                ...(input.moduleId !== undefined ? { moduleId: input.moduleId } : {}),
                ...(input.tabCode !== undefined ? { tabCode: input.tabCode } : {}),
                ...(input.tabName !== undefined ? { tabName: input.tabName } : {}),
            },
            select: platformTabSelect,
        });
        return mapPlatformTabRecord(record);
    } catch (err) {
        mapTabCodeConflict(err);
        throw err;
    }
}

export async function deletePlatformTab(id: string) {
    const existing = await prisma.platformTab.findUnique({
        where: { id },
        select: { id: true, _count: { select: { rights: true } } },
    });
    if (!existing) throw new NotFoundError('Tab not found', 'PLATFORM_TAB_NOT_FOUND', { id });
    if (existing._count.rights > 0) {
        throw new ConflictError(
            `Cannot delete tab: it still has ${existing._count.rights} right(s). Remove them first.`,
            'PLATFORM_TAB_HAS_RIGHTS',
        );
    }

    await prisma.platformTab.delete({ where: { id } });
}
