import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/** Hashes a plaintext password. Time: O(2^BCRYPT_SALT_ROUNDS) by design; Space: O(1). */
export function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

/** Compares a plaintext password against a bcrypt hash. Time: O(2^BCRYPT_SALT_ROUNDS); Space: O(1). */
export function comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}
