import { Router } from 'express';
import {
    createOpeningBalanceRawMaterialHandler,
    deleteOpeningBalanceRawMaterialGroupHandler,
    listOpeningBalanceRawMaterialsHandler,
    replaceOpeningBalanceRawMaterialGroupHandler,
} from '../controllers/openingBalanceRawMaterialController.js';

const router = Router();

// Reads are open to any company role — Dashboard/Report inventory figures for
// Manager/Supervisor fold this data into their totals. Mutations are gated per-route
// inside the controller via assertModuleActionAllowed (admin_panel / opening-balance
// tab) — ADMIN always passes; anyone else needs the right explicitly granted.
router.post('/', createOpeningBalanceRawMaterialHandler);
router.get('/', listOpeningBalanceRawMaterialsHandler);
router.patch('/:groupId', replaceOpeningBalanceRawMaterialGroupHandler);
router.delete('/:groupId', deleteOpeningBalanceRawMaterialGroupHandler);

export default router;
