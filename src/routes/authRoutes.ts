import { Router } from 'express';
import { login } from '../controllers/authController.js';

const router = Router();

// Company signup moved to POST /api/v1/platform/admin/companies (platform-admin only).
router.post('/login', login);

export default router;
