import { Router } from 'express';
import {
    createUserHandler,
    deleteUserHandler,
    getUserHandler,
    listUsersHandler,
    updateUserHandler,
} from '../controllers/userController.js';

const router = Router();

// requireAuth('ADMIN') is applied once at the mount point in routes/index.ts.
router.post('/', createUserHandler);
router.get('/', listUsersHandler);
router.get('/:id', getUserHandler);
router.patch('/:id', updateUserHandler);
router.delete('/:id', deleteUserHandler);

export default router;
