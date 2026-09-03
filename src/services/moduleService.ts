import { isUniqueViolation } from '../db/errors.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import {
    countTabsForModule,
    createModule as createModuleRepo,
    deleteModule as deleteModuleRepo,
    findModuleById,
    listModules as listModulesRepo,
    updateModule as updateModuleRepo,
} from '../repositories/module.repository.js';
import type { CreateModuleInput, UpdateModuleInput, ListModuleQuery } from '../validations/moduleValidation.js';

/** Maps a unique-constraint violation on [companyId, moduleCode] to a stable conflict error. */
function mapModuleCodeConflict(err: unknown): never | undefined {
    if (!isUniqueViolation(err)) return undefined;
    throw new ConflictError('A module with this code already exists', 'MODULE_CODE_EXISTS');
}

export async function createModule(input: CreateModuleInput, companyId: string) {
    try {
        return await createModuleRepo({ companyId, moduleCode: input.moduleCode, moduleName: input.moduleName });
    } catch (err) {
        mapModuleCodeConflict(err);
        throw err;
    }
}

export async function listModules(query: ListModuleQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listModulesRepo(companyId, { name: query.name }, skip, take);
    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getModuleById(id: string, companyId: string) {
    const record = await findModuleById(id, companyId);
    if (!record) throw new NotFoundError('Module not found', 'MODULE_NOT_FOUND', { id });
    return record;
}

export async function updateModule(id: string, input: UpdateModuleInput, companyId: string) {
    const existing = await findModuleById(id, companyId);
    if (!existing) throw new NotFoundError('Module not found', 'MODULE_NOT_FOUND', { id });

    try {
        return await updateModuleRepo(id, {
            moduleCode: input.moduleCode !== undefined ? input.moduleCode : undefined,
            moduleName: input.moduleName !== undefined ? input.moduleName : undefined,
        });
    } catch (err) {
        mapModuleCodeConflict(err);
        throw err;
    }
}

export async function deleteModule(id: string, companyId: string) {
    const existing = await findModuleById(id, companyId);
    if (!existing) throw new NotFoundError('Module not found', 'MODULE_NOT_FOUND', { id });

    const tabCount = await countTabsForModule(id);
    if (tabCount > 0) {
        throw new ConflictError(`Cannot delete module: it still has ${tabCount} tab(s). Remove them first.`, 'MODULE_HAS_TABS');
    }

    await deleteModuleRepo(id);
}
