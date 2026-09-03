import { getConstraintName, isUniqueViolation } from '../db/errors.js';
import { withTransaction } from '../db/transaction.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors.js';
import {
  comparePassword,
  dummyPasswordHash,
  hashPassword,
} from '../utils/password.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { nextCustomUserId, withMappedEmployeeDetails } from './userService.js';
import { DEFAULT_MODULES } from '../constants/defaultAccessCatalog.js';
import { seedCompanyMasterData } from './masterDataSeedService.js';
import { resolveUserAccess } from './roleAccessService.js';
import {
  createCompany,
  existsCompanyById,
  findCompanyById,
  listCompanies as listCompaniesRepo,
  updateCompany as updateCompanyRepo,
} from '../repositories/company.repository.js';
import {
  findLoginCandidatesByMobile,
  findUserForMe,
  insertEmployeeDetails,
  insertUser,
  listCompanyUsers as listCompanyUsersRepo,
  updateLastLogin,
} from '../repositories/user.repository.js';
import { insertModule } from '../repositories/module.repository.js';
import { insertTabs } from '../repositories/tab.repository.js';
import type { TokenPayload } from '../types/auth.js';
import type {
  LoginInput,
  ListCompaniesQuery,
  ListCompanyUsersQuery,
  SignupInput,
  UpdateCompanyInput,
} from '../validations/authValidation.js';

/** Maps a unique-constraint violation on Company to the field that caused it. */
function mapUniqueConstraintError(err: unknown): never | undefined {
  if (!isUniqueViolation(err)) return undefined;

  switch (getConstraintName(err)) {
    case 'companies_company_code_key':
      throw new ConflictError('A company with this companyCode already exists', 'COMPANY_CODE_EXISTS');
    case 'companies_admin_mobile_key':
      throw new ConflictError('A company with this adminMobile already exists', 'COMPANY_MOBILE_EXISTS');
    case 'companies_gst_key':
      throw new ConflictError('A company with this gst already exists', 'COMPANY_GST_EXISTS');
    default:
      throw new ConflictError('Company already exists', 'COMPANY_ALREADY_EXISTS');
  }
}

/**
 * Creates a Company and its first ADMIN User in one transaction (PRD: company
 * signup → admin credentials → ADMIN user). Time: O(1); Space: O(1).
 */
export async function signupCompany(input: SignupInput) {
  const passwordHash = await hashPassword(input.adminPassword);

  try {
    return await withTransaction(async (client) => {
      const company = await createCompany(
        {
          name: input.companyName,
          address: input.companyAddress,
          gst: input.gst,
          adminMobile: input.adminMobile,
          adminPasswordHash: passwordHash,
          companyCode: input.companyCode,
        },
        client,
      );

      // Layer 0 master data (brand/chemical/size/color + colour consumption
      // standard) — PRD §12/§4/§5 defaults every new company starts with.
      await seedCompanyMasterData(client, company.id);

      for (const mod of DEFAULT_MODULES) {
        const createdModule = await insertModule(client, { companyId: company.id, moduleCode: mod.code, moduleName: mod.name });
        if (mod.tabs.length > 0) {
          await insertTabs(client, company.id, createdModule.id, mod.tabs as unknown as { code: string; name: string }[]);
        }
      }

      // No Rights are seeded here — every Right (including the Production Details
      // Add/Edit ones the hard ceilings in productionCeilings.ts look for) is created
      // manually by the admin via the Roles tab (Module > Tab > Action), not auto-generated.

      // First user of a brand-new company — employeeSeq starts at 1, so this is always "001".
      const customUserId = await nextCustomUserId(client, company.id);

      const user = await insertUser(client, {
        companyId: company.id,
        name: input.adminName,
        mobile: input.adminMobile,
        passwordHash,
        role: 'ADMIN',
      });
      const employeeDetails = await insertEmployeeDetails(client, { userId: user.id, customUserId });

      const admin = withMappedEmployeeDetails({ ...user, employeeDetails });

      return { company, admin };
    });
  } catch (err) {
    mapUniqueConstraintError(err);
    throw err;
  }
}

/**
 * Authenticates by mobile + password. mobile is only unique per company
 * (@@unique([companyId, mobile])), not globally, so more than one User row can
 * share a mobile across different companies — every candidate's password hash
 * is checked, and login succeeds only if exactly one matches.
 * Time: O(n) bcrypt compares for n same-mobile accounts (n is always small); Space: O(n).
 */
export async function loginUser(input: LoginInput) {
  const candidates = await findLoginCandidatesByMobile(input.mobile);

  if (candidates.length === 0) {
    // No real hash to check against — compare against a dummy one so this path
    // takes about as long as the real-candidate path (see dummyPasswordHash above).
    await comparePassword(input.password, dummyPasswordHash);
    throw new UnauthorizedError('Invalid mobile number or password', 'INVALID_CREDENTIALS');
  }

  const matches = [];
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
    throw new ConflictError('Multiple accounts match this mobile number; contact support to sign in', 'AMBIGUOUS_LOGIN');
  }

  const user = matches[0]!;
  if (!user.isActive || !user.companyIsActive) {
    throw new ForbiddenError('This account is inactive', 'ACCOUNT_INACTIVE');
  }

  await updateLastLogin(user.id);

  const payload: TokenPayload = {
    sub: user.id,
    role: user.role,
    companyId: user.companyId,
    mobile: user.mobile,
  };
  const tokens = {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
  const access = await resolveUserAccess(user.role, user.roleAccessId, user.companyId);

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
    company: {
      id: user.companyId,
      name: user.companyName,
      companyCode: user.companyCode,
    },
    access,
  };
}

/**
 * Re-resolves the current session's profile + access from scratch — used by GET /me so a
 * client can pick up a RoleAccess change (or reassignment) made after the user last logged in,
 * without needing a fresh login. Deliberately not baked into the JWT for this reason.
 */
export async function getCurrentUser(userId: string, companyId: string) {
  const user = await findUserForMe(userId, companyId);
  if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND', { id: userId });

  const access = await resolveUserAccess(user.role, user.roleAccessId, user.companyId);

  return {
    user: {
      id: user.id,
      companyId: user.companyId,
      name: user.name,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
    },
    company: { id: user.companyId, name: user.companyName, companyCode: user.companyCode },
    access,
  };
}

/** Platform-admin: paginated, filterable list of every company. Time: O(limit); Space: O(limit). */
export async function listCompanies(query: ListCompaniesQuery) {
  const { skip, take } = toSkipTake(query);
  const { rows, total } = await listCompaniesRepo(
    { isActive: query.isActive, name: query.name },
    skip,
    take,
  );
  return { items: rows, meta: toPageMeta(query, total) };
}

/** Platform-admin: fetch one company by id. Time: O(1); Space: O(1). */
export async function getCompanyById(id: string) {
  const company = await findCompanyById(id);
  if (!company) throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND', { id });
  return company;
}

/**
 * Platform-admin: partial update of a company's details. Deliberately excludes
 * adminPasswordHash — resetting a company's admin password belongs in its own
 * dedicated endpoint, not a generic PATCH. Time: O(1); Space: O(1).
 */
export async function updateCompany(id: string, input: UpdateCompanyInput) {
  const existing = await existsCompanyById(id);
  if (!existing) throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND', { id });

  try {
    return await updateCompanyRepo(id, {
      name: input.name,
      address: input.address,
      gst: input.gst,
      companyCode: input.companyCode,
      adminMobile: input.adminMobile,
      isActive: input.isActive,
    });
  } catch (err) {
    mapUniqueConstraintError(err);
    throw err;
  }
}

/**
 * Platform-admin: paginated list of every user (all four roles, unlike the
 * tenant-side /company/user endpoint which excludes ADMIN/EMPLOYEE) for one
 * company. Time: O(limit); Space: O(limit).
 */
export async function listCompanyUsers(companyId: string, query: ListCompanyUsersQuery) {
  const company = await existsCompanyById(companyId);
  if (!company) throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND', { id: companyId });

  const { skip, take } = toSkipTake(query);
  const { rows, total } = await listCompanyUsersRepo(companyId, { role: query.role, isActive: query.isActive }, skip, take);

  return { items: rows, meta: toPageMeta(query, total) };
}
