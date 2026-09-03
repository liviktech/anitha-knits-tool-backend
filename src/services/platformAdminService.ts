import jwt from 'jsonwebtoken';
import { isUniqueViolation } from '../db/errors.js';
import {
    countPlatformAdmins,
    createPlatformAdmin,
    findPlatformAdminByMobile,
    updatePasswordHash,
} from '../repositories/platformAdmin.repository.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { comparePassword, dummyPasswordHash, hashPassword } from '../utils/password.js';
import { signPlatformAdminAccessToken, signPlatformAdminRefreshToken } from '../utils/platformAdminJwt.js';
import { env } from '../config/env.js';
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
 * unrestricted) first, falling back to a Livik employee's own credentials (checked against the
 * separate Livik database, see config/livikDb.ts) for anyone the super admin has explicitly
 * granted LK Space access to. Time: O(1); Space: O(1).
 *
 * TODO(platform-rbac-pg-migration): the platform_employee_access table doesn't exist yet (see
 * platformRoleAccessService.ts), so no Livik employee can currently be granted access — every
 * employee login correctly falls through to PLATFORM_ACCESS_NOT_GRANTED below until that lands.
 */
export async function loginPlatformAdmin(input: PlatformAdminLoginInput) {
    const admin = await findPlatformAdminByMobile(input.mobile);

    if (admin) {
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

    const employee = await findLivikEmployeeByPhone(input.mobile);
    if (!employee || !employee.password) {
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
