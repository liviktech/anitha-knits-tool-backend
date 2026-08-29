import { Prisma, RightAction } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreateRightInput, UpdateRightInput, ListRightQuery } from '../validations/rightValidation.js';

const rightSelect = {
    id: true,
    moduleId: true,
    tabId: true,
    action: true,
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

const ACTION_LABELS: Record<RightAction, string> = {
    VIEW: 'View',
    ADD: 'Add',
    EDIT: 'Edit',
    DELETE: 'Delete',
};

/** Stable, server-derived identifier — never admin-typed. See the schema comment on Right.rightName for why this (not a raw composite key) is what enforces uniqueness. */
function deriveRightName(moduleCode: string, tabCode: string | null, action: RightAction): string {
    return `${moduleCode}_${tabCode ?? 'all'}_${action}`.toLowerCase();
}

function deriveDisplayName(moduleName: string, tabName: string | null, action: RightAction): string {
    return `${moduleName}${tabName ? ` – ${tabName}` : ''} – ${ACTION_LABELS[action]}`;
}

/** Validates moduleId belongs to this company and returns the fields needed to derive rightName/displayName. */
async function loadModuleForDerivation(moduleId: string, companyId: string) {
    const module = await prisma.module.findFirst({
        where: { id: moduleId, companyId },
        select: { moduleCode: true, moduleName: true },
    });
    if (!module) throw new ValidationError('moduleId does not reference an existing module for this company', 'INVALID_MODULE_ID');
    return module;
}

/** A Tab, if provided, must belong to this company AND to the same module the Right is being scoped to. */
async function loadTabForDerivation(tabId: string, moduleId: string, companyId: string) {
    const tab = await prisma.tab.findFirst({
        where: { id: tabId, companyId },
        select: { moduleId: true, tabCode: true, tabName: true },
    });
    if (!tab) throw new ValidationError('tabId does not reference an existing tab for this company', 'INVALID_TAB_ID');
    if (tab.moduleId !== moduleId) {
        throw new ValidationError('tabId does not belong to the given moduleId', 'TAB_MODULE_MISMATCH');
    }
    return tab;
}

/** Maps a unique-constraint violation on [companyId, rightName] to a stable conflict error — i.e. this exact Module/Tab/Action combination already has a right. */
function mapRightNameConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A right for this module/tab/action already exists', 'RIGHT_ALREADY_EXISTS');
}

export async function createRight(input: CreateRightInput, companyId: string) {
    const module = await loadModuleForDerivation(input.moduleId, companyId);
    const tab = input.tabId ? await loadTabForDerivation(input.tabId, input.moduleId, companyId) : null;

    try {
        const record = await prisma.right.create({
            data: {
                companyId,
                moduleId: input.moduleId,
                tabId: input.tabId ?? null,
                action: input.action,
                rightName: deriveRightName(module.moduleCode, tab?.tabCode ?? null, input.action),
                displayName: deriveDisplayName(module.moduleName, tab?.tabName ?? null, input.action),
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
        ...(query.action ? { action: query.action } : {}),
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
        select: { id: true, moduleId: true, tabId: true, action: true },
    });
    if (!existing) throw new NotFoundError('Right not found', 'RIGHT_NOT_FOUND', { id });

    const finalModuleId = input.moduleId ?? existing.moduleId;
    const finalTabId = input.tabId !== undefined ? input.tabId : existing.tabId;
    const finalAction = input.action ?? existing.action;

    // rightName/displayName always get re-derived from the final module/tab/action, regardless
    // of which individual field changed, since any of the three affects both derived strings.
    const module = await loadModuleForDerivation(finalModuleId, companyId);
    const tab = finalTabId ? await loadTabForDerivation(finalTabId, finalModuleId, companyId) : null;

    try {
        const record = await prisma.right.update({
            where: { id },
            data: {
                moduleId: finalModuleId,
                tabId: finalTabId,
                action: finalAction,
                rightName: deriveRightName(module.moduleCode, tab?.tabCode ?? null, finalAction),
                displayName: deriveDisplayName(module.moduleName, tab?.tabName ?? null, finalAction),
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
