import { Router } from 'express';
import {
    createPlatformModuleHandler,
    deletePlatformModuleHandler,
    getPlatformModuleHandler,
    listPlatformModulesHandler,
    updatePlatformModuleHandler,
} from '../controllers/platformModuleController.js';

const router = Router();

router.post('/', createPlatformModuleHandler);
router.get('/', listPlatformModulesHandler);
router.get('/:id', getPlatformModuleHandler);
router.patch('/:id', updatePlatformModuleHandler);
router.delete('/:id', deletePlatformModuleHandler);

export default router;
