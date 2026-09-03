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

router.post('/', createOpeningBalanceFabricStockHandler);
router.post('/batch', createOpeningBalanceFabricStockBatchHandler);
router.get('/', listOpeningBalanceFabricStockHandler);
router.get('/:id', getOpeningBalanceFabricStockHandler);
router.patch('/:id', updateOpeningBalanceFabricStockHandler);
router.delete('/:id', deleteOpeningBalanceFabricStockHandler);

export default router;
