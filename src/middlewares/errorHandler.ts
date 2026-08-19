import type { ErrorRequestHandler } from 'express';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const statusCode = err instanceof ApiError ? err.statusCode : 500;
    const message = statusCode === 500 && isProduction ? 'Internal server error' : err.message;

    if (statusCode === 500) {
        logger.error(err);
    }

    res.status(statusCode).json({
        success: false,
        error: {
            code: err instanceof ApiError && err.code ? err.code : 'INTERNAL_ERROR',
            message,
            ...(err instanceof ApiError && err.details ? { details: err.details } : {}),
            ...(isProduction ? {} : { stack: err.stack }),
        },
    });
};
