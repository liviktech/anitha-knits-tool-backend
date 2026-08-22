import { Router } from 'express';
import { login, refresh } from '../controllers/authController.js';

const router = Router();

// Company signup moved to POST /api/v1/platform/admin/companies (platform-admin only).
router.post('/login', login);
router.post('/refresh', refresh);

export default router;
