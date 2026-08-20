import { Router } from 'express';
import healthRoutes from './routes.js';
import extruderRoutes from './extruderRoutes.js';
import loomsRoutes from './loomsRoutes.js';
import fabricCheckingRoutes from './fabricCheckingRoutes.js';
import lookupRoutes from './lookup.js';
import dashboardRoutes from './dashboardRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import loadSentRoutes from './loadSentRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/production/extruder', extruderRoutes);
router.use('/production/looms', loomsRoutes);
// PRD §16.7: base path is /api/v1/fabric-checking, not nested under /production.
router.use('/fabric-checking', fabricCheckingRoutes);
router.use('/lookups', lookupRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/load-sent', loadSentRoutes);

// Mount additional feature routers here, e.g.:
// router.use('/users', userRoutes);

export default router;
