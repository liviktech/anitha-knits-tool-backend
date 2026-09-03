import { isUniqueViolation } from '../db/errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { findModuleCodeName } from '../repositories/module.repository.js';
import { findTabForDerivation } from '../repositories/tab.repository.js';
import {
    createRight as createRightRepo,
    deleteRight as deleteRightRepo,
    existsRightInCompany,
    findRightById,
    findRightCore,
    listRights as listRightsRepo,
    updateRight as updateRightRepo,
} from '../repositories/right.repository.js';
import type { RightAction } from '../types/enums.js';
import type { CreateRightInput, UpdateRightInput, ListRightQuery } from '../validations/rightValidation.js';

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
    const module = await findModuleCodeName(moduleId, companyId);
    if (!module) throw new ValidationError('moduleId does not reference an existing module for this company', 'INVALID_MODULE_ID');
    return module;
}

/** A Tab, if provided, must belong to this company AND to the same module the Right is being scoped to. */
async function loadTabForDerivation(tabId: string, moduleId: string, companyId: string) {
    const tab = await findTabForDerivation(tabId, companyId);
    if (!tab) throw new ValidationError('tabId does not reference an existing tab for this company', 'INVALID_TAB_ID');
    if (tab.moduleId !== moduleId) {
        throw new ValidationError('tabId does not belong to the given moduleId', 'TAB_MODULE_MISMATCH');
    }
    return tab;
}

/** Maps a unique-constraint violation on [companyId, rightName] to a stable conflict error — i.e. this exact Module/Tab/Action combination already has a right. */
function mapRightNameConflict(err: unknown): never | undefined {
    if (!isUniqueViolation(err)) return undefined;
    throw new ConflictError('A right for this module/tab/action already exists', 'RIGHT_ALREADY_EXISTS');
}

export async function createRight(input: CreateRightInput, companyId: string) {
    const module = await loadModuleForDerivation(input.moduleId, companyId);
    const tab = input.tabId ? await loadTabForDerivation(input.tabId, input.moduleId, companyId) : null;

    try {
        return await createRightRepo({
            companyId,
            moduleId: input.moduleId,
            tabId: input.tabId ?? null,
            action: input.action,
            rightName: deriveRightName(module.moduleCode, tab?.tabCode ?? null, input.action),
            displayName: deriveDisplayName(module.moduleName, tab?.tabName ?? null, input.action),
        });
    } catch (err) {
        mapRightNameConflict(err);
        throw err;
    }
}

export async function listRights(query: ListRightQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listRightsRepo(
        companyId,
        { tabId: query.tabId, moduleId: query.moduleId, action: query.action, name: query.name },
        skip,
        take,
    );
    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getRightById(id: string, companyId: string) {
    const record = await findRightById(id, companyId);
    if (!record) throw new NotFoundError('Right not found', 'RIGHT_NOT_FOUND', { id });
    return record;
}

export async function updateRight(id: string, input: UpdateRightInput, companyId: string) {
    const existing = await findRightCore(id, companyId);
    if (!existing) throw new NotFoundError('Right not found', 'RIGHT_NOT_FOUND', { id });

    const finalModuleId = input.moduleId ?? existing.moduleId;
    const finalTabId = input.tabId !== undefined ? input.tabId : existing.tabId;
    const finalAction = input.action ?? existing.action;

    // rightName/displayName always get re-derived from the final module/tab/action, regardless
    // of which individual field changed, since any of the three affects both derived strings.
    const module = await loadModuleForDerivation(finalModuleId, companyId);
    const tab = finalTabId ? await loadTabForDerivation(finalTabId, finalModuleId, companyId) : null;

    try {
        return await updateRightRepo(id, {
            moduleId: finalModuleId,
            tabId: finalTabId,
            action: finalAction,
            rightName: deriveRightName(module.moduleCode, tab?.tabCode ?? null, finalAction),
            displayName: deriveDisplayName(module.moduleName, tab?.tabName ?? null, finalAction),
        });
    } catch (err) {
        mapRightNameConflict(err);
        throw err;
    }
}

export async function deleteRight(id: string, companyId: string) {
    const existing = await existsRightInCompany(id, companyId);
    if (!existing) throw new NotFoundError('Right not found', 'RIGHT_NOT_FOUND', { id });

    // RoleAccessRight rows for this right cascade-delete (schema onDelete: Cascade),
    // so the right is automatically removed from every role it was assigned to.
    await deleteRightRepo(id);
}
