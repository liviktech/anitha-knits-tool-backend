import { ApiError } from './ApiError.js';

/** 404 — the requested resource does not exist (or is not visible to this query). */
export class NotFoundError extends ApiError {
    constructor(message: string, code: string, details?: unknown) {
        super(404, message, code, details);
        this.name = 'NotFoundError';
    }
}

/** 400 — the request payload/params failed validation. */
export class ValidationError extends ApiError {
    constructor(message: string, code: string = 'VALIDATION_ERROR', details?: unknown) {
        super(400, message, code, details);
        this.name = 'ValidationError';
    }
}

/** 409 — the request conflicts with the resource's current state (bad transition, concurrent update, business-rule violation). */
export class ConflictError extends ApiError {
    constructor(message: string, code: string, details?: unknown) {
        super(409, message, code, details);
        this.name = 'ConflictError';
    }
}

/** 401 — no valid credentials were presented (missing/invalid/expired token). */
export class UnauthorizedError extends ApiError {
    constructor(message: string, code: string = 'AUTH_REQUIRED', details?: unknown) {
        super(401, message, code, details);
        this.name = 'UnauthorizedError';
    }
}

/** 403 — the caller is authenticated but not allowed to perform this action. */
export class ForbiddenError extends ApiError {
    constructor(message: string, code: string = 'INSUFFICIENT_ROLE', details?: unknown) {
        super(403, message, code, details);
        this.name = 'ForbiddenError';
    }
}

/** 501 — the endpoint exists but its implementation is deliberately not available yet (e.g. mid-migration). */
export class NotImplementedError extends ApiError {
    constructor(message: string, code: string = 'NOT_IMPLEMENTED', details?: unknown) {
        super(501, message, code, details);
        this.name = 'NotImplementedError';
    }
}
