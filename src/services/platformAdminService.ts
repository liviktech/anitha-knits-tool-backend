import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { livikPool } from '../config/livikDb.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { comparePassword, dummyPasswordHash, hashPassword } from '../utils/password.js';
import { signPlatformAdminAccessToken, signPlatformAdminRefreshToken } from '../utils/platformAdminJwt.js';
import { resolvePlatformAccess } from './platformRoleAccessService.js';
import type { PlatformAdminRole } from '../types/auth.js';
import type { PlatformAdminLoginInput, PlatformAdminSignupInput } from '../validations/platformAdminValidation.js';

interface LivikEmployeeAuthRow {
    id: string;
    empId: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    password: string | null;
    isActive: boolean;
}

/** Looks up a Livik employee by phone number for LK Space login — see config/livikDb.ts. */
async function findLivikEmployeeByPhone(phoneNumber: string): Promise<LivikEmployeeAuthRow | null> {
    const result = await livikPool.query<LivikEmployeeAuthRow>(
        `SELECT "id", "empId", "firstName", "lastName", "phoneNumber", "password", "isActive"
         FROM "Employee"
         WHERE "phoneNumber" = $1
         LIMIT 1`,
        [phoneNumber],
    );
    return result.rows[0] ?? null;
}

/** Looks up a Livik employee by their stable empId — used to re-resolve an EMPLOYEE session's profile (GET /me) from the JWT's `sub` claim. */
async function findLivikEmployeeByEmpId(empId: string): Promise<LivikEmployeeAuthRow | null> {
    const result = await livikPool.query<LivikEmployeeAuthRow>(
        `SELECT "id", "empId", "firstName", "lastName", "phoneNumber", "password", "isActive"
         FROM "Employee"
         WHERE "empId" = $1
         LIMIT 1`,
        [empId],
    );
    return result.rows[0] ?? null;
}

const platformAdminSelect = {
    id: true,
    name: true,
    mobile: true,
    role: true,
    isActive: true,
    createdAt: true,
} satisfies Prisma.PlatformAdminSelect;

/**
 * Registers the platform's one super-admin. One-time bootstrap: once a PlatformAdmin
 * row exists, this always rejects — there is no public, unbounded way to become one.
 * Time: O(1); Space: O(1).
 */
export async function signupPlatformAdmin(input: PlatformAdminSignupInput) {
    const existingCount = await prisma.platformAdmin.count();
    if (existingCount > 0) {
        throw new ConflictError('A platform admin already exists', 'PLATFORM_ADMIN_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);

    try {
        return await prisma.platformAdmin.create({
            data: { name: input.name, mobile: input.mobile, passwordHash },
            select: platformAdminSelect,
        });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new ConflictError('A platform admin already exists', 'PLATFORM_ADMIN_ALREADY_EXISTS');
        }
        throw err;
    }
}

/**
 * Authenticates against the LK Space session — the seeded PlatformAdmin (SUPER_ADMIN, always
 * unrestricted) first, falling back to a Livik employee's own credentials (checked against the
 * separate Livik database, see config/livikDb.ts) for anyone the super admin has explicitly
 * granted a PlatformEmployeeAccess row to. Time: O(1); Space: O(1).
 */
export async function loginPlatformAdmin(input: PlatformAdminLoginInput) {
    const admin = await prisma.platformAdmin.findUnique({
        where: { mobile: input.mobile },
        select: { ...platformAdminSelect, passwordHash: true },
    });

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

    if (!(await comparePassword(input.password, employee.password))) {
        throw new UnauthorizedError('Invalid mobile number or password', 'INVALID_CREDENTIALS');
    }
    if (!employee.isActive) {
        throw new ForbiddenError('This account is inactive', 'ACCOUNT_INACTIVE');
    }

    const employeeAccess = await prisma.platformEmployeeAccess.findUnique({
        where: { livikEmpId: employee.empId },
        select: { isActive: true },
    });
    if (!employeeAccess || !employeeAccess.isActive) {
        // Being a Livik employee is not enough on its own — LK Space access is an explicit
        // allow-list grant made from the Users page, not automatic.
        throw new ForbiddenError('You have not been granted access to LK Space', 'PLATFORM_ACCESS_NOT_GRANTED');
    }

    const payload = { sub: employee.empId, role: 'EMPLOYEE' as PlatformAdminRole, mobile: employee.phoneNumber ?? input.mobile };
    const access = await resolvePlatformAccess('EMPLOYEE', employee.empId);

    return {
        tokens: {
            accessToken: signPlatformAdminAccessToken(payload),
            refreshToken: signPlatformAdminRefreshToken(payload),
        },
        admin: {
            id: employee.empId,
            name: `${employee.firstName} ${employee.lastName}`.trim(),
            mobile: employee.phoneNumber ?? input.mobile,
            role: 'EMPLOYEE' as PlatformAdminRole,
            isActive: true,
        },
        access,
    };
}

/**
 * Re-resolves the current LK Space session's profile + access from scratch — used by GET
 * /platform/admin/me so a role change reaches an already-logged-in employee session without
 * forcing logout, mirroring the company-side getCurrentUser.
 */
export async function getCurrentPlatformAdmin(role: PlatformAdminRole, sub: string) {
    if (role === 'SUPER_ADMIN') {
        const admin = await prisma.platformAdmin.findUnique({ where: { id: sub }, select: platformAdminSelect });
        if (!admin) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
        return { admin: { id: admin.id, name: admin.name, mobile: admin.mobile, role: admin.role as PlatformAdminRole, isActive: admin.isActive }, access: null };
    }

    const employee = await findLivikEmployeeByEmpId(sub);
    if (!employee) {
        throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    }
    const access = await resolvePlatformAccess('EMPLOYEE', employee.empId);
    return {
        admin: {
            id: employee.empId,
            name: `${employee.firstName} ${employee.lastName}`.trim(),
            mobile: employee.phoneNumber ?? '',
            role: 'EMPLOYEE' as PlatformAdminRole,
            isActive: employee.isActive,
        },
        access,
    };
}
