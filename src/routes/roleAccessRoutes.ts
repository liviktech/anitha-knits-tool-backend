import { Router } from 'express';
import {
    assignRoleAccessHandler,
    createRoleAccessHandler,
    deleteRoleAccessHandler,
    getRoleAccessHandler,
    listRoleAccessesHandler,
    updateRoleAccessHandler,
} from '../controllers/roleAccessController.js';

const router = Router();

router.post('/', createRoleAccessHandler);
router.get('/', listRoleAccessesHandler);
router.get('/:id', getRoleAccessHandler);
router.patch('/:id', updateRoleAccessHandler);
router.delete('/:id', deleteRoleAccessHandler);
router.post('/:id/assign', assignRoleAccessHandler);

export default router;
