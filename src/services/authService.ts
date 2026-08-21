import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import type { SignupInput } from '../validations/authValidation.js';

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
