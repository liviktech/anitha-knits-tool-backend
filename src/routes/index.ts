import { Router } from 'express';
import healthRoutes from './routes.js';
import authRoutes from './authRoutes.js';
import platformAdminRoutes from './platformAdminRoutes.js';
import extruderRoutes from './extruderRoutes.js';
import loomsRoutes from './loomsRoutes.js';
import fabricCheckingRoutes from './fabricCheckingRoutes.js';
import koraBalanceRoutes from './koraBalanceRoutes.js';
import lookupRoutes from './lookup.js';
import dashboardRoutes from './dashboardRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import loadSentRoutes from './loadSentRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import adminConfigRoutes from './adminConfig.js';
import moduleRoutes from './moduleRoutes.js';
import tabRoutes from './tabRoutes.js';
import rightRoutes from './rightRoutes.js';
import roleAccessRoutes from './roleAccessRoutes.js';
import openingBalanceRawMaterialRoutes from './openingBalanceRawMaterialRoutes.js';
import openingBalanceWastageRoutes from './openingBalanceWastageRoutes.js';
import openingBalanceFabricStockRoutes from './openingBalanceFabricStockRoutes.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireModuleAccess } from '../middlewares/requireModuleAccess.js';

const router = Router();

// Every EMPLOYEE-role user is now let past the coarse role check on these module-mapped
// routes; requireModuleAccess() is what actually gates them, using their resolved RoleAccess
// grants instead. ADMIN/MANAGER/SUPERVISOR keep unrestricted access as before.
const COMPANY_ROLES = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE'] as const;

router.use('/health', healthRoutes);

//Done
router.use('/company/auth', authRoutes);
router.use('/inventory', requireAuth(...COMPANY_ROLES), requireModuleAccess('inventory'), inventoryRoutes);
router.use('/expenses', requireAuth(...COMPANY_ROLES), requireModuleAccess('expenses'), expenseRoutes);
// dashboardRoutes.ts applies requireModuleAccess per-endpoint (not here) — GET /production is
// also used by the Production module's Day Wise Report, so it can't be gated to 'dashboard' alone.
router.use('/dashboard', requireAuth(...COMPANY_ROLES), dashboardRoutes);

//Pending
router.use(
  '/load-sent',
  requireAuth(...COMPANY_ROLES),
  requireModuleAccess('productiondetails'),
  loadSentRoutes,
);
router.use('/color-consumption-standard', adminConfigRoutes);
router.use('/platform/admin', platformAdminRoutes);
router.use(
  '/production/extruder',
  requireAuth(...COMPANY_ROLES),
  requireModuleAccess('productiondetails'),
  extruderRoutes,
);
router.use(
  '/production/looms',
  requireAuth(...COMPANY_ROLES),
  requireModuleAccess('productiondetails'),
  loomsRoutes,
);
// PRD §16.7: base path is /api/v1/fabric-checking, not nested under /production.
router.use(
  '/fabric-checking',
  requireAuth(...COMPANY_ROLES),
  requireModuleAccess('productiondetails'),
  fabricCheckingRoutes,
);
router.use(
  '/lookups',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  lookupRoutes,
);

router.use(
  '/kora-balance',
  requireAuth(...COMPANY_ROLES),
  requireModuleAccess('productiondetails'),
  koraBalanceRoutes,
);

router.use('/modules', requireAuth('ADMIN'), moduleRoutes);
router.use('/tabs', requireAuth('ADMIN'), tabRoutes);
router.use('/rights', requireAuth('ADMIN'), rightRoutes);
router.use('/role-access', requireAuth('ADMIN'), roleAccessRoutes);
router.use('/opening-balance/raw-materials', requireAuth('ADMIN'), openingBalanceRawMaterialRoutes);
router.use('/opening-balance/wastage', requireAuth('ADMIN'), openingBalanceWastageRoutes);
router.use('/opening-balance/fabric-stock', requireAuth('ADMIN'), openingBalanceFabricStockRoutes);

import employeeRoutes from './employeeRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';
import payrollRoutes from './payrollRoutes.js';

// Mount additional feature routers here, e.g.:
router.use(
  '/company/employee',
  requireAuth(...COMPANY_ROLES),
  requireModuleAccess('employees', 'directory'),
  employeeRoutes,
);
router.use(
  '/company/attendance',
  requireAuth(...COMPANY_ROLES),
  requireModuleAccess('employees', 'attendance'),
  attendanceRoutes,
);
router.use(
  '/company/payroll',
  requireAuth(...COMPANY_ROLES),
  requireModuleAccess('employees', 'payroll'),
  payrollRoutes,
);

export default router;
