import { isUniqueViolation } from '../db/errors.js';
import { countPlatformAdmins, createPlatformAdmin, findPlatformAdminByMobile } from '../repositories/platformAdmin.repository.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { comparePassword, dummyPasswordHash, hashPassword } from '../utils/password.js';
import { signPlatformAdminAccessToken, signPlatformAdminRefreshToken } from '../utils/platformAdminJwt.js';
import type { PlatformAdminLoginInput, PlatformAdminSignupInput } from '../validations/platformAdminValidation.js';

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

/** Authenticates a platform admin by mobile + password. Time: O(1); Space: O(1). */
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
    const tokens = {
        accessToken: signPlatformAdminAccessToken(payload),
        refreshToken: signPlatformAdminRefreshToken(payload),
    };

    return {
        tokens,
        admin: { id: admin.id, name: admin.name, mobile: admin.mobile, role: admin.role, isActive: admin.isActive },
    };
}
