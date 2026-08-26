import { Router } from 'express';
import healthRoutes from './routes.js';
import authRoutes from './authRoutes.js';
import platformAdminRoutes from './platformAdminRoutes.js';
import userRoutes from './userRoutes.js';
import extruderRoutes from './extruderRoutes.js';
import loomsRoutes from './loomsRoutes.js';
import fabricCheckingRoutes from './fabricCheckingRoutes.js';
import koraBalanceRoutes from './koraBalanceRoutes.js';
import lookupRoutes from './lookup.js';
import dashboardRoutes from './dashboardRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import loadSentRoutes from './loadSentRoutes.js';
import adminConfigRoutes from './adminConfig.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.use('/health', healthRoutes);

//Done
router.use('/company/auth', authRoutes);
router.use('/inventory', inventoryRoutes);
router.use(
  '/dashboard',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  dashboardRoutes,
);

//Pending
router.use(
  '/load-sent',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  loadSentRoutes,
);
router.use('/color-consumption-standard', adminConfigRoutes);
router.use('/platform/admin', platformAdminRoutes);
router.use('/company/user', requireAuth('ADMIN'), userRoutes);
router.use(
  '/production/extruder',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  extruderRoutes,
);
router.use(
  '/production/looms',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  loomsRoutes,
);
// PRD §16.7: base path is /api/v1/fabric-checking, not nested under /production.
router.use(
  '/fabric-checking',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  fabricCheckingRoutes,
);
router.use(
  '/lookups',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  lookupRoutes,
);

router.use(
  '/kora-balance',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  koraBalanceRoutes,
);

// Mount additional feature routers here, e.g.:
// router.use('/users', userRoutes);

export default router;
