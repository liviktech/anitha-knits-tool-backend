import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreateTabInput, UpdateTabInput, ListTabQuery } from '../validations/tabValidation.js';

const tabSelect = {
    id: true,
    moduleId: true,
    tabCode: true,
    tabName: true,
    createdAt: true,
    updatedAt: true,
    module: { select: { moduleName: true } },
} satisfies Prisma.TabSelect;

type TabRow = Prisma.TabGetPayload<{ select: typeof tabSelect }>;

function mapTabRecord(record: TabRow) {
    const { module, ...rest } = record;
    return { ...rest, moduleName: module.moduleName };
}

async function assertModuleInCompany(moduleId: string, companyId: string) {
    const module = await prisma.module.findFirst({ where: { id: moduleId, companyId }, select: { id: true } });
    if (!module) throw new ValidationError('moduleId does not reference an existing module for this company', 'INVALID_MODULE_ID');
}

/** Maps a unique-constraint violation on [companyId, moduleId, tabCode] to a stable conflict error. */
function mapTabCodeConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A tab with this code already exists in this module', 'TAB_CODE_EXISTS');
}

export async function createTab(input: CreateTabInput, companyId: string) {
    await assertModuleInCompany(input.moduleId, companyId);

    try {
        const record = await prisma.tab.create({
            data: { companyId, moduleId: input.moduleId, tabCode: input.tabCode, tabName: input.tabName },
            select: tabSelect,
        });
        return mapTabRecord(record);
    } catch (err) {
        mapTabCodeConflict(err);
        throw err;
    }
}

export async function listTabs(query: ListTabQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.TabWhereInput = {
        companyId,
        ...(query.moduleId ? { moduleId: query.moduleId } : {}),
        ...(query.name ? { tabName: { contains: query.name, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.tab.findMany({ where, select: tabSelect, orderBy: { tabName: 'asc' }, skip, take }),
        prisma.tab.count({ where }),
    ]);

    return { items: rows.map(mapTabRecord), meta: toPageMeta(query, total) };
}

export async function getTabById(id: string, companyId: string) {
    const record = await prisma.tab.findFirst({ where: { id, companyId }, select: tabSelect });
    if (!record) throw new NotFoundError('Tab not found', 'TAB_NOT_FOUND', { id });
    return mapTabRecord(record);
}

export async function updateTab(id: string, input: UpdateTabInput, companyId: string) {
    const existing = await prisma.tab.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Tab not found', 'TAB_NOT_FOUND', { id });

    if (input.moduleId !== undefined) {
        await assertModuleInCompany(input.moduleId, companyId);
    }

    try {
        const record = await prisma.tab.update({
            where: { id },
            data: {
                ...(input.moduleId !== undefined ? { moduleId: input.moduleId } : {}),
                ...(input.tabCode !== undefined ? { tabCode: input.tabCode } : {}),
                ...(input.tabName !== undefined ? { tabName: input.tabName } : {}),
            },
            select: tabSelect,
        });
        return mapTabRecord(record);
    } catch (err) {
        mapTabCodeConflict(err);
        throw err;
    }
}

export async function deleteTab(id: string, companyId: string) {
    const existing = await prisma.tab.findFirst({
        where: { id, companyId },
        select: { id: true, _count: { select: { rights: true } } },
    });
    if (!existing) throw new NotFoundError('Tab not found', 'TAB_NOT_FOUND', { id });
    if (existing._count.rights > 0) {
        throw new ConflictError(
            `Cannot delete tab: it still has ${existing._count.rights} right(s). Remove them first.`,
            'TAB_HAS_RIGHTS',
        );
    }

    await prisma.tab.delete({ where: { id } });
}
