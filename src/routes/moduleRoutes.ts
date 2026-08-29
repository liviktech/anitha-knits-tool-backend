import { Router } from 'express';
import {
    createModuleHandler,
    deleteModuleHandler,
    getModuleHandler,
    listModulesHandler,
    updateModuleHandler,
} from '../controllers/moduleController.js';

const router = Router();

router.post('/', createModuleHandler);
router.get('/', listModulesHandler);
router.get('/:id', getModuleHandler);
router.patch('/:id', updateModuleHandler);
router.delete('/:id', deleteModuleHandler);

export default router;
