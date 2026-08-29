import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreateRightInput, UpdateRightInput, ListRightQuery } from '../validations/rightValidation.js';

const rightSelect = {
    id: true,
    moduleId: true,
    tabId: true,
    rightName: true,
    displayName: true,
    createdAt: true,
    updatedAt: true,
    module: { select: { moduleName: true } },
    tab: { select: { tabName: true } },
} satisfies Prisma.RightSelect;

type RightRow = Prisma.RightGetPayload<{ select: typeof rightSelect }>;

function mapRightRecord(record: RightRow) {
    const { module, tab, ...rest } = record;
    return { ...rest, moduleName: module.moduleName, tabName: tab?.tabName ?? null };
}

async function assertModuleInCompany(moduleId: string, companyId: string) {
    const module = await prisma.module.findFirst({ where: { id: moduleId, companyId }, select: { id: true } });
    if (!module) throw new ValidationError('moduleId does not reference an existing module for this company', 'INVALID_MODULE_ID');
}

/** A Tab, if provided, must belong to this company AND to the same module the Right is being scoped to. */
async function assertTabBelongsToModule(tabId: string, moduleId: string, companyId: string) {
    const tab = await prisma.tab.findFirst({ where: { id: tabId, companyId }, select: { moduleId: true } });
    if (!tab) throw new ValidationError('tabId does not reference an existing tab for this company', 'INVALID_TAB_ID');
    if (tab.moduleId !== moduleId) {
        throw new ValidationError('tabId does not belong to the given moduleId', 'TAB_MODULE_MISMATCH');
    }
}

/** Maps a unique-constraint violation on [companyId, rightName] to a stable conflict error. */
function mapRightNameConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A right with this name already exists', 'RIGHT_NAME_EXISTS');
}

export async function createRight(input: CreateRightInput, companyId: string) {
    await assertModuleInCompany(input.moduleId, companyId);
    if (input.tabId) {
        await assertTabBelongsToModule(input.tabId, input.moduleId, companyId);
    }

    try {
        const record = await prisma.right.create({
            data: {
                companyId,
                moduleId: input.moduleId,
                tabId: input.tabId ?? null,
                rightName: input.rightName,
                displayName: input.displayName,
            },
            select: rightSelect,
        });
        return mapRightRecord(record);
    } catch (err) {
        mapRightNameConflict(err);
        throw err;
    }
}

export async function listRights(query: ListRightQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.RightWhereInput = {
        companyId,
        ...(query.tabId ? { tabId: query.tabId } : {}),
        ...(query.moduleId ? { moduleId: query.moduleId } : {}),
        ...(query.name
            ? {
                OR: [
                    { displayName: { contains: query.name, mode: 'insensitive' } },
                    { rightName: { contains: query.name, mode: 'insensitive' } },
                ],
            }
            : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.right.findMany({ where, select: rightSelect, orderBy: { displayName: 'asc' }, skip, take }),
        prisma.right.count({ where }),
    ]);

    return { items: rows.map(mapRightRecord), meta: toPageMeta(query, total) };
}

export async function getRightById(id: string, companyId: string) {
    const record = await prisma.right.findFirst({ where: { id, companyId }, select: rightSelect });
    if (!record) throw new NotFoundError('Right not found', 'RIGHT_NOT_FOUND', { id });
    return mapRightRecord(record);
}

export async function updateRight(id: string, input: UpdateRightInput, companyId: string) {
    const existing = await prisma.right.findFirst({
        where: { id, companyId },
        select: { id: true, moduleId: true, tabId: true },
    });
    if (!existing) throw new NotFoundError('Right not found', 'RIGHT_NOT_FOUND', { id });

    if (input.moduleId !== undefined) {
        await assertModuleInCompany(input.moduleId, companyId);
    }
    const finalModuleId = input.moduleId ?? existing.moduleId;

    if (input.tabId !== undefined) {
        // Explicitly provided — null clears it, a uuid must belong to the final module.
        if (input.tabId !== null) await assertTabBelongsToModule(input.tabId, finalModuleId, companyId);
    } else if (input.moduleId !== undefined && existing.tabId) {
        // moduleId is changing but tabId wasn't touched — the existing tab must still be valid
        // under the new module, otherwise the caller must pass tabId explicitly (a new one, or null).
        await assertTabBelongsToModule(existing.tabId, finalModuleId, companyId);
    }

    try {
        const record = await prisma.right.update({
            where: { id },
            data: {
                ...(input.moduleId !== undefined ? { moduleId: input.moduleId } : {}),
                ...(input.tabId !== undefined ? { tabId: input.tabId } : {}),
                ...(input.rightName !== undefined ? { rightName: input.rightName } : {}),
                ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
            },
            select: rightSelect,
        });
        return mapRightRecord(record);
    } catch (err) {
        mapRightNameConflict(err);
        throw err;
    }
}

export async function deleteRight(id: string, companyId: string) {
    const existing = await prisma.right.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Right not found', 'RIGHT_NOT_FOUND', { id });

    // RoleAccessRight rows for this right cascade-delete (schema onDelete: Cascade),
    // so the right is automatically removed from every role it was assigned to.
    await prisma.right.delete({ where: { id } });
}
