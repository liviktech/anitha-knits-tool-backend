import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async Express route/controller so rejected promises
 * are forwarded to next(err) instead of crashing the process.
 */
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
