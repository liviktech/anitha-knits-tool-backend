import { Router } from 'express';
import { getLookups } from '../controllers/lookup.js';

const router = Router();

// GET /api/v1/lookups -> master data for size/color/chemical/brand dropdowns
router.get('/', getLookups);

export default router;
