import { Router } from 'express';
import { createCompany, login, signup } from '../controllers/platformAdminController.js';
import { requirePlatformAdmin } from '../middlewares/platformAdminAuth.js';

const router = Router();

// Public: one-time bootstrap (signupPlatformAdmin rejects once a PlatformAdmin already exists).
router.post('/signup', signup);
router.post('/login', login);

// Company creation is platform-admin-only — not mounted publicly like the old /company/auth/signup.
router.post('/companies', requirePlatformAdmin, createCompany);

export default router;
