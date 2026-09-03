import serverlessHttp from 'serverless-http';
import { app } from '../src/app.js';

/**
 * AWS Lambda entry point (API Gateway HTTP API / REST API), separate from api/index.ts
 * (Vercel's Node.js runtime, which wraps `app` itself). Wraps the same Express app used by
 * server.ts/api/index.ts — never calls app.listen(); serverless-http translates each Lambda
 * invocation into a single Express request/response cycle. The `pool` from src/db/pool.ts is
 * module-scoped, so a warm Lambda execution environment reuses the same connection across
 * invocations (see DB_POOL_MAX in .env.example — set to 1 behind RDS Proxy).
 */
export const handler = serverlessHttp(app);
