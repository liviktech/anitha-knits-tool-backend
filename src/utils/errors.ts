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
