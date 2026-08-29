import { Router } from 'express';
import {
    createTabHandler,
    deleteTabHandler,
    getTabHandler,
    listTabsHandler,
    updateTabHandler,
} from '../controllers/tabController.js';

const router = Router();

router.post('/', createTabHandler);
router.get('/', listTabsHandler);
router.get('/:id', getTabHandler);
router.patch('/:id', updateTabHandler);
router.delete('/:id', deleteTabHandler);

export default router;
