import { NotImplementedError } from '../utils/errors.js';
import type { CreatePlatformRightInput, UpdatePlatformRightInput, ListPlatformRightQuery } from '../validations/platformRightValidation.js';

// TODO(platform-rbac-pg-migration): see platformModuleService.ts — same missing-tables gap.
function notImplemented(): never {
    throw new NotImplementedError('Platform right management is not available on this deployment yet', 'PLATFORM_RIGHT_NOT_IMPLEMENTED');
}

export async function createPlatformRight(_input: CreatePlatformRightInput) {
    return notImplemented();
}

export async function listPlatformRights(_query: ListPlatformRightQuery) {
    return notImplemented();
}

export async function getPlatformRightById(_id: string) {
    return notImplemented();
}

export async function updatePlatformRight(_id: string, _input: UpdatePlatformRightInput) {
    return notImplemented();
}

export async function deletePlatformRight(_id: string) {
    return notImplemented();
}
