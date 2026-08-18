import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError.js';

function parse<T extends ZodTypeAny>(schema: T, data: unknown): ReturnType<T['parse']> {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new ApiError(400, 'Validation failed', result.error.flatten());
    }
    return result.data;
}

export function validateBody(schema: ZodTypeAny): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            req.body = parse(schema, req.body);
            next();
        } catch (err) {
            next(err);
        }
    };
}

export function validateQuery(schema: ZodTypeAny): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            Object.assign(req.query, parse(schema, req.query));
            next();
        } catch (err) {
            next(err);
        }
    };
}

export function validateParams(schema: ZodTypeAny): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            Object.assign(req.params, parse(schema, req.params));
            next();
        } catch (err) {
            next(err);
        }
    };
}
