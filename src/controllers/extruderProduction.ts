import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as extruderProductionService from '../services/extruderProduction.js';
import type {
    CreateExtruderProductionInput,
    ListExtruderProductionQuery,
    UpdateExtruderProductionInput,
} from '../validators/extruderProduction.js';

export const createExtruderProduction = asyncHandler(async (req: Request, res: Response) => {
    const result = await extruderProductionService.createExtruderProduction(req.body as CreateExtruderProductionInput);
    res.status(201).json(result);
});

export const listExtruderProductions = asyncHandler(async (req: Request, res: Response) => {
    const result = await extruderProductionService.listExtruderProductions(
        req.query as unknown as ListExtruderProductionQuery,
    );
    res.status(200).json(result);
});

export const getExtruderProduction = asyncHandler(async (req: Request, res: Response) => {
    const result = await extruderProductionService.getExtruderProductionById(req.params.id);
    res.status(200).json(result);
});

export const updateExtruderProduction = asyncHandler(async (req: Request, res: Response) => {
    const result = await extruderProductionService.updateExtruderProduction(
        req.params.id,
        req.body as UpdateExtruderProductionInput,
    );
    res.status(200).json(result);
});

export const deleteExtruderProduction = asyncHandler(async (req: Request, res: Response) => {
    await extruderProductionService.deleteExtruderProduction(req.params.id);
    res.status(204).send();
});
