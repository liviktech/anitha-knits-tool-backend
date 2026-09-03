import { Router } from 'express';
import {
    createOpeningBalanceRawMaterialHandler,
    deleteOpeningBalanceRawMaterialGroupHandler,
    listOpeningBalanceRawMaterialsHandler,
    replaceOpeningBalanceRawMaterialGroupHandler,
} from '../controllers/openingBalanceRawMaterialController.js';

const router = Router();

router.post('/', createOpeningBalanceRawMaterialHandler);
router.get('/', listOpeningBalanceRawMaterialsHandler);
router.patch('/:groupId', replaceOpeningBalanceRawMaterialGroupHandler);
router.delete('/:groupId', deleteOpeningBalanceRawMaterialGroupHandler);

export default router;
