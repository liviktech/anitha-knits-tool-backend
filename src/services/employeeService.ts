import crypto from 'crypto';
import { EMPLOYEE_AADHAAR_PREFIX, EMPLOYEE_PHOTO_PREFIX } from '../config/s3.js';
import { isUniqueViolation } from '../db/errors.js';
import { withTransaction } from '../db/transaction.js';
import { RightAction, UserRole } from '../types/enums.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { uploadEmployeeFile } from './s3UploadService.js';
import { nextCustomUserId } from './userService.js';
import { assertModuleActionAllowed } from './roleAccessService.js';
import {
  countActiveUsersByRole,
  existsUserWithRole,
  findEmployeeById as findEmployeeByIdRepo,
  insertEmployeeRecord,
  insertUser,
  listEmployees as listEmployeesRepo,
  deleteEmployeeRecord,
  updateEmployeeRecord,
  syncPromotedUser,
  demotePromotedUser,
  type EmployeeRow,
} from '../repositories/user.repository.js';
import type { CreateEmployeeInput, ListEmployeesQuery, UpdateEmployeeInput } from '../validations/employeeValidation.js';

export interface EmployeeUploadFiles {
  photo?: Express.Multer.File;
  aadhaarFile?: Express.Multer.File;
}

const MANAGED_ROLES: UserRole[] = [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.SUPERVISOR];

const MAX_MANAGERS_PER_COMPANY = 1;
const MAX_SUPERVISORS_PER_COMPANY = 1;

const EMPLOYEES_MODULE_CODE = 'employees';
const DIRECTORY_TAB_CODE = 'directory';

export function mapEmployee(user: EmployeeRow | null) {
  if (!user) return null;
  const { roleAccessId, roleAccessRoleName, ...rest } = user;
  return {
    ...rest,
    roleAccessId,
    roleAccess: roleAccessId ? { id: roleAccessId, roleName: roleAccessRoleName } : null,
  };
}

/** Maps a unique-constraint violation on [companyId, mobile] to a stable conflict error. */
function mapUniqueConstraintError(err: unknown): never | undefined {
  if (!isUniqueViolation(err)) return undefined;
  throw new ConflictError('A user with this mobile number already exists in this company', 'USER_MOBILE_EXISTS');
}

/** Uploads whichever of photo/aadhaarFile were provided, in parallel. */
async function uploadProvidedEmployeeFiles(companyId: string, files?: EmployeeUploadFiles) {
  const photoFile = files?.photo;
  const aadhaarFile = files?.aadhaarFile;
  const [photoUrl, aadhaarDocumentUrl] = await Promise.all([
    photoFile
      ? uploadEmployeeFile({
          buffer: photoFile.buffer!,
          mimetype: photoFile.mimetype,
          originalName: photoFile.originalname,
          companyId,
          prefix: EMPLOYEE_PHOTO_PREFIX,
        })
      : Promise.resolve(undefined),
    aadhaarFile
      ? uploadEmployeeFile({
          buffer: aadhaarFile.buffer!,
          mimetype: aadhaarFile.mimetype,
          originalName: aadhaarFile.originalname,
          companyId,
          prefix: EMPLOYEE_AADHAAR_PREFIX,
        })
      : Promise.resolve(undefined),
  ]);
  return { photoUrl, aadhaarDocumentUrl };
}

/** Throws ConflictError if creating/promoting a MANAGER/SUPERVISOR would exceed cap. */
async function assertRoleCapNotExceeded(role: UserRole, companyId: string) {
  if (role === UserRole.EMPLOYEE) return;

  const max = role === UserRole.MANAGER ? MAX_MANAGERS_PER_COMPANY : MAX_SUPERVISORS_PER_COMPANY;
  const activeCount = await countActiveUsersByRole(companyId, role);
  if (activeCount >= max) {
    throw new ConflictError(
      `This company already has an active ${role === UserRole.MANAGER ? 'Manager' : 'Supervisor'} — deactivate them first to add a new one`,
      role === UserRole.MANAGER ? 'MANAGER_LIMIT_REACHED' : 'SUPERVISOR_LIMIT_REACHED',
    );
  }
}

export async function createEmployee(
  input: CreateEmployeeInput,
  companyId: string,
  callerRole: UserRole,
  callerId: string,
  files?: EmployeeUploadFiles,
) {
  await assertModuleActionAllowed(callerRole, callerId, companyId, EMPLOYEES_MODULE_CODE, RightAction.ADD, DIRECTORY_TAB_CODE);

  const role = input.role ?? UserRole.EMPLOYEE;
  await assertRoleCapNotExceeded(role, companyId);

  // Upload before the transaction so a slow S3 call never ties up a pooled DB connection.
  const { photoUrl, aadhaarDocumentUrl } = await uploadProvidedEmployeeFiles(companyId, files);

  try {
    const employee = await withTransaction(async (client) => {
      const customUserId = await nextCustomUserId(client, companyId);

      if (role === UserRole.MANAGER || role === UserRole.SUPERVISOR) {
        // Default passwords as requested: "manager" for MANAGER, "supervisor" for SUPERVISOR
        const defaultPassword = role === UserRole.MANAGER ? 'manager' : 'supervisor';
        const passwordHash = await hashPassword(input.password || defaultPassword);
        const user = await insertUser(client, {
          companyId,
          name: input.name,
          mobile: input.mobile,
          passwordHash,
          role,
        });
        const createdUser = await findEmployeeByIdRepo(user.id, companyId, MANAGED_ROLES);
        return createdUser!;
      }

      return await insertEmployeeRecord(client, {
        companyId,
        customUserId,
        userId: null,
        name: input.name,
        mobile: input.mobile,
        role,
        designation: input.designation,
        address: input.address,
        gender: input.gender,
        salary: input.salary,
        aadhaarNumber: input.aadhaarNumber,
        joiningDate: input.joiningDate,
        ...(photoUrl ? { photoUrl } : {}),
        ...(aadhaarDocumentUrl
          ? { aadhaarDocumentUrl, documentName: files!.aadhaarFile!.originalname, aadhaarDocumentUploadedAt: new Date() }
          : {}),
      });
    });
    return mapEmployee(employee);
  } catch (err) {
    mapUniqueConstraintError(err);
    throw err;
  }
}

export async function listEmployees(query: ListEmployeesQuery, companyId: string) {
  const { skip, take } = toSkipTake(query);
  const { rows, total } = await listEmployeesRepo(
    companyId,
    { role: query.role, managedRoles: MANAGED_ROLES, isActive: query.isActive },
    skip,
    take,
  );

  return { items: rows.map(mapEmployee), meta: toPageMeta(query, total) };
}

export async function getEmployeeById(id: string, companyId: string) {
  const user = await findEmployeeByIdRepo(id, companyId, MANAGED_ROLES);
  if (!user) throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });
  return mapEmployee(user);
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
  companyId: string,
  callerRole: UserRole,
  callerId: string,
  files?: EmployeeUploadFiles,
) {
  await assertModuleActionAllowed(callerRole, callerId, companyId, EMPLOYEES_MODULE_CODE, RightAction.EDIT, DIRECTORY_TAB_CODE);

  const existing = await findEmployeeByIdRepo(id, companyId, MANAGED_ROLES);
  if (!existing) throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });

  const targetRole = input.role ?? existing.role;

  if (targetRole !== existing.role) {
    await assertRoleCapNotExceeded(targetRole, companyId);
  }

  const { photoUrl, aadhaarDocumentUrl } = await uploadProvidedEmployeeFiles(companyId, files);

  try {
    await withTransaction(async (client) => {
      // Handle Promotion or Role Change to Manager/Supervisor
      if (targetRole === UserRole.MANAGER || targetRole === UserRole.SUPERVISOR) {
        const defaultPassword = targetRole === UserRole.MANAGER ? 'manager' : 'supervisor';
        const passwordHash = await hashPassword(defaultPassword);
        await syncPromotedUser(client, {
          companyId,
          name: input.name ?? existing.name,
          mobile: input.mobile ?? existing.mobile,
          passwordHash,
          role: targetRole,
          employeeId: id,
        });
      } else if (targetRole === UserRole.EMPLOYEE && existing.role !== UserRole.EMPLOYEE) {
        // Demotion back to regular employee
        await demotePromotedUser(client, id);
      }

      await updateEmployeeRecord(
        id,
        {
          name: input.name,
          mobile: input.mobile,
          role: targetRole,
          isActive: input.isActive,
          designation: input.designation,
          address: input.address,
          gender: input.gender,
          salary: input.salary,
          aadhaarNumber: input.aadhaarNumber,
          joiningDate: input.joiningDate,
          ...(photoUrl ? { photoUrl } : {}),
          ...(aadhaarDocumentUrl
            ? { aadhaarDocumentUrl, documentName: files!.aadhaarFile!.originalname, aadhaarDocumentUploadedAt: new Date() }
            : {}),
        },
        client,
      );
    });

    const user = await findEmployeeByIdRepo(id, companyId, MANAGED_ROLES);
    return mapEmployee(user);
  } catch (err) {
    mapUniqueConstraintError(err);
    throw err;
  }
}

export async function deleteEmployee(id: string, companyId: string, callerRole: UserRole, callerId: string) {
  await assertModuleActionAllowed(callerRole, callerId, companyId, EMPLOYEES_MODULE_CODE, RightAction.DELETE, DIRECTORY_TAB_CODE);

  const existing = await existsUserWithRole(id, companyId, MANAGED_ROLES);
  if (!existing) throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });

  await deleteEmployeeRecord(id);
}

