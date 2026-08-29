import { Router } from 'express';
import {
    createRightHandler,
    deleteRightHandler,
    getRightHandler,
    listRightsHandler,
    updateRightHandler,
} from '../controllers/rightController.js';

const router = Router();

router.post('/', createRightHandler);
router.get('/', listRightsHandler);
router.get('/:id', getRightHandler);
router.patch('/:id', updateRightHandler);
router.delete('/:id', deleteRightHandler);

export default router;
