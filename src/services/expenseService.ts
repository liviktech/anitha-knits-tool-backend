import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreateExpenseInput, UpdateExpenseInput, ListExpenseQuery } from '../validations/expenseValidation.js';

const expenseSelect = {
    id: true,
    expenseId: true,
    date: true,
    expenseName: true,
    amount: true,
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.ExpenseSelect;

type ExpenseRow = Prisma.ExpenseGetPayload<{ select: typeof expenseSelect }>;

function mapExpenseRecord(record: ExpenseRow) {
    return { ...record, amount: record.amount.toNumber() };
}

const EXPENSE_ID_PATTERN = /^EXP-(\d+)$/;

/**
 * Next sequential id for this company, e.g. EXP-001, EXP-002. Scans all
 * existing ids (not just the latest by date/createdAt) so a deleted or
 * out-of-order row never causes a number to be skipped or reused low.
 * Runs inside the caller's transaction to keep the read-then-insert as tight
 * as this app's low-concurrency usage warrants.
 */
async function generateExpenseId(companyId: string, tx: Prisma.TransactionClient): Promise<string> {
    const rows = await tx.expense.findMany({
        where: { companyId },
        select: { expenseId: true },
    });

    let max = 0;
    for (const { expenseId } of rows) {
        const match = EXPENSE_ID_PATTERN.exec(expenseId);
        if (match) max = Math.max(max, parseInt(match[1], 10));
    }

    return `EXP-${String(max + 1).padStart(3, '0')}`;
}

export async function createExpense(input: CreateExpenseInput, companyId: string, actor: string) {
    const record = await prisma.$transaction(async (tx) => {
        const expenseId = await generateExpenseId(companyId, tx);
        return tx.expense.create({
            data: {
                companyId,
                expenseId,
                date: input.date ?? new Date(),
                expenseName: input.expenseName,
                amount: input.amount,
                createdBy: actor,
            },
            select: expenseSelect,
        });
    });

    return mapExpenseRecord(record);
}

export async function listExpenses(query: ListExpenseQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.ExpenseWhereInput = {
        companyId,
        ...(query.date_from || query.date_to
            ? {
                date: {
                    ...(query.date_from ? { gte: query.date_from } : {}),
                    ...(query.date_to ? { lte: query.date_to } : {}),
                },
            }
            : {}),
        ...(query.name ? { expenseName: { contains: query.name, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.expense.findMany({
            where,
            select: expenseSelect,
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            skip,
            take,
        }),
        prisma.expense.count({ where }),
    ]);

    return {
        items: rows.map(mapExpenseRecord),
        meta: toPageMeta(query, total),
    };
}

export async function getExpenseById(id: string, companyId: string) {
    const record = await prisma.expense.findFirst({
        where: { id, companyId },
        select: expenseSelect,
    });
    if (!record) throw new NotFoundError('Expense not found', 'EXPENSE_NOT_FOUND', { id });
    return mapExpenseRecord(record);
}

export async function updateExpense(id: string, input: UpdateExpenseInput, companyId: string, actor: string) {
    const existing = await prisma.expense.findFirst({
        where: { id, companyId },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Expense not found', 'EXPENSE_NOT_FOUND', { id });

    const record = await prisma.expense.update({
        where: { id },
        data: {
            ...(input.date !== undefined ? { date: input.date } : {}),
            ...(input.expenseName !== undefined ? { expenseName: input.expenseName } : {}),
            ...(input.amount !== undefined ? { amount: input.amount } : {}),
            updatedBy: actor,
        },
        select: expenseSelect,
    });

    return mapExpenseRecord(record);
}

export async function deleteExpense(id: string, companyId: string) {
    const existing = await prisma.expense.findFirst({
        where: { id, companyId },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Expense not found', 'EXPENSE_NOT_FOUND', { id });

    await prisma.expense.delete({ where: { id } });
}
