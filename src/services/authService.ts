import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { comparePassword, dummyPasswordHash, hashPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import type { TokenPayload } from '../types/auth.js';
import type { LoginInput, SignupInput } from '../validations/authValidation.js';

const companySelect = {
    id: true,
    name: true,
    address: true,
    gst: true,
    adminMobile: true,
    companyCode: true,
    isActive: true,
    createdAt: true,
} satisfies Prisma.CompanySelect;

const adminUserSelect = {
    id: true,
    companyId: true,
    name: true,
    mobile: true,
    role: true,
    isActive: true,
    createdAt: true,
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

            const admin = await tx.user.create({
                data: {
                    companyId: company.id,
                    name: input.adminName,
                    mobile: input.adminMobile,
                    passwordHash,
                    role: 'ADMIN',
                },
                select: adminUserSelect,
            });

            return { company, admin };
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
