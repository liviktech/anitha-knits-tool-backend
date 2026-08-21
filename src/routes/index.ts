import { Router } from 'express';
import healthRoutes from './routes.js';
import authRoutes from './authRoutes.js';
import platformAdminRoutes from './platformAdminRoutes.js';
import userRoutes from './userRoutes.js';
import extruderRoutes from './extruderRoutes.js';
import loomsRoutes from './loomsRoutes.js';
import fabricCheckingRoutes from './fabricCheckingRoutes.js';
import lookupRoutes from './lookup.js';
import dashboardRoutes from './dashboardRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import loadSentRoutes from './loadSentRoutes.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/company/auth', authRoutes);
router.use('/platform/admin', platformAdminRoutes);
router.use('/company/user', requireAuth('ADMIN'), userRoutes);
router.use('/production/extruder', requireAuth(), extruderRoutes);
router.use('/production/looms', requireAuth(), loomsRoutes);
// PRD §16.7: base path is /api/v1/fabric-checking, not nested under /production.
router.use('/fabric-checking', requireAuth(), fabricCheckingRoutes);
router.use('/lookups', requireAuth(), lookupRoutes);
router.use('/dashboard', requireAuth(), dashboardRoutes);
router.use('/inventory', requireAuth(), inventoryRoutes);
router.use('/load-sent', requireAuth(), loadSentRoutes);

// Mount additional feature routers here, e.g.:
// router.use('/users', userRoutes);

export default router;
