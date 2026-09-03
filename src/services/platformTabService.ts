import { NotImplementedError } from '../utils/errors.js';
import type { CreatePlatformTabInput, UpdatePlatformTabInput, ListPlatformTabQuery } from '../validations/platformTabValidation.js';

// TODO(platform-rbac-pg-migration): see platformModuleService.ts — same missing-tables gap.
function notImplemented(): never {
    throw new NotImplementedError('Platform tab management is not available on this deployment yet', 'PLATFORM_TAB_NOT_IMPLEMENTED');
}

export async function createPlatformTab(_input: CreatePlatformTabInput) {
    return notImplemented();
}

export async function listPlatformTabs(_query: ListPlatformTabQuery) {
    return notImplemented();
}

export async function getPlatformTabById(_id: string) {
    return notImplemented();
}

export async function updatePlatformTab(_id: string, _input: UpdatePlatformTabInput) {
    return notImplemented();
}

export async function deletePlatformTab(_id: string) {
    return notImplemented();
}
