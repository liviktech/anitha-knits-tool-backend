import type { Request } from 'express';
import { UnauthorizedError } from './errors.js';

/** Resolves the authenticated caller's tenant + audit identity from req.user (set by requireAuth). */
export function getAuthContext(req: Request): { companyId: string; actor: string; userId: string } {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    return { companyId: req.user.companyId, actor: req.user.mobile, userId: req.user.sub };
}
