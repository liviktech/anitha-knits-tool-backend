import jwt from 'jsonwebtoken';
import { isUniqueViolation } from '../db/errors.js';
import {
    countPlatformAdmins,
    createPlatformAdmin,
    findPlatformAdminByMobile,
    findPlatformAdminById,
    updatePasswordHash,
} from '../repositories/platformAdmin.repository.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { comparePassword, dummyPasswordHash, hashPassword } from '../utils/password.js';
import { signPlatformAdminAccessToken, signPlatformAdminRefreshToken } from '../utils/platformAdminJwt.js';
import { env } from '../config/env.js';
import type { PlatformAdminRole } from '../types/auth.js';
import type { PlatformAdminLoginInput, PlatformAdminSignupInput } from '../validations/platformAdminValidation.js';

/** Claims signed by otpService.issueResetToken and expected here. */
interface ResetTokenPayload {
    mobile: string;
    actorType: 'COMPANY_USER' | 'PLATFORM_ADMIN';
    purpose: 'password_reset';
}

/**
 * Registers the platform's one super-admin. One-time bootstrap: once a PlatformAdmin
 * row exists, this always rejects — there is no public, unbounded way to become one.
 * Time: O(1); Space: O(1).
 */
export async function signupPlatformAdmin(input: PlatformAdminSignupInput) {
    const existingCount = await countPlatformAdmins();
    if (existingCount > 0) {
        throw new ConflictError('A platform admin already exists', 'PLATFORM_ADMIN_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);

    try {
        return await createPlatformAdmin({ name: input.name, mobile: input.mobile, passwordHash });
    } catch (err) {
        if (isUniqueViolation(err)) {
            throw new ConflictError('A platform admin already exists', 'PLATFORM_ADMIN_ALREADY_EXISTS');
        }
        throw err;
    }
}

/**
 * Authenticates against the LK Space session — the seeded PlatformAdmin (SUPER_ADMIN, always
 * unrestricted). Time: O(1); Space: O(1).
 *
 * TODO(platform-rbac-pg-migration): a Livik-employee login fallback (checked against the
 * separate Livik database, granted LK Space access via a platform_employee_access row) used to
 * live here — dropped because platform_employee_access doesn't exist yet (see
 * platformRoleAccessService.ts). Reintroduce it once that table + repository layer exist.
 */
export async function loginPlatformAdmin(input: PlatformAdminLoginInput) {
    const admin = await findPlatformAdminByMobile(input.mobile);

    if (!admin) {
        // No real hash to check against — compare against a dummy one so this path
        // takes about as long as the real-candidate path (timing side-channel mitigation).
        await comparePassword(input.password, dummyPasswordHash);
        throw new UnauthorizedError('Invalid mobile number or password', 'INVALID_CREDENTIALS');
    }

    if (!(await comparePassword(input.password, admin.passwordHash))) {
        throw new UnauthorizedError('Invalid mobile number or password', 'INVALID_CREDENTIALS');
    }
    if (!admin.isActive) {
        throw new ForbiddenError('This account is inactive', 'ACCOUNT_INACTIVE');
    }

    const payload = { sub: admin.id, role: admin.role, mobile: admin.mobile };
    return {
        tokens: {
            accessToken: signPlatformAdminAccessToken(payload),
            refreshToken: signPlatformAdminRefreshToken(payload),
        },
        admin: { id: admin.id, name: admin.name, mobile: admin.mobile, role: admin.role as PlatformAdminRole, isActive: admin.isActive },
        access: null, // SUPER_ADMIN is always unrestricted — resolvePlatformAccess's own convention
    };
}

/**
 * Re-resolves the current LK Space session's profile from scratch — used by GET
 * /platform/admin/me so an already-logged-in session reflects any change (e.g. deactivation)
 * without forcing logout, mirroring the company-side getCurrentUser. SUPER_ADMIN only for now —
 * see the TODO on loginPlatformAdmin above.
 */
export async function getCurrentPlatformAdmin(_role: PlatformAdminRole, sub: string) {
    const admin = await findPlatformAdminById(sub);
    if (!admin) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    return {
        admin: { id: admin.id, name: admin.name, mobile: admin.mobile, role: admin.role as PlatformAdminRole, isActive: admin.isActive },
        access: null,
    };
}

/**
 * Issues a session for a platform-admin mobile whose OTP the caller has already verified
 * (otpService.verifyOtp with purpose: 'LOGIN', actorType: 'PLATFORM_ADMIN'). No ambiguity branch
 * needed — platform_admins.mobile is globally unique, unlike company-user mobiles.
 * Time: O(1); Space: O(1).
 */
export async function loginPlatformAdminWithOtp(mobile: string) {
    const admin = await findPlatformAdminByMobile(mobile);
    if (!admin) {
        throw new UnauthorizedError('Invalid mobile number or password', 'INVALID_CREDENTIALS');
    }
    if (!admin.isActive) {
        throw new ForbiddenError('This account is inactive', 'ACCOUNT_INACTIVE');
    }

    const payload = { sub: admin.id, role: admin.role, mobile: admin.mobile };
    const tokens = {
        accessToken: signPlatformAdminAccessToken(payload),
        refreshToken: signPlatformAdminRefreshToken(payload),
    };

    return {
        tokens,
        admin: { id: admin.id, name: admin.name, mobile: admin.mobile, role: admin.role, isActive: admin.isActive },
    };
}

/**
 * Completes the platform-admin forgot-password flow: verifies the short-lived resetToken issued
 * right after a successful RESET_PASSWORD OTP verify, re-resolves the admin by mobile, and
 * overwrites its password hash. Time: O(1); Space: O(1).
 */
export async function resetPlatformAdminPassword(mobile: string, resetToken: string, newPassword: string): Promise<void> {
    let payload: ResetTokenPayload;
    try {
        payload = jwt.verify(resetToken, env.RESET_TOKEN_SECRET) as ResetTokenPayload;
    } catch {
        throw new UnauthorizedError('Invalid or expired reset token', 'RESET_TOKEN_INVALID');
    }
    if (payload.mobile !== mobile || payload.purpose !== 'password_reset' || payload.actorType !== 'PLATFORM_ADMIN') {
        throw new UnauthorizedError('Invalid or expired reset token', 'RESET_TOKEN_INVALID');
    }

    const admin = await findPlatformAdminByMobile(mobile);
    if (!admin) {
        throw new UnauthorizedError('Invalid or expired reset token', 'RESET_TOKEN_INVALID');
    }
    if (!admin.isActive) {
        throw new ForbiddenError('This account is inactive', 'ACCOUNT_INACTIVE');
    }

    const passwordHash = await hashPassword(newPassword);
    await updatePasswordHash(admin.id, passwordHash);
}
