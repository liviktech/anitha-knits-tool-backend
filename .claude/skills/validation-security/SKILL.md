# Validation + Security Skill

## Purpose
Secure external input and enforce authorization on the backend.

## Validation
Validate:
- body
- route parameters
- query parameters
- relevant headers
- uploaded data

Use the project's established validation library, such as Zod.

Frontend validation is not a security boundary.

## Authentication
Authentication answers: who is the user?

Derive identity from authenticated session/token context.

Never trust userId from the request body for authorization decisions.

## Authorization
Authorization answers: can this user perform this action?

Use least privilege and explicit permissions where appropriate:
- production:create
- production:submit
- production:approve
- production:reject
- recipe:update
- wastage:approve

Approval permissions must be enforced server-side.

## Mass assignment
Never pass raw `req.body` to Prisma.

Explicitly map allowed fields.

Protected fields include:
- status
- approval metadata
- inventory effects
- Kora effects
- audit metadata
- createdBy
- approvedBy
- approvedAt

## Threats
Defend against:
- SQL injection
- broken access control
- IDOR
- mass assignment
- sensitive data exposure
- authentication flaws
- unsafe file uploads
- denial of service

Use parameterized/Prisma queries.

## Secrets
Never commit or hard-code passwords, JWT secrets, API keys or database credentials.

Never log them.

## Limits
Bound request bodies, pagination, uploaded files and other attacker-controlled resource usage.

## Error security
Do not expose stack traces, SQL, Prisma errors or filesystem details in production responses.
