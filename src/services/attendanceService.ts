import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

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
  date: Date,
  records: BulkAttendancePayload[]
) => {
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
