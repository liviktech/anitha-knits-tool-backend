import { withTransaction } from '../db/transaction.js';
import { ApiError } from '../utils/ApiError.js';
import {
    deletePayrollRecords,
    findActiveEmployeesWithSalary,
    findAllMarketValueDeductions,
    findAllSalaryAdvances,
    findAttendancesForRange,
    findMarketValueAllocationsForRange,
    findSalaryAdvancesWithEmployee,
    findSavedPayrollRecords as findSavedPayrollRecordsRepo,
    insertMarketValueAllocations,
    insertMarketValueDeduction,
    insertMarketValueDistribution,
    insertPayrollRecords,
    insertSalaryAdvance,
    upsertPayrollRecord,
} from '../repositories/payroll.repository.js';

export const distributeMarketValue = async (
    companyId: string,
    userId: string,
    data: { marketValueDate: string; totalPool: number; allocations: Record<string, number> }
) => {
    const effectiveDate = new Date(data.marketValueDate);

    // Validate sum
    const allocationEntries = Object.entries(data.allocations);
    const allocatedSum = allocationEntries.reduce((sum: number, [_, amt]: any) => sum + amt, 0);

    if (Math.abs(allocatedSum - data.totalPool) > 0.01) {
        throw new ApiError(400, 'Total pool does not match the sum of allocations');
    }

    return withTransaction(async (client) => {
        const distribution = await insertMarketValueDistribution(client, { companyId, effectiveDate, totalPool: data.totalPool, actor: userId });

        const allocationRecords = allocationEntries.map(([empId, amt]) => ({ employeeId: empId, amount: amt }));

        if (allocationRecords.length > 0) {
            await insertMarketValueAllocations(client, distribution.id, allocationRecords);
        }

        return distribution;
    });
};

export const grantMarketValueDeduction = async (
    companyId: string,
    userId: string,
    data: { employeeId: string; amount: number; effectiveDate: string }
) => {
    return insertMarketValueDeduction({
        companyId,
        employeeId: data.employeeId,
        amount: data.amount,
        effectiveDate: new Date(data.effectiveDate),
        actor: userId,
    });
};

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Number of calendar months from `from`'s month to (queryMonth, queryYear),
 * inclusive of `from`'s own month (offset 0). Negative if the query month is
 * before `from`. Used to figure out which month of an EMI schedule a given
 * payroll run falls on.
 */
function monthOffset(from: Date, queryMonth: number, queryYear: number): number {
    const fromMonth = from.getUTCMonth() + 1;
    const fromYear = from.getUTCFullYear();
    return (queryYear - fromYear) * 12 + (queryMonth - fromMonth);
}

export const grantSalaryAdvance = async (
    companyId: string,
    userId: string,
    data: { employeeId: string; amount: number; effectiveDate: string; repaymentMethod: 'single' | 'emi'; totalMonths?: number }
) => {
    const isEmi = data.repaymentMethod === 'emi';
    // Rounded once at creation so every month deducts the same fixed figure —
    // the alternative (re-dividing amount/totalMonths on every payroll run)
    // risks the last installment drifting from what earlier months already deducted.
    const emiAmount = isEmi ? roundMoney(data.amount / data.totalMonths!) : null;

    return insertSalaryAdvance({
        companyId,
        employeeId: data.employeeId,
        amount: data.amount,
        effectiveDate: new Date(data.effectiveDate),
        repaymentMethod: data.repaymentMethod,
        totalMonths: isEmi ? data.totalMonths! : null,
        emiAmount,
        actor: userId,
    });
};

/**
 * Every salary advance for the company, with EMI progress computed relative
 * to "now" — backs the Salary Advance tab's table. A single-payment advance
 * is "ACTIVE" only in its own effective month (that's the one payroll run
 * that deducts it) and "COMPLETED" after; an EMI advance is "ACTIVE" until
 * its last installment's month has passed.
 */
export const getSalaryAdvances = async (companyId: string) => {
    const advances = await findSalaryAdvancesWithEmployee(companyId);

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    return advances.map((adv: any) => {
        const isEmi = adv.repaymentMethod === 'emi' && adv.totalMonths != null;
        const totalMonths = isEmi ? adv.totalMonths : 1;
        const offset = monthOffset(adv.effectiveDate, currentMonth, currentYear);
        // Installments due so far: 0 before the effective month, totalMonths once fully elapsed.
        const monthsPaid = Math.max(0, Math.min(totalMonths, offset + 1));
        const perMonthAmount = isEmi ? Number(adv.emiAmount) : Number(adv.amount);
        const paidAmount = roundMoney(perMonthAmount * monthsPaid);
        const remainingAmount = roundMoney(Number(adv.amount) - paidAmount);

        return {
            id: adv.id,
            employeeId: adv.employeeId,
            employeeName: adv.employeeName,
            customUserId: adv.customUserId ?? null,
            amount: Number(adv.amount),
            effectiveDate: adv.effectiveDate,
            repaymentMethod: adv.repaymentMethod,
            totalMonths: isEmi ? totalMonths : null,
            emiAmount: isEmi ? Number(adv.emiAmount) : null,
            monthsPaid,
            monthsRemaining: totalMonths - monthsPaid,
            paidAmount,
            remainingAmount: Math.max(0, remainingAmount),
            status: monthsPaid >= totalMonths ? 'COMPLETED' : 'ACTIVE',
        };
    });
};

export const getPayrollSummary = async (companyId: string, month: number, year: number) => {
    // 1. Get all employees in the company with their salaries
    const employees = await findActiveEmployeesWithSalary(companyId);

    // Calculate start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const totalDaysInMonth = endDate.getDate();

    // 2. Fetch Attendances for the month
    const attendances = await findAttendancesForRange(companyId, startDate, endDate);

    // 3. Fetch every advance for the company — not just ones dated this month.
    // An EMI advance granted in an earlier (or even later, for backfills) month
    // still owes an installment this month; a single-payment advance only ever
    // deducts in its own effective month. Both cases need the full history to
    // resolve correctly, not a date-range filter on effectiveDate alone.
    const allAdvances = await findAllSalaryAdvances(companyId);

    // 4. Fetch Market Value Allocations for the month
    const marketValues = await findMarketValueAllocationsForRange(companyId, startDate, endDate);

    // 4b. Fetch every market value deduction for the company — single-payment only
    // (no EMI), so like a single-payment salary advance it only ever deducts in its
    // own effective month; needs the full history to resolve against the query month.
    const allMarketValueDeductions = await findAllMarketValueDeductions(companyId);

    // Grouping Helpers
    const attendanceByEmployee = attendances.reduce((acc: any, curr: any) => {
        if (!acc[curr.employeeId]) acc[curr.employeeId] = [];
        acc[curr.employeeId].push(curr);
        return acc;
    }, {} as Record<string, typeof attendances>);

    const advanceByEmployee = allAdvances.reduce((acc: any, adv: any) => {
        const isEmi = adv.repaymentMethod === 'emi' && adv.totalMonths != null;
        const offset = monthOffset(adv.effectiveDate, month, year);
        if (isEmi) {
            // Only owes an installment while offset falls within [0, totalMonths).
            if (offset >= 0 && offset < adv.totalMonths) {
                acc[adv.employeeId] = (acc[adv.employeeId] || 0) + Number(adv.emiAmount);
            }
        } else if (offset === 0) {
            // Single payment: deducted once, in its own effective month only.
            acc[adv.employeeId] = (acc[adv.employeeId] || 0) + Number(adv.amount);
        }
        return acc;
    }, {} as Record<string, number>);

    const marketValueByEmployee = marketValues.reduce((acc: any, curr: any) => {
        acc[curr.employeeId] = (acc[curr.employeeId] || 0) + Number(curr.amount);
        return acc;
    }, {} as Record<string, number>);

    const marketValueDeductionByEmployee = allMarketValueDeductions.reduce((acc: any, ded: any) => {
        const offset = monthOffset(ded.effectiveDate, month, year);
        if (offset === 0) {
            acc[ded.employeeId] = (acc[ded.employeeId] || 0) + Number(ded.amount);
        }
        return acc;
    }, {} as Record<string, number>);

    // 5. Calculate Final Summary
    return employees.map((emp: any) => {
        const baseSalary = Number(emp.salary || 0);
        const oneDaySalary = baseSalary / totalDaysInMonth;

        let absentDeductions = 0;
        let sundayBonuses = 0;
        let presentDays = 0;
        let absentDays = 0;

        // Note: The loop below assumes attendance records cover all 31 days.
        // If an attendance record for a weekday is completely missing,
        // they are effectively absent in a real system, but based on typical logic
        // we count explicit 'ABSENT' records, or we iterate through all days.
        // Let's iterate through all days of the month to be accurate.
        const empAttendances = attendanceByEmployee[emp.id] || [];
        const attendanceMap = new Map(empAttendances.map((a: any) => [a.date.toISOString().split('T')[0], a.status]));

        for (let day = 1; day <= totalDaysInMonth; day++) {
            const currentDate = new Date(year, month - 1, day);
            const pad = (n: number) => n.toString().padStart(2, '0');
            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const status = attendanceMap.get(dateStr);
            const isSunday = currentDate.getDay() === 0;

            if (isSunday && (status === 'DAY_SHIFT' || status === 'NIGHT_SHIFT')) {
                sundayBonuses += (3 * oneDaySalary);
            } else if (!isSunday && status === 'ABSENT') {
                absentDeductions += oneDaySalary;
                absentDays++;
            }

            if (status === 'DAY_SHIFT' || status === 'NIGHT_SHIFT' || status === 'HALF_DAY') {
                presentDays += (status === 'HALF_DAY' ? 0.5 : 1);
            }
        }

        const advanceDeduction = advanceByEmployee[emp.id] || 0;
        const marketValueBonus = marketValueByEmployee[emp.id] || 0;
        const marketValueDeduction = marketValueDeductionByEmployee[emp.id] || 0;

        const grossSalary = baseSalary - absentDeductions + sundayBonuses;
        const netSalary = grossSalary + marketValueBonus - advanceDeduction - marketValueDeduction;

        return {
            id: emp.id,
            customUserId: emp.customUserId,
            name: emp.name,
            baseSalary,
            totalDaysInMonth,
            daysWorked: presentDays,
            absentDays,
            lopDeduction: Math.round(absentDeductions),
            sundayBonusAmount: Math.round(sundayBonuses),
            grossSalary: Math.round(grossSalary),
            advanceDeduction: Math.round(advanceDeduction),
            marketValueBonus: Math.round(marketValueBonus),
            marketValueDeduction: Math.round(marketValueDeduction),
            netSalary: Math.round(netSalary),
        };
    });
};

export const savePayrollRecords = async (
    companyId: string,
    data: { month: number; year: number }
) => {
    // Generate the summary internally instead of trusting the frontend payload
    const summaryRecords = await getPayrollSummary(companyId, data.month, data.year);

    return withTransaction(async (client) => {
        // Delete existing records for this month/year for this company
        await deletePayrollRecords(client, companyId, data.month, data.year);

        // Insert new records
        if (summaryRecords.length > 0) {
            await insertPayrollRecords(
                client,
                summaryRecords.map((r: any) => ({
                    companyId,
                    employeeId: r.id,
                    month: data.month,
                    year: data.year,
                    baseSalary: r.baseSalary,
                    totalDaysInMonth: r.totalDaysInMonth,
                    daysWorked: r.daysWorked,
                    lopDeduction: r.lopDeduction,
                    advanceDeduction: r.advanceDeduction,
                    sundayBonuses: r.sundayBonusAmount || 0,
                    marketValueBonus: r.marketValueBonus,
                    marketValueDeduction: r.marketValueDeduction,
                    grossSalary: r.grossSalary,
                    netSalary: r.netSalary,
                })),
            );
        }

        return { message: 'Payroll records saved successfully' };
    });
};

export const getSavedPayrollRecords = async (
    companyId: string,
    month: number,
    year: number
) => {
    return findSavedPayrollRecordsRepo(companyId, month, year);
};

/**
 * Manual single-employee edit from the Payroll tab's Actions > Edit button.
 * Trusts only the four editable inputs from the client — base salary, days
 * worked, advance deduction, machine value — and recomputes gross/net itself
 * rather than accepting client-sent totals (same principle as savePayrollRecords).
 */
export const updatePayrollRecord = async (
    companyId: string,
    data: { employeeId: string; month: number; year: number; baseSalary: number; daysWorked: number; advanceDeduction: number; marketValueBonus: number }
) => {
    const totalDaysInMonth = new Date(data.year, data.month, 0).getDate();
    const grossSalary = roundMoney((data.baseSalary * data.daysWorked) / totalDaysInMonth);
    const netSalary = roundMoney(grossSalary - data.advanceDeduction + data.marketValueBonus);

    return upsertPayrollRecord({
        companyId,
        employeeId: data.employeeId,
        month: data.month,
        year: data.year,
        baseSalary: data.baseSalary,
        totalDaysInMonth,
        daysWorked: data.daysWorked,
        advanceDeduction: data.advanceDeduction,
        marketValueBonus: data.marketValueBonus,
        grossSalary,
        netSalary,
    });
};

export const getMarketValueAllocations = async (companyId: string, month: number, year: number) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const marketValues = await findMarketValueAllocationsForRange(companyId, startDate, endDate);

    const marketValueByEmployee = marketValues.reduce((acc: any, curr: any) => {
        acc[curr.employeeId] = (acc[curr.employeeId] || 0) + Number(curr.amount);
        return acc;
    }, {} as Record<string, number>);

    return marketValueByEmployee;
};
