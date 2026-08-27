import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.js';
import { comparePassword, dummyPasswordHash, hashPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { employeeDetailsSelect, nextCustomUserId, withMappedEmployeeDetails } from './userService.js';
import type { TokenPayload } from '../types/auth.js';
import type {
    LoginInput,
    ListCompaniesQuery,
    ListCompanyUsersQuery,
    SignupInput,
    UpdateCompanyInput,
} from '../validations/authValidation.js';

const companySelect = {
    id: true,
    name: true,
    address: true,
    gst: true,
    adminMobile: true,
    companyCode: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.CompanySelect;

const adminUserSelect = {
    id: true,
    companyId: true,
    name: true,
    mobile: true,
    role: true,
    isActive: true,
    createdAt: true,
    employeeDetails: { select: employeeDetailsSelect },
} satisfies Prisma.UserSelect;

/** Maps a Prisma unique-constraint violation on Company to the field that caused it. */
function mapUniqueConstraintError(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;

    // With the @prisma/adapter-pg driver adapter, the violated column(s) live under
    // meta.driverAdapterError.cause.constraint.fields rather than the classic meta.target.
    const meta = err.meta as
        | { target?: string[] | string; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
        | undefined;
    const columns = meta?.driverAdapterError?.cause?.constraint?.fields ?? (
        Array.isArray(meta?.target) ? meta.target : meta?.target ? [meta.target] : []
    );

    if (columns.includes('company_code')) {
        throw new ConflictError('A company with this companyCode already exists', 'COMPANY_CODE_EXISTS');
    }
    if (columns.includes('admin_mobile')) {
        throw new ConflictError('A company with this adminMobile already exists', 'COMPANY_MOBILE_EXISTS');
    }
    if (columns.includes('gst')) {
        throw new ConflictError('A company with this gst already exists', 'COMPANY_GST_EXISTS');
    }
    throw new ConflictError('Company already exists', 'COMPANY_ALREADY_EXISTS');
}

/**
 * Creates a Company and its first ADMIN User in one transaction (PRD: company
 * signup → admin credentials → ADMIN user). Time: O(1); Space: O(1).
 */
export async function signupCompany(input: SignupInput) {
    const passwordHash = await hashPassword(input.adminPassword);

    try {
        return await prisma.$transaction(async (tx) => {
            const company = await tx.company.create({
                data: {
                    name: input.companyName,
                    address: input.companyAddress,
                    gst: input.gst,
                    adminMobile: input.adminMobile,
                    adminPasswordHash: passwordHash,
                    companyCode: input.companyCode,
                },
                select: companySelect,
            });

            // First user of a brand-new company — employeeSeq starts at 1, so this is always "001".
            const customUserId = await nextCustomUserId(tx, company.id);

            const admin = await tx.user.create({
                data: {
                    companyId: company.id,
                    name: input.adminName,
                    mobile: input.adminMobile,
                    passwordHash,
                    role: 'ADMIN',
                    employeeDetails: { create: { customUserId } },
                },
                select: adminUserSelect,
            });

            return { company, admin: withMappedEmployeeDetails(admin) };
        });
    } catch (err) {
        mapUniqueConstraintError(err);
        throw err;
    }
}

const loginCandidateSelect = {
    id: true,
    companyId: true,
    name: true,
    mobile: true,
    passwordHash: true,
    role: true,
    isActive: true,
    company: { select: { id: true, name: true, companyCode: true, isActive: true } },
} satisfies Prisma.UserSelect;

type LoginCandidate = Prisma.UserGetPayload<{ select: typeof loginCandidateSelect }>;

/**
 * Authenticates by mobile + password. mobile is only unique per company
 * (@@unique([companyId, mobile])), not globally, so more than one User row can
 * share a mobile across different companies — every candidate's password hash
 * is checked, and login succeeds only if exactly one matches.
 * Time: O(n) bcrypt compares for n same-mobile accounts (n is always small); Space: O(n).
 */
export async function loginUser(input: LoginInput) {
    const candidates = await prisma.user.findMany({
        where: { mobile: input.mobile },
        select: loginCandidateSelect,
    });

    if (candidates.length === 0) {
        // No real hash to check against — compare against a dummy one so this path
        // takes about as long as the real-candidate path (see dummyPasswordHash above).
        await comparePassword(input.password, dummyPasswordHash);
        throw new UnauthorizedError('Invalid mobile number or password', 'INVALID_CREDENTIALS');
    }

    const matches: LoginCandidate[] = [];
    for (const candidate of candidates) {
        if (await comparePassword(input.password, candidate.passwordHash)) {
            matches.push(candidate);
        }
    }

    if (matches.length === 0) {
        throw new UnauthorizedError('Invalid mobile number or password', 'INVALID_CREDENTIALS');
    }
    if (matches.length > 1) {
        // Two different companies' users share this mobile AND this password — we
        // cannot safely pick one without more information (e.g. a company identifier).
        throw new ConflictError(
            'Multiple accounts match this mobile number; contact support to sign in',
            'AMBIGUOUS_LOGIN',
        );
    }

    const user = matches[0]!;
    if (!user.isActive || !user.company.isActive) {
        throw new ForbiddenError('This account is inactive', 'ACCOUNT_INACTIVE');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload: TokenPayload = { sub: user.id, role: user.role, companyId: user.companyId, mobile: user.mobile };
    const tokens = { accessToken: signAccessToken(payload), refreshToken: signRefreshToken(payload) };

    return {
        tokens,
        user: {
            id: user.id,
            companyId: user.companyId,
            name: user.name,
            mobile: user.mobile,
            role: user.role,
            isActive: user.isActive,
        },
        company: { id: user.company.id, name: user.company.name, companyCode: user.company.companyCode },
    };
}

/** Platform-admin: paginated, filterable list of every company. Time: O(limit); Space: O(limit). */
export async function listCompanies(query: ListCompaniesQuery) {
    const { skip, take } = toSkipTake(query);
    const where: Prisma.CompanyWhereInput = {
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.name ? { name: { contains: query.name, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.company.findMany({ where, select: companySelect, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.company.count({ where }),
    ]);

    return { items: rows, meta: toPageMeta(query, total) };
}

/** Platform-admin: fetch one company by id. Time: O(1); Space: O(1). */
export async function getCompanyById(id: string) {
    const company = await prisma.company.findUnique({ where: { id }, select: companySelect });
    if (!company) throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND', { id });
    return company;
}

/**
 * Platform-admin: partial update of a company's details. Deliberately excludes
 * adminPasswordHash — resetting a company's admin password belongs in its own
 * dedicated endpoint, not a generic PATCH. Time: O(1); Space: O(1).
 */
export async function updateCompany(id: string, input: UpdateCompanyInput) {
    const existing = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND', { id });

    try {
        return await prisma.company.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.address !== undefined ? { address: input.address } : {}),
                ...(input.gst !== undefined ? { gst: input.gst } : {}),
                ...(input.companyCode !== undefined ? { companyCode: input.companyCode } : {}),
                ...(input.adminMobile !== undefined ? { adminMobile: input.adminMobile } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            },
            select: companySelect,
        });
    } catch (err) {
        mapUniqueConstraintError(err);
        throw err;
    }
}

const companyUserSelect = {
    id: true,
    companyId: true,
    name: true,
    mobile: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.UserSelect;

/**
 * Platform-admin: paginated list of every user (all four roles, unlike the
 * tenant-side /company/user endpoint which excludes ADMIN/EMPLOYEE) for one
 * company. Time: O(limit); Space: O(limit).
 */
export async function listCompanyUsers(companyId: string, query: ListCompanyUsersQuery) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND', { id: companyId });

    const { skip, take } = toSkipTake(query);
    const where: Prisma.UserWhereInput = {
        companyId,
        ...(query.role ? { role: query.role } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.user.findMany({ where, select: companyUserSelect, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.user.count({ where }),
    ]);

    return { items: rows, meta: toPageMeta(query, total) };
}
