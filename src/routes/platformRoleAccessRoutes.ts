import { Router } from 'express';
import {
    assignPlatformRoleAccessHandler,
    createPlatformRoleAccessHandler,
    deletePlatformRoleAccessHandler,
    getPlatformRoleAccessHandler,
    listPlatformEmployeeAccessHandler,
    listPlatformRoleAccessesHandler,
    updatePlatformRoleAccessHandler,
} from '../controllers/platformRoleAccessController.js';

const router = Router();

router.post('/', createPlatformRoleAccessHandler);
router.get('/', listPlatformRoleAccessesHandler);
// Must come before '/:id' — otherwise "employee-access" would be parsed as an :id.
router.get('/employee-access', listPlatformEmployeeAccessHandler);
router.get('/:id', getPlatformRoleAccessHandler);
router.patch('/:id', updatePlatformRoleAccessHandler);
router.delete('/:id', deletePlatformRoleAccessHandler);
router.post('/:id/assign', assignPlatformRoleAccessHandler);

export default router;
