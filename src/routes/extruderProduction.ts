import { Router } from 'express';
import {
    createExtruderProduction,
    deleteExtruderProduction,
    getExtruderProduction,
    listExtruderProductions,
    updateExtruderProduction,
} from '../controllers/extruderProduction.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import {
    createExtruderProductionSchema,
    extruderProductionIdParamsSchema,
    listExtruderProductionQuerySchema,
    updateExtruderProductionSchema,
} from '../validators/extruderProduction.js';

const router = Router();

// POST /api/v1/extruder-productions
router.post('/', validateBody(createExtruderProductionSchema), createExtruderProduction);

// GET /api/v1/extruder-productions
router.get('/', validateQuery(listExtruderProductionQuerySchema), listExtruderProductions);

// GET /api/v1/extruder-productions/:id
router.get('/:id', validateParams(extruderProductionIdParamsSchema), getExtruderProduction);

// PATCH /api/v1/extruder-productions/:id
router.patch(
    '/:id',
    validateParams(extruderProductionIdParamsSchema),
    validateBody(updateExtruderProductionSchema),
    updateExtruderProduction,
);

// DELETE /api/v1/extruder-productions/:id
router.delete('/:id', validateParams(extruderProductionIdParamsSchema), deleteExtruderProduction);

export default router;
