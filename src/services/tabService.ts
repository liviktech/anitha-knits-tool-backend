import { isUniqueViolation } from '../db/errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { existsModuleInCompany } from '../repositories/module.repository.js';
import {
    countRightsForTab,
    createTab as createTabRepo,
    deleteTab as deleteTabRepo,
    findTabById,
    listTabs as listTabsRepo,
    updateTab as updateTabRepo,
} from '../repositories/tab.repository.js';
import type { CreateTabInput, UpdateTabInput, ListTabQuery } from '../validations/tabValidation.js';

async function assertModuleInCompany(moduleId: string, companyId: string) {
    const exists = await existsModuleInCompany(moduleId, companyId);
    if (!exists) throw new ValidationError('moduleId does not reference an existing module for this company', 'INVALID_MODULE_ID');
}

/** Maps a unique-constraint violation on [companyId, moduleId, tabCode] to a stable conflict error. */
function mapTabCodeConflict(err: unknown): never | undefined {
    if (!isUniqueViolation(err)) return undefined;
    throw new ConflictError('A tab with this code already exists in this module', 'TAB_CODE_EXISTS');
}

export async function createTab(input: CreateTabInput, companyId: string) {
    await assertModuleInCompany(input.moduleId, companyId);

    try {
        return await createTabRepo({ companyId, moduleId: input.moduleId, tabCode: input.tabCode, tabName: input.tabName });
    } catch (err) {
        mapTabCodeConflict(err);
        throw err;
    }
}

export async function listTabs(query: ListTabQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listTabsRepo(companyId, { moduleId: query.moduleId, name: query.name }, skip, take);
    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getTabById(id: string, companyId: string) {
    const record = await findTabById(id, companyId);
    if (!record) throw new NotFoundError('Tab not found', 'TAB_NOT_FOUND', { id });
    return record;
}

export async function updateTab(id: string, input: UpdateTabInput, companyId: string) {
    const existing = await findTabById(id, companyId);
    if (!existing) throw new NotFoundError('Tab not found', 'TAB_NOT_FOUND', { id });

    if (input.moduleId !== undefined) {
        await assertModuleInCompany(input.moduleId, companyId);
    }

    try {
        return await updateTabRepo(id, {
            moduleId: input.moduleId !== undefined ? input.moduleId : undefined,
            tabCode: input.tabCode !== undefined ? input.tabCode : undefined,
            tabName: input.tabName !== undefined ? input.tabName : undefined,
        });
    } catch (err) {
        mapTabCodeConflict(err);
        throw err;
    }
}

export async function deleteTab(id: string, companyId: string) {
    const existing = await findTabById(id, companyId);
    if (!existing) throw new NotFoundError('Tab not found', 'TAB_NOT_FOUND', { id });

    const rightCount = await countRightsForTab(id);
    if (rightCount > 0) {
        throw new ConflictError(`Cannot delete tab: it still has ${rightCount} right(s). Remove them first.`, 'TAB_HAS_RIGHTS');
    }

    await deleteTabRepo(id);
}
