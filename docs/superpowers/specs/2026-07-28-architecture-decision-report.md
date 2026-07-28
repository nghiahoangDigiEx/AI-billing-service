# Architecture Decision Report

**Project:** AI Platform Billing Service  
**Date:** 2026-07-28  
**Based on:** `docs/superpowers/specs/2026-07-28-billing-service-design.md`  
**Status:** For Review

---

## 1. Project Overview

The system is an AI platform backend service responsible for three concerns:

1. **User identity and authentication** — registration, login, OAuth, role management
2. **Billing and payments** — Stripe subscriptions, invoicing, payment method management, add-on purchases
3. **Credit management** — ledger, monthly resets, consumption tracking

It is deployed as a single NestJS application (modular monolith) backed by a PostgreSQL database hosted on Neon, with Stripe as the external payment provider.

---

## 2. Domain Decomposition

### 2.1 User Module

**Responsibility:** Identity lifecycle and access control.

- User registration (email/password and Google OAuth)
- Authentication (JWT access + refresh tokens)
- Profile management
- Role-based access control (USER, ADMIN)

**Boundary:** This module owns the concept of "who is the user" and "what can they do." It does not know about subscriptions, plans, or credits.

### 2.2 Billing Module

**Responsibility:** Payment lifecycle and Stripe integration.

- Plan and add-on configuration (admin CRUD)
- Subscription creation, upgrade, downgrade, cancellation
- Payment method management
- Stripe webhook processing with idempotency
- Invoice and payment attempt tracking
- Payment retry lifecycle (delegated to Stripe automatic retries)

**Boundary:** This module owns the concept of "what is the user paying for" and "did the payment succeed." It does not manage credit balances directly — it emits events that the Credit Module consumes.

### 2.3 Credit Module

**Responsibility:** Credit ledger and consumption lifecycle.

- Credit balance tracking
- Credit allocation on subscription renewal and add-on purchase
- Monthly credit reset (webhook-driven for Free/Pro-Monthly, cron-driven for Pro-Annual)
- Credit consumption with balance validation
- Transaction history

**Boundary:** This module owns the concept of "how many credits does the user have" and "can they consume." It reacts to billing events but never calls Stripe directly.

### 2.4 Domain Interaction Map

```
                    ┌─────────────┐
                    │ User Module │
                    └──────┬──────┘
                           │ user.registered
                           ▼
                    ┌──────────────┐
                    │Billing Module│
                    └──────┬───────┘
                           │ subscription.created
                           │ subscription.renewed
                           │ subscription.downgraded
                           │ addon.purchased
                           │ payment.failed
                           ▼
                    ┌──────────────┐
                    │ Credit Module│
                    └──────────────┘
```

**Dependency direction:** User → Billing → Credit. The Credit Module depends on events from Billing. Billing depends on User for identity. Credit never calls Billing. Billing never calls Credit directly.

---

## 3. Architecture

### 3.1 Style: Event-Driven Modular Monolith with Layered Internals

The architecture is a **hybrid** of two patterns:

**Externally (between modules): Event-Driven**  
Modules communicate through an internal event bus (`EventEmitter2`). This provides loose coupling — the Billing Module emits domain events without knowing who consumes them. The Credit Module subscribes to events without knowing who produces them.

**Internally (within each module): Layered**  
Each module follows a standard NestJS layered structure: Controller → Service → Repository (Prisma). This is the simplest pattern that satisfies the requirements and aligns with NestJS conventions.

### 3.2 Why This Fits

| Requirement | How the architecture addresses it |
|---|---|
| Three bounded concerns | Three modules with clear boundaries |
| Future extractability | Event-driven coupling makes any module extractable into a separate service |
| Simple deployment | Single NestJS process, single database |
| Stripe as payment authority | Billing Module isolates all Stripe calls behind a service layer |
| Credit integrity | Credit Module is the sole authority for balance mutations |

### 3.3 What Was Considered and Rejected

| Alternative | Why rejected |
|---|---|
| Clean Architecture / Hexagonal | Over-engineering for a 3-module MVP. The added abstraction layers (use cases, ports/adapters) provide no benefit when Prisma is the only data source and Stripe is the only external integration. |
| Microservices from day one | Unnecessary operational complexity. No existing consumers. Modular monolith preserves extractability. |
| CQRS | Credit ledger is append-only transactions with a derived balance. This is naturally CQRS-like, but formal CQRS with separate read/write models adds complexity without benefit at this scale. The transaction log + balance pattern is sufficient. |

---

## 4. Dependency Flow

### 4.1 Standard Request Flow

```
HTTP Request
  │
  ▼
Controller          ← Input validation (DTO + class-validator)
  │                     Auth guards (JWT, Role, Subscription)
  │                     Response formatting
  ▼
Service             ← Business logic
  │                     Event emission
  │                     Orchestration
  ▼
Prisma Client       ← Data access
  │                     Query building
  ▼
PostgreSQL (Neon)   ← Persistence
```

### 4.2 Webhook Flow (Exception to Standard)

```
Stripe Webhook POST
  │
  ▼
WebhookController   ← Signature verification (not JWT)
  │                     Idempotency check (WebhookEvent table)
  ▼
WebhookService      ← Event-specific processing
  │                     Invoice/PaymentAttempt updates
  │                     Event emission to Credit Module
  ▼
Prisma Client
  ▼
PostgreSQL
```

**Exception:** The webhook endpoint bypasses JWT authentication. Instead, it uses Stripe webhook signature verification. This is a deliberate and necessary exception — Stripe cannot provide a JWT.

### 4.3 Event Flow (Cross-Module)

```
BillingService      ← Emits domain event
  │
  ▼
EventEmitter2       ← Internal event bus
  │
  ▼
CreditEventListener ← Subscribes to specific events
  │
  ▼
CreditService       ← Processes event (allocate, reset, lock)
  │
  ▼
Prisma Client
  ▼
PostgreSQL
```

**Rule:** Event handlers must be idempotent. An event may be delivered more than once (e.g., during application restart). Handlers must check whether the event has already been processed before mutating state.

### 4.4 Cron Flow (Pro Annual Reset)

```
NestJS Scheduler    ← Daily cron trigger
  │
  ▼
CreditService       ← Find Pro annual subscriptions due for reset
  │
  ▼
Prisma Client
  ▼
PostgreSQL
```

---

## 5. Integration Boundaries

### 5.1 Stripe

**Location:** Isolated within the Billing Module's `stripe/` subdirectory.

**Boundary:** A `StripeService` wrapper encapsulates all Stripe SDK calls. No other module imports the Stripe SDK directly.

**Integration points:**
- Customer creation
- Subscription management
- Price/product creation (when admin creates plans/add-ons)
- Payment method management
- Webhook signature verification

**Direction:** Billing Module → Stripe (outbound calls). Stripe → Billing Module (inbound webhooks).

### 5.2 PostgreSQL (Neon)

**Location:** Accessed exclusively through Prisma Client, injected via NestJS DI.

**Boundary:** A shared `PrismaService` provides the client. All modules use it. No raw SQL.

**Integration points:**
- All CRUD operations
- Migrations via `prisma migrate`
- Seeding via seed scripts

### 5.3 Google OAuth

**Location:** Isolated within the User Module's `strategies/` subdirectory.

**Boundary:** Passport.js Google strategy. Only the User Module handles OAuth tokens.

**Integration points:**
- OAuth redirect flow
- Token exchange
- User creation/update on OAuth callback

### 5.4 Unknown / Not Specified

The following integrations are **not specified** in the approved spec and should not be built:

- Email service (explicitly out of scope for MVP)
- Redis / caching layer
- Message queue (RabbitMQ, Kafka)
- External AI service
- Monitoring / observability platform

---

## 6. Data Ownership

| Entity | Owner Module | Who May Write | Who May Read |
|---|---|---|---|
| `User` | User | User Module (registration, profile update, role change) | All modules (via `userId` foreign keys, read-only) |
| `Plan` | Billing | Billing Module (admin CRUD) | Credit Module (read-only, for credit amounts) |
| `Subscription` | Billing | Billing Module (lifecycle changes, webhook sync) | Credit Module (read-only, for reset logic and status checks) |
| `PaymentMethod` | Billing | Billing Module (Stripe sync) | Billing Module only |
| `Invoice` | Billing | Billing Module (webhook processing) | User (own invoices, read-only) |
| `PaymentAttempt` | Billing | Billing Module (webhook processing) | Billing Module only |
| `WebhookEvent` | Billing | Billing Module (webhook ingestion) | Billing Module only |
| `Addon` | Billing | Billing Module (admin CRUD) | Credit Module (read-only, for credit amounts) |
| `AddonPurchase` | Billing | Billing Module (purchase flow) | Credit Module (read-only, via events) |
| `CreditBalance` | Credit | Credit Module (allocation, reset, consumption) | User (own balance, read-only) |
| `CreditTransaction` | Credit | Credit Module (all mutations) | User (own history, read-only) |

### 6.1 Ownership Rules

- **No cross-module writes.** The Credit Module never writes to `Subscription`. The Billing Module never writes to `CreditBalance`.
- **Foreign keys are allowed across module boundaries** (e.g., `Subscription.userId` references `User.id`). This is acceptable in a modular monolith with a shared database.
- **Read access across modules is permitted** but must go through the owning module's service layer or a shared read-only query, not direct Prisma access to another module's tables.

---

## 7. Cross-Cutting Concerns

### 7.1 Authentication

- **Mechanism:** JWT (access + refresh tokens) via Passport.js
- **Scope:** Global. Applied via `JwtAuthGuard` on all protected endpoints.
- **Exceptions:** Auth endpoints (register, login, OAuth), webhook endpoint (signature-based).
- **Token payload:** `{ userId, email, role }`

### 7.2 Authorization

- **Mechanism:** Role-based guards (`RolesGuard`) + subscription status guards (`SubscriptionGuard`)
- **Roles:** USER (default), ADMIN
- **Application:** ADMIN guards on plan/addon management, user role management, manual credit adjustment. Subscription guard on add-on purchases (Pro only) and credit consumption (not PAST_DUE).

### 7.3 Validation

- **Mechanism:** `class-validator` + NestJS `ValidationPipe` (global)
- **Scope:** All request bodies, query parameters, and path parameters validated via DTOs.
- **Rule:** Controllers never validate manually. All validation is declarative in DTOs.

### 7.4 Error Handling

- **Mechanism:** Global exception filter (NestJS `ExceptionFilter`)
- **Scope:** Standardized API response format for all errors.
- **Rule:** Services throw domain exceptions. The global filter translates them to HTTP responses.

### 7.5 Transactions

- **Mechanism:** Prisma interactive transactions (`prisma.$transaction`)
- **Critical paths:**
  - Credit balance update + transaction record creation (must be atomic)
  - Invoice processing + payment attempt creation (must be atomic)
  - Subscription creation + Stripe customer creation (should be atomic where possible)
- **Rule:** Any operation that writes to multiple tables in a single logical unit must use a Prisma transaction.

### 7.6 Idempotency

- **Mechanism:** `WebhookEvent` table with unique `stripeEventId` constraint.
- **Scope:** All Stripe webhook processing.
- **Rule:** Before processing a webhook event, check if `stripeEventId` already exists. If yes, return 200 without reprocessing.

### 7.7 Configuration

- **Mechanism:** NestJS `ConfigModule` with `.env` file.
- **Scope:** All external credentials (Stripe keys, JWT secrets, OAuth credentials, database URL).
- **Rule:** No hardcoded secrets. All configuration via environment variables.

### 7.8 Background Jobs

- **Mechanism:** NestJS `@nestjs/schedule` (cron jobs).
- **Scope:** Pro annual credit reset (daily cron check).
- **Rule:** Cron jobs must be idempotent. A reset that already occurred today must not be repeated.

### 7.9 Logging

- **Status:** Not specified in the approved spec.
- **Recommendation:** Use NestJS built-in `Logger` for development. Structured logging (e.g., `pino`) for production. This should be decided before implementation but is not a blocking concern.

### 7.10 API Documentation

- **Mechanism:** `@nestjs/swagger` (OpenAPI/Swagger).
- **Scope:** All endpoints documented with request/response schemas.
- **Rule:** DTOs must include Swagger decorators. This is a non-negotiable deliverable per the spec.

---

## 8. Non-Negotiable Invariants

These rules are derived directly from the approved specification and must never be violated:

### 8.1 Stripe Is the Source of Truth for Payment State

The local database mirrors Stripe's state. If there is a discrepancy, Stripe wins. Webhook processing reconciles local state with Stripe's authoritative state.

### 8.2 Controllers Contain No Business Logic

Controllers handle HTTP concerns only: request parsing, guard application, response formatting. All business logic lives in services.

### 8.3 Credit Mutations Are Atomic

Every change to `CreditBalance` must be accompanied by a `CreditTransaction` record in the same database transaction. The balance must always equal the sum of all transactions.

### 8.4 Webhook Processing Is Idempotent

No Stripe event may be processed more than once. The `WebhookEvent` table enforces this at the database level (unique constraint on `stripeEventId`).

### 8.5 Credits Are Locked During PAST_DUE

When a subscription status is `PAST_DUE`, credit consumption must be rejected. Credits are neither added nor consumed until the subscription returns to `ACTIVE` or is downgraded.

### 8.6 One Active Subscription Per User

A user may have at most one subscription record. Upgrading, downgrading, or changing billing type modifies the existing subscription — it does not create a second one.

### 8.7 Add-on Purchases Require Active Pro Subscription

The system must verify `subscription.status == ACTIVE` and `plan.slug == 'pro'` before allowing an add-on purchase. This is enforced at both the API guard level and the service level.

### 8.8 Module Communication Is Event-Driven

Modules never call each other's services directly. All cross-module communication goes through the event bus. This preserves module boundaries and future extractability.

### 8.9 No Cross-Module Database Writes

A module may read another module's tables but may never write to them. The owning module is the sole writer of its own tables.

### 8.10 All External Credentials Via Environment Variables

No Stripe keys, JWT secrets, OAuth credentials, or database URLs may appear in source code. All configuration flows through `ConfigModule` and `.env` files.

---

## 9. Recommended Project Skills

### 9.1 `stripe-integration`

- **Purpose:** Guidelines for Stripe SDK usage, webhook handling, idempotency patterns, and testing with Stripe test mode.
- **When to load:** When implementing any Stripe-related code (customer creation, subscription management, webhook processing, payment method handling).

### 9.2 `prisma-migrations`

- **Purpose:** Standards for Prisma schema changes, migration naming, seed data, and rollback procedures.
- **When to load:** When creating or modifying Prisma schema, running migrations, or writing seed scripts.

### 9.3 `nestjs-module-patterns`

- **Purpose:** Conventions for NestJS module structure, dependency injection, guard/interceptor/filter patterns, and event emitter usage.
- **When to load:** When creating new modules, services, controllers, guards, or event listeners.

### 9.4 `credit-ledger-integrity`

- **Purpose:** Rules for credit balance mutations, transaction recording, reset logic, and balance validation.
- **When to load:** When implementing any credit-related logic (allocation, consumption, reset, adjustment).

### 9.5 `testing-billing-flows`

- **Purpose:** Patterns for testing billing flows including Stripe mocking, webhook simulation, event testing, and database transaction testing.
- **When to load:** When writing unit or integration tests for billing and credit flows.

---

## 10. Candidate AGENTS.md Sections

The following sections should appear in `AGENTS.md` to guide AI-assisted development:

### 10.1 Project Overview
Brief description of the system, its three modules, and the modular monolith approach.

### 10.2 Tech Stack
NestJS, Prisma, PostgreSQL (Neon), Stripe, Passport.js, EventEmitter2, class-validator, @nestjs/swagger.

### 10.3 Development Commands
- `npm run dev` — Start development server
- `npm run build` — Production build
- `npx prisma migrate dev` — Run migrations
- `npx prisma generate` — Generate Prisma client
- `npm run test` — Run unit tests
- `npm run test:e2e` — Run integration tests
- `npm run lint` — Lint check
- `stripe listen --forward-to http://localhost:3000/webhooks/stripe` — Webhook forwarding

### 10.4 Architecture Rules
The non-negotiable invariants from Section 8, summarized for quick reference.

### 10.5 Module Boundaries
The three modules, their responsibilities, and the rule that cross-module communication is event-driven only.

### 10.6 Testing Conventions
- Unit tests: Mock Prisma, mock Stripe, test services in isolation.
- Integration tests: Use test database, mock Stripe API responses, test full request flows.
- Critical flows to cover: subscription lifecycle, payment failure, credit reset, add-on purchase.

### 10.7 Code Style
- TypeScript strict mode.
- DTOs with class-validator decorators and Swagger decorators.
- Services throw typed exceptions, not generic errors.
- No raw SQL — all queries through Prisma.

### 10.8 Environment Variables
List of required environment variables with descriptions (no values).

### 10.9 Database Conventions
- UUIDs for all primary keys.
- `createdAt` and `updatedAt` on all tables.
- Prisma migrations only — no manual SQL.
- Seed scripts for development data.
