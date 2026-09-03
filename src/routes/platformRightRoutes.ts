import { Router } from 'express';
import {
    createPlatformRightHandler,
    deletePlatformRightHandler,
    getPlatformRightHandler,
    listPlatformRightsHandler,
    updatePlatformRightHandler,
} from '../controllers/platformRightController.js';

const router = Router();

router.post('/', createPlatformRightHandler);
router.get('/', listPlatformRightsHandler);
router.get('/:id', getPlatformRightHandler);
router.patch('/:id', updatePlatformRightHandler);
router.delete('/:id', deletePlatformRightHandler);

export default router;
