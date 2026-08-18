import { Router } from 'express';
import healthRoutes from './routes.js';

const router = Router();

router.use('/health', healthRoutes);

// Mount additional feature routers here, e.g.:
// router.use('/users', userRoutes);

export default router;
