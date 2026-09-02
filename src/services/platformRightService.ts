import { Prisma, RightAction } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreatePlatformRightInput, UpdatePlatformRightInput, ListPlatformRightQuery } from '../validations/platformRightValidation.js';

const platformRightSelect = {
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
} satisfies Prisma.PlatformRightSelect;

type PlatformRightRow = Prisma.PlatformRightGetPayload<{ select: typeof platformRightSelect }>;

function mapPlatformRightRecord(record: PlatformRightRow) {
    const { module, tab, ...rest } = record;
    return { ...rest, moduleName: module.moduleName, tabName: tab?.tabName ?? null };
}

const ACTION_LABELS: Record<RightAction, string> = {
    VIEW: 'View',
    ADD: 'Add',
    EDIT: 'Edit',
    DELETE: 'Delete',
};

/** Stable, server-derived identifier — never admin-typed. Same derivation as the company-scoped Right.rightName. */
function deriveRightName(moduleCode: string, tabCode: string | null, action: RightAction): string {
    return `${moduleCode}_${tabCode ?? 'all'}_${action}`.toLowerCase();
}

function deriveDisplayName(moduleName: string, tabName: string | null, action: RightAction): string {
    return `${moduleName}${tabName ? ` – ${tabName}` : ''} – ${ACTION_LABELS[action]}`;
}

async function loadModuleForDerivation(moduleId: string) {
    const module = await prisma.platformModule.findUnique({
        where: { id: moduleId },
        select: { moduleCode: true, moduleName: true },
    });
    if (!module) throw new ValidationError('moduleId does not reference an existing module', 'INVALID_MODULE_ID');
    return module;
}

/** A Tab, if provided, must belong to the same module the Right is being scoped to. */
async function loadTabForDerivation(tabId: string, moduleId: string) {
    const tab = await prisma.platformTab.findUnique({
        where: { id: tabId },
        select: { moduleId: true, tabCode: true, tabName: true },
    });
    if (!tab) throw new ValidationError('tabId does not reference an existing tab', 'INVALID_TAB_ID');
    if (tab.moduleId !== moduleId) {
        throw new ValidationError('tabId does not belong to the given moduleId', 'TAB_MODULE_MISMATCH');
    }
    return tab;
}

/** Maps a unique-constraint violation on rightName to a stable conflict error — this exact Module/Tab/Action combination already has a right. */
function mapRightNameConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A right for this module/tab/action already exists', 'PLATFORM_RIGHT_ALREADY_EXISTS');
}

export async function createPlatformRight(input: CreatePlatformRightInput) {
    const module = await loadModuleForDerivation(input.moduleId);
    const tab = input.tabId ? await loadTabForDerivation(input.tabId, input.moduleId) : null;

    try {
        const record = await prisma.platformRight.create({
            data: {
                moduleId: input.moduleId,
                tabId: input.tabId ?? null,
                action: input.action,
                rightName: deriveRightName(module.moduleCode, tab?.tabCode ?? null, input.action),
                displayName: deriveDisplayName(module.moduleName, tab?.tabName ?? null, input.action),
            },
            select: platformRightSelect,
        });
        return mapPlatformRightRecord(record);
    } catch (err) {
        mapRightNameConflict(err);
        throw err;
    }
}

export async function listPlatformRights(query: ListPlatformRightQuery) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.PlatformRightWhereInput = {
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
        prisma.platformRight.findMany({ where, select: platformRightSelect, orderBy: { displayName: 'asc' }, skip, take }),
        prisma.platformRight.count({ where }),
    ]);

    return { items: rows.map(mapPlatformRightRecord), meta: toPageMeta(query, total) };
}

export async function getPlatformRightById(id: string) {
    const record = await prisma.platformRight.findUnique({ where: { id }, select: platformRightSelect });
    if (!record) throw new NotFoundError('Right not found', 'PLATFORM_RIGHT_NOT_FOUND', { id });
    return mapPlatformRightRecord(record);
}

export async function updatePlatformRight(id: string, input: UpdatePlatformRightInput) {
    const existing = await prisma.platformRight.findUnique({
        where: { id },
        select: { id: true, moduleId: true, tabId: true, action: true },
    });
    if (!existing) throw new NotFoundError('Right not found', 'PLATFORM_RIGHT_NOT_FOUND', { id });

    const finalModuleId = input.moduleId ?? existing.moduleId;
    const finalTabId = input.tabId !== undefined ? input.tabId : existing.tabId;
    const finalAction = input.action ?? existing.action;

    const module = await loadModuleForDerivation(finalModuleId);
    const tab = finalTabId ? await loadTabForDerivation(finalTabId, finalModuleId) : null;

    try {
        const record = await prisma.platformRight.update({
            where: { id },
            data: {
                moduleId: finalModuleId,
                tabId: finalTabId,
                action: finalAction,
                rightName: deriveRightName(module.moduleCode, tab?.tabCode ?? null, finalAction),
                displayName: deriveDisplayName(module.moduleName, tab?.tabName ?? null, finalAction),
            },
            select: platformRightSelect,
        });
        return mapPlatformRightRecord(record);
    } catch (err) {
        mapRightNameConflict(err);
        throw err;
    }
}

export async function deletePlatformRight(id: string) {
    const existing = await prisma.platformRight.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Right not found', 'PLATFORM_RIGHT_NOT_FOUND', { id });

    // PlatformRoleAccessRight rows for this right cascade-delete, so the right is automatically
    // removed from every role it was assigned to.
    await prisma.platformRight.delete({ where: { id } });
}
