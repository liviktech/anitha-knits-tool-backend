export class ApiError extends Error {
    statusCode: number;
    code?: string;
    details?: unknown;

    constructor(statusCode: number, message: string, code?: string, details: unknown = undefined) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
