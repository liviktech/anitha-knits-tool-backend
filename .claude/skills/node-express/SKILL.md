# Node.js + Express Skill

## Purpose
Production standards for Node.js and Express.

## Request lifecycle

Request
→ request ID/logging
→ security middleware
→ authentication
→ authorization
→ validation
→ controller
→ service
→ response/error middleware

Controllers must be thin.

Never:
- put complex business logic in routes
- scatter Prisma operations through controllers
- trust client roles/status/ownership
- expose internal errors

## Async
Use consistent async error propagation. Prevent unhandled promise rejections.

Use centralized error middleware.

## Middleware
Use middleware for cross-cutting concerns:
- authentication
- authorization
- validation
- request IDs
- rate limiting
- security configuration
- error handling

Avoid feature-specific business logic in generic middleware.

## HTTP
Use correct status codes:
200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500.

Do not return 200 for errors.

## Graceful shutdown
On SIGTERM/SIGINT:
1. stop accepting requests
2. allow in-flight requests to finish within a timeout
3. disconnect Prisma/database resources
4. exit cleanly

## Configuration
Validate environment variables at startup. Never hard-code secrets.

## Request limits
Bound request body sizes and uploaded data where applicable.

## Logging
Use structured logging and request/correlation IDs where practical.

Never log passwords, tokens, API keys, credentials or unnecessary sensitive information.

## External calls
Do not put integrations directly in controllers. Use integration/service modules.

Handle timeout, retry, failure and idempotency explicitly.

Never blindly retry non-idempotent operations.
