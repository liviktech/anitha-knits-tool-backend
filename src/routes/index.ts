import { Router } from 'express';
import healthRoutes from './routes.js';
import extruderProductionRoutes from './extruderProduction.js';
import lookupRoutes from './lookup.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/extruder-productions', extruderProductionRoutes);
router.use('/lookups', lookupRoutes);

export default router;
