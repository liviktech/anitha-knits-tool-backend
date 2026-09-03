import { NotImplementedError } from '../utils/errors.js';
import { toPageMeta } from '../utils/pagination.js';
import type {
    AssignPlatformRoleAccessInput,
    CreatePlatformRoleAccessInput,
    ListPlatformRoleAccessQuery,
    UpdatePlatformRoleAccessInput,
} from '../validations/platformRoleAccessValidation.js';

// TODO(platform-rbac-pg-migration): see platformModuleService.ts — same missing-tables gap.
// resolvePlatformAccess is the one exception: it's on the hot path for every LK Space request
// (platformAdminService.loginPlatformAdmin / getCurrentPlatformAdmin, requirePlatformModuleAccess),
// so it stays real rather than throwing — SUPER_ADMIN is unaffected (always unrestricted, no
// table lookup involved), and EMPLOYEE correctly degrades to zero access, which is the truthful
// answer while platform_employee_access doesn't exist yet (no employee could have a real grant).
function notImplemented(): never {
    throw new NotImplementedError('Platform role management is not available on this deployment yet', 'PLATFORM_ROLE_ACCESS_NOT_IMPLEMENTED');
}

export async function createPlatformRoleAccess(_input: CreatePlatformRoleAccessInput) {
    return notImplemented();
}

export async function listPlatformRoleAccesses(query: ListPlatformRoleAccessQuery) {
    return { items: [], meta: toPageMeta(query, 0) };
}

export async function getPlatformRoleAccessById(_id: string) {
    return notImplemented();
}

export async function updatePlatformRoleAccess(_id: string, _input: UpdatePlatformRoleAccessInput) {
    return notImplemented();
}

export async function deletePlatformRoleAccess(_id: string) {
    return notImplemented();
}

export interface PlatformAccessGrant {
    moduleCode: string;
    tabCode: string | null;
}

export interface PlatformUserAccess {
    grants: PlatformAccessGrant[];
    moduleCodes: string[];
    rights: string[];
    roleName: string | null;
}

/**
 * The single source of truth for "what can this LK Space session see" — used by both the
 * login/me response (platformAdminService) and the requirePlatformModuleAccess route middleware.
 *
 * `null` = unrestricted (SUPER_ADMIN, always). An EMPLOYEE always resolves to zero access until
 * the platform-RBAC tables exist — there is no PlatformEmployeeAccess row to ever grant one.
 */
export async function resolvePlatformAccess(role: 'SUPER_ADMIN' | 'EMPLOYEE', _livikEmpId: string | null): Promise<PlatformUserAccess | null> {
    if (role === 'SUPER_ADMIN') return null;
    return { grants: [], moduleCodes: [], rights: [], roleName: null };
}

export async function assignPlatformRoleToEmployees(_id: string, _input: AssignPlatformRoleAccessInput) {
    return notImplemented();
}

export interface PlatformEmployeeAccessRecord {
    livikEmpId: string;
    roleAccessId: string | null;
    roleName: string | null;
    isActive: boolean;
}

/** Every Livik employee ever granted (or revoked from) LK Space access — empty until platform_employee_access exists. */
export async function listPlatformEmployeeAccess(): Promise<PlatformEmployeeAccessRecord[]> {
    return [];
}
