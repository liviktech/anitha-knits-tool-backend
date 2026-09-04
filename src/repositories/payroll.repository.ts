import type pg from 'pg';
import { query } from '../db/query.js';

export interface MarketValueDistributionRow {
    id: string;
    companyId: string;
    effectiveDate: Date;
    totalPool: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

export async function insertMarketValueDistribution(
    client: pg.PoolClient,
    input: { companyId: string; effectiveDate: Date; totalPool: number; actor: string },
): Promise<MarketValueDistributionRow> {
    const result = await client.query<MarketValueDistributionRow>(
        `INSERT INTO market_value_distributions (id, company_id, effective_date, total_pool, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
         RETURNING id, company_id AS "companyId", effective_date AS "effectiveDate", total_pool AS "totalPool",
                   created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"`,
        [input.companyId, input.effectiveDate, input.totalPool, input.actor],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into market_value_distributions returned no row');
    return row;
}

export async function insertMarketValueAllocations(
    client: pg.PoolClient,
    distributionId: string,
    allocations: { employeeId: string; amount: number }[],
): Promise<void> {
    if (allocations.length === 0) return;
    const values: string[] = [];
    const params: unknown[] = [];
    for (const alloc of allocations) {
        params.push(distributionId, alloc.employeeId, alloc.amount);
        const base = params.length - 3;
        values.push(`(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, now())`);
    }
    await query(`INSERT INTO market_value_allocations (id, distribution_id, employee_id, amount, updated_at) VALUES ${values.join(', ')}`, params, client);
}

export interface SalaryAdvanceRow {
    id: string;
    companyId: string;
    employeeId: string;
    amount: number;
    effectiveDate: Date;
    repaymentMethod: string;
    totalMonths: number | null;
    emiAmount: number | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

export async function insertSalaryAdvance(input: {
    companyId: string;
    employeeId: string;
    amount: number;
    effectiveDate: Date;
    repaymentMethod: string;
    totalMonths: number | null;
    emiAmount: number | null;
    actor: string;
}): Promise<SalaryAdvanceRow> {
    const result = await query<SalaryAdvanceRow>(
        `INSERT INTO salary_advances (id, company_id, employee_id, amount, effective_date, repayment_method, total_months, emi_amount, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now())
         RETURNING id, company_id AS "companyId", employee_id AS "employeeId", amount, effective_date AS "effectiveDate",
                   repayment_method AS "repaymentMethod", total_months AS "totalMonths", emi_amount AS "emiAmount",
                   created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"`,
        [input.companyId, input.employeeId, input.amount, input.effectiveDate, input.repaymentMethod, input.totalMonths, input.emiAmount, input.actor],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into salary_advances returned no row');
    return row;
}

export interface SalaryAdvanceWithEmployeeRow extends SalaryAdvanceRow {
    employeeName: string | null;
    customUserId: string | null;
}

export async function findSalaryAdvancesWithEmployee(companyId: string): Promise<SalaryAdvanceWithEmployeeRow[]> {
    const result = await query<SalaryAdvanceWithEmployeeRow>(
        `SELECT sa.id, sa.company_id AS "companyId", sa.employee_id AS "employeeId", sa.amount, sa.effective_date AS "effectiveDate",
                sa.repayment_method AS "repaymentMethod", sa.total_months AS "totalMonths", sa.emi_amount AS "emiAmount",
                sa.created_at AS "createdAt", sa.created_by AS "createdBy", sa.updated_at AS "updatedAt", sa.updated_by AS "updatedBy",
                u.name AS "employeeName", ed.custom_user_id AS "customUserId"
         FROM salary_advances sa
         JOIN users u ON u.id = sa.employee_id
         LEFT JOIN employee_details ed ON ed.user_id = u.id
         WHERE sa.company_id = $1
         ORDER BY sa.effective_date DESC`,
        [companyId],
    );
    return result.rows;
}

export async function findAllSalaryAdvances(companyId: string): Promise<SalaryAdvanceRow[]> {
    const result = await query<SalaryAdvanceRow>(
        `SELECT id, company_id AS "companyId", employee_id AS "employeeId", amount, effective_date AS "effectiveDate",
                repayment_method AS "repaymentMethod", total_months AS "totalMonths", emi_amount AS "emiAmount",
                created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"
         FROM salary_advances WHERE company_id = $1`,
        [companyId],
    );
    return result.rows;
}

export interface MarketValueDeductionRow {
    id: string;
    companyId: string;
    employeeId: string;
    amount: number;
    effectiveDate: Date;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

export async function insertMarketValueDeduction(input: {
    companyId: string;
    employeeId: string;
    amount: number;
    effectiveDate: Date;
    actor: string;
}): Promise<MarketValueDeductionRow> {
    const result = await query<MarketValueDeductionRow>(
        `INSERT INTO market_value_deductions (id, company_id, employee_id, amount, effective_date, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())
         RETURNING id, company_id AS "companyId", employee_id AS "employeeId", amount, effective_date AS "effectiveDate",
                   created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"`,
        [input.companyId, input.employeeId, input.amount, input.effectiveDate, input.actor],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into market_value_deductions returned no row');
    return row;
}

export async function findAllMarketValueDeductions(companyId: string): Promise<MarketValueDeductionRow[]> {
    const result = await query<MarketValueDeductionRow>(
        `SELECT id, company_id AS "companyId", employee_id AS "employeeId", amount, effective_date AS "effectiveDate",
                created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"
         FROM market_value_deductions WHERE company_id = $1`,
        [companyId],
    );
    return result.rows;
}

export interface ActiveEmployeeWithSalaryRow {
    id: string;
    name: string | null;
    salary: number | null;
    customUserId: string | null;
}

export async function findActiveEmployeesWithSalary(companyId: string): Promise<ActiveEmployeeWithSalaryRow[]> {
    const result = await query<ActiveEmployeeWithSalaryRow>(
        `SELECT u.id, u.name, ed.salary, ed.custom_user_id AS "customUserId"
         FROM users u
         LEFT JOIN employee_details ed ON ed.user_id = u.id
         WHERE u.company_id = $1 AND u.is_active = true`,
        [companyId],
    );
    return result.rows;
}

export interface AttendanceForPayrollRow {
    employeeId: string;
    date: Date;
    status: string;
}

export async function findAttendancesForRange(companyId: string, startDate: Date, endDate: Date): Promise<AttendanceForPayrollRow[]> {
    const result = await query<AttendanceForPayrollRow>(
        `SELECT employee_id AS "employeeId", date, status FROM attendances WHERE company_id = $1 AND date >= $2 AND date <= $3`,
        [companyId, startDate, endDate],
    );
    return result.rows;
}

export interface MarketValueAllocationRow {
    employeeId: string;
    amount: number;
}

export async function findMarketValueAllocationsForRange(companyId: string, startDate: Date, endDate: Date): Promise<MarketValueAllocationRow[]> {
    const result = await query<MarketValueAllocationRow>(
        `SELECT a.employee_id AS "employeeId", a.amount
         FROM market_value_allocations a
         JOIN market_value_distributions d ON d.id = a.distribution_id
         WHERE d.company_id = $1 AND d.effective_date >= $2 AND d.effective_date <= $3`,
        [companyId, startDate, endDate],
    );
    return result.rows;
}

export async function deletePayrollRecords(client: pg.PoolClient, companyId: string, month: number, year: number): Promise<void> {
    await client.query('DELETE FROM payroll_records WHERE company_id = $1 AND month = $2 AND year = $3', [companyId, month, year]);
}

export interface PayrollRecordInput {
    companyId: string;
    employeeId: string;
    month: number;
    year: number;
    baseSalary: number;
    totalDaysInMonth: number;
    daysWorked: number;
    lopDeduction: number;
    advanceDeduction: number;
    sundayBonuses: number;
    marketValueBonus: number;
    marketValueDeduction: number;
    grossSalary: number;
    netSalary: number;
}

export async function insertPayrollRecords(client: pg.PoolClient, records: PayrollRecordInput[]): Promise<void> {
    if (records.length === 0) return;
    const values: string[] = [];
    const params: unknown[] = [];
    for (const r of records) {
        params.push(
            r.companyId,
            r.employeeId,
            r.month,
            r.year,
            r.baseSalary,
            r.totalDaysInMonth,
            r.daysWorked,
            r.lopDeduction,
            r.advanceDeduction,
            r.sundayBonuses,
            r.marketValueBonus,
            r.marketValueDeduction,
            r.grossSalary,
            r.netSalary,
        );
        const base = params.length - 14;
        values.push(
            `(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, 'PENDING', now())`,
        );
    }
    await client.query(
        `INSERT INTO payroll_records (
            id, company_id, employee_id, month, year, base_salary, total_days_in_month, days_worked,
            lop_deduction, advance_deduction, sunday_bonuses, market_value_bonus, market_value_deduction, gross_salary, net_salary, status, updated_at
         ) VALUES ${values.join(', ')}`,
        params,
    );
}

export interface UpsertPayrollRecordInput {
    companyId: string;
    employeeId: string;
    month: number;
    year: number;
    baseSalary: number;
    totalDaysInMonth: number;
    daysWorked: number;
    advanceDeduction: number;
    marketValueBonus: number;
    grossSalary: number;
    netSalary: number;
}

/**
 * Manual single-employee edit from the Payroll tab's Actions > Edit. Upserts on
 * (employee_id, month, year) — if no row exists yet for this month (payroll not
 * generated), inserts one with lop_deduction/sunday_bonuses/market_value_deduction
 * defaulted to 0 (this quick edit only knows base salary, days worked, advance,
 * and machine value); if a generated row already exists, those three untouched
 * columns keep whatever savePayrollRecords last computed for them.
 */
export async function upsertPayrollRecord(input: UpsertPayrollRecordInput): Promise<PayrollRecordRow> {
    const result = await query<PayrollRecordRow>(
        `INSERT INTO payroll_records (
            id, company_id, employee_id, month, year, base_salary, total_days_in_month, days_worked,
            lop_deduction, advance_deduction, sunday_bonuses, market_value_bonus, market_value_deduction,
            gross_salary, net_salary, status, updated_at
         ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 0, $8, 0, $9, 0, $10, $11, 'PENDING', now())
         ON CONFLICT (employee_id, month, year) DO UPDATE SET
            base_salary = EXCLUDED.base_salary,
            days_worked = EXCLUDED.days_worked,
            advance_deduction = EXCLUDED.advance_deduction,
            market_value_bonus = EXCLUDED.market_value_bonus,
            gross_salary = EXCLUDED.gross_salary,
            net_salary = EXCLUDED.net_salary,
            updated_at = now()
         RETURNING id, company_id AS "companyId", employee_id AS "employeeId", month, year, base_salary AS "baseSalary",
                   total_days_in_month AS "totalDaysInMonth", days_worked AS "daysWorked", lop_deduction AS "lopDeduction",
                   advance_deduction AS "advanceDeduction", sunday_bonuses AS "sundayBonuses", market_value_bonus AS "marketValueBonus",
                   market_value_deduction AS "marketValueDeduction",
                   gross_salary AS "grossSalary", net_salary AS "netSalary", status, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
            input.companyId,
            input.employeeId,
            input.month,
            input.year,
            input.baseSalary,
            input.totalDaysInMonth,
            input.daysWorked,
            input.advanceDeduction,
            input.marketValueBonus,
            input.grossSalary,
            input.netSalary,
        ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Upsert into payroll_records returned no row');
    return row;
}

export interface PayrollRecordRow {
    id: string;
    companyId: string;
    employeeId: string;
    month: number;
    year: number;
    baseSalary: number;
    totalDaysInMonth: number;
    daysWorked: number;
    lopDeduction: number;
    advanceDeduction: number;
    sundayBonuses: number;
    marketValueBonus: number;
    marketValueDeduction: number;
    grossSalary: number;
    netSalary: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export async function findSavedPayrollRecords(companyId: string, month: number, year: number): Promise<PayrollRecordRow[]> {
    const result = await query<PayrollRecordRow>(
        `SELECT id, company_id AS "companyId", employee_id AS "employeeId", month, year, base_salary AS "baseSalary",
                total_days_in_month AS "totalDaysInMonth", days_worked AS "daysWorked", lop_deduction AS "lopDeduction",
                advance_deduction AS "advanceDeduction", sunday_bonuses AS "sundayBonuses", market_value_bonus AS "marketValueBonus",
                market_value_deduction AS "marketValueDeduction",
                gross_salary AS "grossSalary", net_salary AS "netSalary", status, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM payroll_records WHERE company_id = $1 AND month = $2 AND year = $3`,
        [companyId, month, year],
    );
    return result.rows;
}
