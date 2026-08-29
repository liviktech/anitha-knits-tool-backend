import type { Request } from 'express';
import { UnauthorizedError } from './errors.js';
import type { Role } from '../types/auth.js';

/** Resolves the authenticated caller's tenant + audit identity from req.user (set by requireAuth). */
export function getAuthContext(req: Request): { companyId: string; actor: string; userId: string; role: Role } {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    return { companyId: req.user.companyId, actor: req.user.mobile, userId: req.user.sub, role: req.user.role };
}
