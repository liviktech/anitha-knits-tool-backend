import { withTransaction } from '../db/transaction.js';
import { RightAction, UserRole } from '../types/enums.js';
import { findAttendanceRecords, upsertAttendance } from '../repositories/attendance.repository.js';
import { assertModuleActionAllowed } from './roleAccessService.js';

const EMPLOYEES_MODULE_CODE = 'employees';
const ATTENDANCE_TAB_CODE = 'attendance';

export interface BulkAttendancePayload {
  employeeId: string;
  status: 'DAY_SHIFT' | 'NIGHT_SHIFT' | 'ABSENT' | 'HALF_DAY' | 'COMPANY_HOLIDAY';
  remarks?: string;
}

export const getAttendanceRecords = async (companyId: string, dateFrom: Date, dateTo: Date) => {
  return findAttendanceRecords(companyId, dateFrom, dateTo);
};

export const upsertDailyAttendance = async (
  companyId: string,
  userId: string,
  callerRole: UserRole,
  date: Date,
  records: BulkAttendancePayload[]
) => {
  // Marking/editing a day's attendance is gated as EDIT, not ADD — the bulk call always
  // creates-or-updates in one shot, and "editing today's attendance grid" is the closer fit.
  await assertModuleActionAllowed(callerRole, userId, companyId, EMPLOYEES_MODULE_CODE, RightAction.EDIT, ATTENDANCE_TAB_CODE);

  return withTransaction(async (client) => {
    const results = [];
    for (const record of records) {
      const result = await upsertAttendance(client, {
        companyId,
        employeeId: record.employeeId,
        date,
        status: record.status,
        remarks: record.remarks || null,
        actor: userId,
      });
      results.push(result);
    }
    return results;
  });
};
