/** The three-plus roles a User can hold, mirrored from the (not-yet-live) multi-tenant schema's UserRole enum. */
export type Role = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';

/** Claim set shared by access and refresh tokens. */
export interface TokenPayload {
    sub: string;
    role: Role;
    companyId: string;
    mobile: string;
}

/** Access token claims; `type` stops a refresh token from being replayed here. */
export interface AccessTokenPayload extends TokenPayload {
    type: 'access';
}

/** Refresh token claims; `type` stops an access token from being replayed here. */
export interface RefreshTokenPayload extends TokenPayload {
    type: 'refresh';
}

declare global {
    namespace Express {
        interface Request {
            user?: AccessTokenPayload;
        }
    }
}
