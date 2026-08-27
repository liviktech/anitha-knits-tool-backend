import { Router } from 'express';
import { getAttendance, bulkUpsertAttendance } from '../controllers/attendanceController.js';

const router = Router();

// Auth is handled in index.ts for this route

router.get('/', getAttendance);
router.post('/bulk', bulkUpsertAttendance);

export default router;
