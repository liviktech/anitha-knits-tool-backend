import { Router } from 'express';
import {
    createOpeningBalanceWastageBatchHandler,
    createOpeningBalanceWastageHandler,
    deleteOpeningBalanceWastageHandler,
    getOpeningBalanceWastageHandler,
    listOpeningBalanceWastageHandler,
    updateOpeningBalanceWastageHandler,
} from '../controllers/openingBalanceWastageController.js';

const router = Router();

router.post('/', createOpeningBalanceWastageHandler);
router.post('/batch', createOpeningBalanceWastageBatchHandler);
router.get('/', listOpeningBalanceWastageHandler);
router.get('/:id', getOpeningBalanceWastageHandler);
router.patch('/:id', updateOpeningBalanceWastageHandler);
router.delete('/:id', deleteOpeningBalanceWastageHandler);

export default router;
