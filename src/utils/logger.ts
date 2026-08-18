import { isProduction } from '../config/env.js';

const levels = ['error', 'warn', 'info', 'debug'] as const;
type Level = (typeof levels)[number];
type Logger = Record<Level, (...args: unknown[]) => void>;

function timestamp(): string {
    return new Date().toISOString();
}

function log(level: Level, ...args: unknown[]): void {
    if (level === 'debug' && isProduction) return;
    const method = console[level] ?? console.log;
    method(`[${timestamp()}] [${level.toUpperCase()}]`, ...args);
}

export const logger: Logger = Object.fromEntries(
    levels.map((level) => [level, (...args: unknown[]) => log(level, ...args)]),
) as Logger;
