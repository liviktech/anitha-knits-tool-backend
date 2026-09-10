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

// Reads are open to any company role — Dashboard/Report figures for Manager/Supervisor
// fold this data into their totals (see dashboard-data-hooks.ts's obWastage). Mutations
// are gated per-route inside the controller via assertModuleActionAllowed (admin_panel /
// opening-balance tab) — ADMIN always passes; anyone else needs the right explicitly granted.
router.post('/', createOpeningBalanceWastageHandler);
router.post('/batch', createOpeningBalanceWastageBatchHandler);
router.get('/', listOpeningBalanceWastageHandler);
router.get('/:id', getOpeningBalanceWastageHandler);
router.patch('/:id', updateOpeningBalanceWastageHandler);
router.delete('/:id', deleteOpeningBalanceWastageHandler);

export default router;
