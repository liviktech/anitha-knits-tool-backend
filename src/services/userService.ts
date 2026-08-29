import { Prisma } from '@prisma/client';

/**
 * Shared helpers used by both authService.signupCompany (creates the first ADMIN) and
 * employeeService (creates EMPLOYEE/MANAGER/SUPERVISOR users) — the managed-user CRUD that
 * used to live in this file (createManagedUser, listUsers, etc., backing the now-removed
 * /company/user routes) was consolidated into employeeService.ts, since it had zero frontend
 * callers and the two code paths were near-duplicates of each other.
 */

export const employeeDetailsSelect = {
    customUserId: true,
    designation: true,
    address: true,
    gender: true,
    salary: true,
    joiningDate: true,
    aadhaarDocumentUrl: true,
    documentName: true,
    aadhaarDocumentUploadedAt: true,
} satisfies Prisma.EmployeeDetailsSelect;

/**
 * Atomically assigns the next customUserId for a company: companyCode + a
 * zero-padded sequence (e.g. "AK001" + "001"). Reads `employeeSeq` as a
 * counter, not a row count, so a later-deleted user/employeeDetails row can
 * never cause a number to be reissued. Must run inside the same transaction
 * as the User/EmployeeDetails create it backs, so a failed create can't
 * "burn" a sequence number that's then unaccounted for.
 * Time: O(1) — one row update, serialized by Postgres row-level locking under concurrent callers.
 */
export async function nextCustomUserId(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const company = await tx.company.update({
        where: { id: companyId },
        data: { employeeSeq: { increment: 1 } },
        select: { companyCode: true, employeeSeq: true },
    });
    const seq = company.employeeSeq - 1;
    return `EMP-${String(seq).padStart(3, '0')}`;
}

export type EmployeeDetailsRow = Prisma.EmployeeDetailsGetPayload<{ select: typeof employeeDetailsSelect }>;

/** Prisma Decimal isn't JSON-safe as a number — convert salary explicitly, matching the rest of the codebase's Decimal handling. */
export function mapEmployeeDetails(details: EmployeeDetailsRow | null) {
    if (!details) return null;
    return { ...details, salary: details.salary ? details.salary.toNumber() : null };
}

export function withMappedEmployeeDetails<T extends { employeeDetails: EmployeeDetailsRow | null }>(user: T) {
    return { ...user, employeeDetails: mapEmployeeDetails(user.employeeDetails) };
}
