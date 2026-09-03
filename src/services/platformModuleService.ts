import { NotImplementedError } from '../utils/errors.js';
import type {
    CreatePlatformModuleInput,
    UpdatePlatformModuleInput,
    ListPlatformModuleQuery,
} from '../validations/platformModuleValidation.js';

// TODO(platform-rbac-pg-migration): the incoming pg migration never created the
// platform_modules/platform_tabs/platform_rights/platform_role_access/platform_employee_access
// tables — this whole LK Space platform-RBAC subsystem needs a real migration + repository layer
// before these can work again. Stubbed to a clean 501 in the meantime so the rest of the server
// still boots and every other endpoint keeps working (a leftover @prisma/client import here would
// crash the process at startup, since Prisma is no longer an installed dependency).
function notImplemented(): never {
    throw new NotImplementedError('Platform module management is not available on this deployment yet', 'PLATFORM_MODULE_NOT_IMPLEMENTED');
}

export async function createPlatformModule(_input: CreatePlatformModuleInput) {
    return notImplemented();
}

export async function listPlatformModules(_query: ListPlatformModuleQuery) {
    return notImplemented();
}

export async function getPlatformModuleById(_id: string) {
    return notImplemented();
}

export async function updatePlatformModule(_id: string, _input: UpdatePlatformModuleInput) {
    return notImplemented();
}

export async function deletePlatformModule(_id: string) {
    return notImplemented();
}
