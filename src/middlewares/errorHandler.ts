import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

// Translates the Prisma error codes CRUD routes actually hit into ApiErrors,
// so services don't need to catch/map these at every call site.
function mapKnownError(err: unknown): ApiError | null {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;

    switch (err.code) {
        case 'P2025':
            return new ApiError(404, 'Record not found');
        case 'P2003':
            return new ApiError(400, 'Referenced record does not exist', { field: err.meta?.field_name });
        case 'P2002':
            return new ApiError(409, 'Record already exists', { fields: err.meta?.target });
        default:
            return null;
    }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const mapped = mapKnownError(err) ?? err;
    const statusCode = mapped instanceof ApiError ? mapped.statusCode : 500;
    const message = statusCode === 500 && isProduction ? 'Internal server error' : mapped.message;

    if (statusCode === 500) {
        logger.error(err);
    }

    res.status(statusCode).json({
        error: {
            message,
            ...(mapped instanceof ApiError && mapped.details ? { details: mapped.details } : {}),
            ...(isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
        },
    });
};
