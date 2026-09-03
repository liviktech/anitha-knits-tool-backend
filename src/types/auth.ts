/** The three-plus roles a User can hold, mirrored from the (not-yet-live) multi-tenant schema's UserRole enum. */
export type Role = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';

/** Claim set shared by access and refresh tokens. */
export interface TokenPayload {
    sub: string;
    role: Role;
    companyId: string;
    mobile: string;
}

/** Access token claims; `type` stops a refresh token from being replayed here. */
export interface AccessTokenPayload extends TokenPayload {
    type: 'access';
}

/** Refresh token claims; `type` stops an access token from being replayed here. */
export interface RefreshTokenPayload extends TokenPayload {
    type: 'refresh';
}

/**
 * `SUPER_ADMIN` is the one seeded PlatformAdmin (unrestricted). `EMPLOYEE` is a Livik employee
 * logging in with their own Livik credentials (see platformAdminService.loginPlatformAdmin) —
 * their access is whatever PlatformEmployeeAccess/PlatformRoleAccess resolves to
 * (resolvePlatformAccess), never unrestricted.
 */
export type PlatformAdminRole = 'SUPER_ADMIN' | 'EMPLOYEE';

/**
 * Claim set shared by platform-admin access and refresh tokens — deliberately has no companyId.
 * `sub` is the PlatformAdmin.id (uuid) when role is SUPER_ADMIN, or the Livik Employee.empId
 * string when role is EMPLOYEE — there's no single table both could be a row in.
 */
export interface PlatformAdminTokenPayload {
    sub: string;
    role: PlatformAdminRole;
    mobile: string;
    type: 'platform_admin_access' | 'platform_admin_refresh';
}

declare global {
    namespace Express {
        interface Request {
            user?: AccessTokenPayload;
            platformAdmin?: PlatformAdminTokenPayload;
        }
    }
}
