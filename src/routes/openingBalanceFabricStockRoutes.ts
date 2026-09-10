import { Router } from 'express';
import {
    createOpeningBalanceFabricStockBatchHandler,
    createOpeningBalanceFabricStockHandler,
    deleteOpeningBalanceFabricStockHandler,
    getOpeningBalanceFabricStockHandler,
    listOpeningBalanceFabricStockHandler,
    updateOpeningBalanceFabricStockHandler,
} from '../controllers/openingBalanceFabricStockController.js';

const router = Router();

// Reads are open to any company role — Dashboard/Report figures for Manager/Supervisor
// fold this data into their totals (see dashboard-data-hooks.ts's obFabricStock). Mutations
// are gated per-route inside the controller via assertModuleActionAllowed (admin_panel /
// opening-balance tab) — ADMIN always passes; anyone else needs the right explicitly granted.
router.post('/', createOpeningBalanceFabricStockHandler);
router.post('/batch', createOpeningBalanceFabricStockBatchHandler);
router.get('/', listOpeningBalanceFabricStockHandler);
router.get('/:id', getOpeningBalanceFabricStockHandler);
router.patch('/:id', updateOpeningBalanceFabricStockHandler);
router.delete('/:id', deleteOpeningBalanceFabricStockHandler);

export default router;
