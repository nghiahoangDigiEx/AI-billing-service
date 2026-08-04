# AGENTS.md

## Project Overview

AI platform billing service managing user authentication, Stripe subscriptions, and credit-based consumption.

**Primary Business Domains:**
- User identity and authentication (registration, login, OAuth, roles)
- Billing and payments (subscriptions, invoicing, payment methods, add-ons)
- Credit management (ledger, monthly resets, consumption tracking)

**Explicitly Out of Scope:**
- Email notifications
- Actual AI service integration
- Multi-tenancy
- Advanced analytics
- Payment method validation (3D Secure delegated to Stripe)

---

## Commands

```bash
# Install dependencies
npm install

# Development
npm run start:dev

# Build
npm run build

# Lint
npm run lint

# Type check
npm run typecheck

# Test
npm run test              # Unit tests
npm run test:e2e          # Integration tests
npm run test:cov          # Coverage report

# Database
npx prisma generate       # Generate Prisma client
npx prisma migrate dev    # Run migrations
npx prisma migrate deploy # Deploy migrations
npm run seed              # Seed database

# Stripe (development)
stripe login
stripe listen --forward-to http://localhost:3000/webhooks/stripe
```

---

## Technology Stack

- **Runtime:** Node.js
- **Framework:** NestJS
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma
- **Authentication:** Passport.js (JWT + OAuth strategies)
- **Payment:** Stripe SDK
- **Messaging:** EventEmitter2 (internal event bus)
- **Validation:** class-validator + class-transformer
- **API Documentation:** @nestjs/swagger
- **Testing:** Jest, @nestjs/testing

---

## Architecture

**Style:** Event-driven modular monolith with layered internals

**Dependency Direction:**
```
Controller → Service → Repository (Prisma) → Database
```

**Module Boundaries:**
- User Module (identity, authentication, authorization)
- Billing Module (Stripe integration, subscriptions, payments)
- Credit Module (ledger, resets, consumption)

**External Integrations:**
- Stripe API (isolated via PaymentProviderAdapter)
- PostgreSQL (accessed via Prisma)
- Google OAuth (isolated in User Module strategies)

**Cross-Module Communication:**
Event-driven via EventEmitter2. Modules never call each other's services directly.

**Payment Provider Extensibility:**
- PaymentProviderAdapter interface abstracts payment provider operations
- WebhookStrategy interface abstracts webhook event parsing
- StripeAdapter and StripeWebhookStrategy implement these for Stripe
- Per-subscription provider selection (STRIPE, PAYPAL, etc.)
- PaymentProviderFactory resolves correct adapter based on subscription.provider

---

## AI Workflow

**Workflow Selection:**
- Use **opsx-* workflows** (OpenSpec) for new features, complex architectural changes, or when detailed design documents and specs are required before implementation.
- Use **superpowers-* workflows** for bug fixes, small refactors, direct implementation plans, or tasks that don't require extensive upfront spec writing.

**Before implementation:**
- Read the relevant OpenSpec change
- Load the required project skills (see Skill Loading Guidance)
- Reuse existing architecture before introducing new abstractions
- Search for existing implementations before creating new ones
- Ask for clarification if requirements are ambiguous

**Before completion:**
- Always run `npm run build` after writing code to ensure it compiles successfully
- Run required verification commands (lint, typecheck, test)
- Check affected tests pass
- Ensure implementation matches the approved specification
- Summarize assumptions and remaining limitations

---

## Design Principles

- Keep controllers thin — controllers handle HTTP concerns only (parsing, guards, response formatting)
- All API responses must follow a single standard envelope based on ApiResponse<T> — use success, data, message, error, and details consistently, and avoid returning raw objects or inconsistent error shapes
- Business logic belongs in services — services contain all domain logic and orchestration
- External systems must be accessed through adapters — Stripe via PaymentProviderAdapter, never direct SDK calls in business logic
- Prefer composition over inheritance — use dependency injection and interfaces
- Prefer extending existing modules over introducing new ones
- Event-driven cross-module communication — modules emit events, never call each other directly
- Idempotent event handlers — webhook and event processing must handle duplicate delivery
- Atomic credit mutations — balance updates and transaction records in same database transaction
- No cross-module database writes — each module owns its tables exclusively

---

# AI Development Rules

Before writing code, read:
- .ai/rules/code-style_and_readability_rules.md
- .ai/rules/typescript-quality.md

## Project Conventions

**Module Organization:**
```
src/modules/{module}/
├── dto/              # Request/response DTOs with validation
├── entities/         # Prisma model types (generated)
├── {module}.controller.ts
├── {module}.service.ts
├── {module}.module.ts
└── {module}.spec.ts  # Unit tests
```

**DTO Validation:**
- All DTOs use class-validator decorators
- All DTOs use @nestjs/swagger decorators for API documentation
- Global ValidationPipe applied in main.ts

**Error Handling:**
- Services throw typed domain exceptions
- Global ExceptionFilter translates exceptions to HTTP responses
- Standardized error response format

**Dependency Injection:**
- All services registered in module providers
- PrismaService provided globally via PrismaModule
- PaymentProviderAdapter instances via PaymentProviderFactory

**Naming Conventions:**
- Controllers: {resource}.controller.ts (e.g., users.controller.ts)
- Services: {resource}.service.ts (e.g., billing.service.ts)
- DTOs: create-{resource}.dto.ts, update-{resource}.dto.ts
- Events: past tense (e.g., user.registered, subscription.created)

**Folder Conventions:**
- src/common/ — shared utilities, guards, filters, interceptors
- src/modules/ — bounded modules (user, billing, credit)
- src/prisma/ — Prisma schema and service
- src/events/ — event type definitions

---

## Critical Invariants

**Stripe Is Source of Truth:**
Local database mirrors Stripe state. On discrepancy, Stripe wins. Webhooks reconcile local state.

**Controllers Contain No Business Logic:**
Controllers handle HTTP concerns only. All business logic in services.

**Credit Mutations Are Atomic:**
Every CreditBalance change must have corresponding CreditTransaction in same database transaction. Balance must equal sum of all transactions.

**Webhook Processing Is Idempotent:**
No Stripe event processed more than once. WebhookEvent table enforces unique stripeEventId constraint.

**Credits Locked During PAST_DUE:**
When subscription.status == PAST_DUE, credit consumption rejected. No additions or consumption until ACTIVE or downgraded.

**One Active Subscription Per User:**
User has at most one subscription. Upgrades/downgrades modify existing subscription, never create second.

**Add-on Purchases Require Active Pro:**
Verify subscription.status == ACTIVE and plan.slug == 'pro' before add-on purchase. Enforced at guard and service level.

**Module Communication Is Event-Driven:**
Modules never call each other's services directly. All cross-module communication via event bus.

**No Cross-Module Database Writes:**
Module may read another module's tables but never write. Owning module is sole writer.

**All Credentials Via Environment Variables:**
No Stripe keys, JWT secrets, OAuth credentials, or database URLs in source code. All via ConfigModule and .env.

---

## Skill Loading Guidance

**Billing:**
→ billing (subscription lifecycle, plan management, payment methods)

**Stripe:**
→ stripe-integration (SDK usage, webhook handling, idempotency, testing)

**Database:**
→ prisma-migrations (schema changes, migration naming, seed data, rollback)

**Webhook:**
→ webhook (strategy pattern, idempotency, signature verification)

**Credit:**
→ credit-ledger-integrity (balance mutations, transaction recording, reset logic)

**Testing:**
→ testing-billing-flows (Stripe mocking, webhook simulation, event testing)

**NestJS:**
→ nestjs-module-patterns (module structure, DI, guards, interceptors, events)

---

## Database Workflow

**Schema Source of Truth:**
prisma/schema.prisma — single schema file for all modules

**Migration Workflow:**
1. Modify schema.prisma
2. Run `npx prisma migrate dev --name {descriptive_name}`
3. Review generated SQL in prisma/migrations/
4. Commit migration files
5. Deploy with `npx prisma migrate deploy`

**Verification Commands:**
```bash
npx prisma validate          # Validate schema
npx prisma migrate status    # Check migration status
npx prisma migrate diff      # Compare schema vs database
```

**Safety Rules:**
- Never modify applied migrations
- Never use `prisma db push` in production
- Always test migrations in development first
- Backup database before production migrations

**Reset Policy:**
Development only: `npx prisma migrate reset` (destroys data)
Production: Never reset. Use migrations only.

---

## Testing

**Testing Strategy:**
- Unit tests: Mock Prisma, mock Stripe, test services in isolation
- Integration tests: Test database, mock Stripe API responses, test full request flows
- E2E tests: Full HTTP request/response cycles

**Integration Testing:**
- Use separate test database
- Mock Stripe API with predictable responses
- Test webhook processing with fixture payloads
- Verify event flow between modules

**Required Coverage:**
- All service methods
- All critical billing flows (subscription lifecycle, payment failure, credit reset)
- All webhook event handlers
- All guards and interceptors

**Mandatory Verification Before Merge:**
- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test` passes (unit tests)
- `npm run test:e2e` passes (integration tests)
- No console.log or debugger statements

---

## CI Verification

Checks that must pass before code is considered complete:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npx prisma validate
```

---

## Security Rules

- Never log secrets, tokens, or credentials (Stripe keys, JWT secrets, passwords)
- Validate all external input with class-validator (global ValidationPipe)
- Sanitize error messages — never expose internal details to clients
- Hash passwords with bcrypt before storage
- Verify Stripe webhook signatures before processing
- Use HTTPS in production (enforced at infrastructure level)
- Rate limit authentication endpoints
- Least privilege — guards enforce role-based access on all endpoints
- Environment variables for all secrets — never hardcode
- SQL injection prevention via Prisma (no raw SQL)

---

## Decision Rules

When making implementation decisions:

- Prefer consistency with the existing architecture over introducing new patterns
- Prefer extending existing modules over creating parallel implementations
- Prefer explicit code over clever abstractions
- If multiple valid solutions exist, choose the one that minimizes maintenance cost
- Never change architectural decisions without updating OpenSpec first
- Reuse existing adapters and strategies before creating new ones
- Follow NestJS conventions and idioms
- When in doubt, ask for clarification before implementing
