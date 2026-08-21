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

// Precomputed once at startup so an "identifier not found" login takes roughly the same time
// as a real password check — otherwise the missing bcrypt.compare() would be a timing
// side-channel that lets an attacker enumerate which identifiers (mobile numbers) have accounts.
export const dummyPasswordHash = await hashPassword('timing-attack-mitigation-placeholder');
