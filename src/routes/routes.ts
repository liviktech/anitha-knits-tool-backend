import { Router } from 'express';
import { getLiveness, getReadiness } from '../controllers/controller.js';

const router = Router();

// GET /api/v1/health -> process is up
router.get('/', getLiveness);
// GET /api/v1/health/db -> process is up AND can reach the database
router.get('/db', getReadiness);

export default router;
