import type { Request } from 'express';

/**
 * Resolves the acting user for audit fields (createdBy/updatedBy/approvedBy).
 *
 * This repo has no authentication/authorization middleware yet, so identity is
 * read from a header rather than the request body (never trust client-supplied
 * identity in the body — see validation-security skill). Replace this with
 * real session/token-derived identity once auth is wired in; until then every
 * caller is trusted equally and no permission check backs approve/reject.
 */
export function getActor(req: Request): string {
    const header = req.get('x-user-email');
    return header && header.trim().length > 0 ? header.trim() : 'unauthenticated-user';
}
