import { Router } from 'express';
import healthRoutes from './routes.js';
import extruderRoutes from './extruderRoutes.js';
import loomsRoutes from './loomsRoutes.js';
import fabricCheckingRoutes from './fabricCheckingRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/production/extruder', extruderRoutes);
router.use('/production/looms', loomsRoutes);
// PRD §16.7: base path is /api/v1/fabric-checking, not nested under /production.
router.use('/fabric-checking', fabricCheckingRoutes);

// Mount additional feature routers here, e.g.:
// router.use('/users', userRoutes);

export default router;
