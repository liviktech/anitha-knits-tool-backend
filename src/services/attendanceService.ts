import { Prisma, RightAction, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { assertModuleActionAllowed } from './roleAccessService.js';

const EMPLOYEES_MODULE_CODE = 'employees';
const ATTENDANCE_TAB_CODE = 'attendance';

export interface BulkAttendancePayload {
  employeeId: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'COMPANY_HOLIDAY';
  remarks?: string;
}

export const getAttendanceRecords = async (companyId: string, dateFrom: Date, dateTo: Date) => {
  return prisma.attendance.findMany({
    where: {
      companyId,
      date: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeDetails: {
            select: {
              customUserId: true,
              designation: true,
            },
          },
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  });
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

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const results = [];
    for (const record of records) {
      const result = await tx.attendance.upsert({
        where: {
          companyId_employeeId_date: {
            companyId,
            employeeId: record.employeeId,
            date,
          },
        },
        update: {
          status: record.status,
          remarks: record.remarks || null,
          updatedBy: userId,
        },
        create: {
          companyId,
          employeeId: record.employeeId,
          date,
          status: record.status,
          remarks: record.remarks || null,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      results.push(result);
    }
    return results;
  });
};
