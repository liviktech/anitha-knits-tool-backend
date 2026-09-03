import { Router } from 'express';
import {
    createPlatformTabHandler,
    deletePlatformTabHandler,
    getPlatformTabHandler,
    listPlatformTabsHandler,
    updatePlatformTabHandler,
} from '../controllers/platformTabController.js';

const router = Router();

router.post('/', createPlatformTabHandler);
router.get('/', listPlatformTabsHandler);
router.get('/:id', getPlatformTabHandler);
router.patch('/:id', updatePlatformTabHandler);
router.delete('/:id', deletePlatformTabHandler);

export default router;
