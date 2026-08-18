import { Router } from 'express';
import healthRoutes from './routes.js';
import extruderProductionRoutes from './extruderProduction.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/extruder-productions', extruderProductionRoutes);

export default router;
