import { Router } from 'express';
import healthRoutes from './routes.js';
import extruderRoutes from './extruderRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/production/extruder', extruderRoutes);

// Mount additional feature routers here, e.g.:
// router.use('/users', userRoutes);

export default router;
