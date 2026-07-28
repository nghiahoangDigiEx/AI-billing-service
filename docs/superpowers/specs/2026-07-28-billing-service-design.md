# Billing Service Design Specification

**Date:** 2026-07-28  
**Status:** Draft  
**Author:** AI Platform Team

---

## 1. Overview

An AI platform billing service managing user authentication, Stripe subscriptions, and credit-based consumption. Built as a modular monolith with three bounded modules: User/Auth, Billing, and Credit.

### 1.1 Core Requirements

- **Subscription Plans:** Free (50 credits/month, no payment) and Pro (configurable credits, payment required)
- **Billing Cycles:** Monthly, Annually, Add-ons (one-time credit purchases)
- **Credit Management:** Monthly reset based on subscription start date, transaction history tracking
- **Payment Handling:** Stripe integration with automatic retry (3 attempts in 3 days), downgrade on failure
- **Admin Configuration:** Plans, pricing, and add-ons managed via APIs by admin users

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Application                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  User Module │  │ Billing Mod. │  │ Credit Mod.  │      │
│  │              │  │              │  │              │      │
│  │ - Auth       │  │ - Stripe     │  │ - Ledger     │      │
│  │ - JWT        │  │ - Subs       │  │ - Reset      │      │
│  │ - OAuth      │  │ - Webhooks   │  │ - Consume    │      │
│  │ - Profile    │  │ - Plans      │  │ - Add-ons    │      │
│  │ - Roles      │  │ - Add-ons    │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────┴───────┐                         │
│                    │  Event Bus   │                         │
│                    │(EventEmitter)│                         │
│                    └──────┬───────┘                         │
│                           │                                 │
│                    ┌──────┴───────┐                         │
│                    │   Prisma     │                         │
│                    │     ORM      │                         │
│                    └──────┬───────┘                         │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  PostgreSQL (Neon)      │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │      Stripe API         │
              └─────────────────────────┘
```

### 2.2 Module Boundaries

| Module | Responsibilities |
|--------|------------------|
| **User Module** | Registration, login, OAuth, profile management, role-based access control |
| **Billing Module** | Stripe integration, subscription lifecycle, plan management, add-on purchases, webhook handling |
| **Credit Module** | Credit ledger, monthly resets, consumption tracking, add-on credit allocation |

### 2.3 Internal Communication

Event-driven via `EventEmitter2`. Modules communicate through domain events:

- `user.registered` → Billing module creates free subscription
- `subscription.created` → Credit module allocates initial credits
- `subscription.renewed` → Credit module resets monthly credits
- `payment.failed` → Billing module updates subscription status
- `subscription.downgraded` → Credit module resets to Free tier limits
- `addon.purchased` → Credit module adds purchased credits
- `credits.consumed` → Credit module deducts from balance

---

## 3. Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | NestJS | Modular architecture, TypeScript, dependency injection |
| ORM | Prisma | Type-safe, mature NestJS integration, migrations |
| Database | PostgreSQL (Neon) | ACID compliance, JSON support, managed hosting |
| Payment | Stripe SDK | Industry standard, webhook support, automatic retries |
| Auth | Passport.js | JWT + OAuth strategies, NestJS integration |
| Events | EventEmitter2 | Lightweight, built-in NestJS support |
| Validation | class-validator | DTO validation, NestJS integration |

---

## 4. Database Schema

### 4.1 User Module

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String?   // null for OAuth users
  name          String?
  avatar        String?
  role          Role      @default(USER)
  provider      Provider  @default(LOCAL)
  providerId    String?   // Google OAuth ID
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  subscription  Subscription?
  creditBalance CreditBalance?
  creditTransactions CreditTransaction[]
  invoices      Invoice[]
}

enum Role {
  USER
  ADMIN
}

enum Provider {
  LOCAL
  GOOGLE
}
```

### 4.2 Billing Module

```prisma
model Plan {
  id              String    @id @default(uuid())
  name            String    // "Free", "Pro"
  slug            String    @unique // "free", "pro"
  description     String?
  baseCredits     Int       // credits per month
  priceMonthly    Float?    // null for free plan
  priceAnnual     Float?    // null for free plan
  stripePriceMonthly String? // Stripe price ID
  stripePriceAnnual  String? // Stripe price ID
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  subscriptions   Subscription[]
  addons          Addon[]
}

model Subscription {
  id              String    @id @default(uuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  planId          String
  plan            Plan      @relation(fields: [planId], references: [id])
  status          SubscriptionStatus
  billingType     BillingType? // null for free plan
  stripeCustomerId String?
  stripeSubscriptionId String?
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelAtPeriodEnd  Boolean @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  paymentMethods  PaymentMethod[]
  invoices        Invoice[]
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

enum BillingType {
  MONTHLY
  ANNUAL
}

model PaymentMethod {
  id              String    @id @default(uuid())
  subscriptionId  String
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
  stripePaymentMethodId String @unique
  brand           String    // "visa", "mastercard"
  last4           String
  expMonth        Int
  expYear         Int
  isDefault       Boolean   @default(false)
  createdAt       DateTime  @default(now())

  paymentAttempts PaymentAttempt[]
}

model Addon {
  id              String    @id @default(uuid())
  name            String    // "100 Credits", "500 Credits"
  credits         Int
  price           Float
  stripePriceId   String    @unique
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  addonPurchases  AddonPurchase[]
}

model AddonPurchase {
  id              String    @id @default(uuid())
  userId          String
  addonId         String
  addon           Addon     @relation(fields: [addonId], references: [id])
  stripeInvoiceId String    @unique
  amountPaid      Float
  creditsAdded    Int
  purchasedAt     DateTime  @default(now())
}

model Invoice {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  subscriptionId    String?
  subscription      Subscription? @relation(fields: [subscriptionId], references: [id])
  stripeInvoiceId   String    @unique
  stripeCustomerId  String
  amount            Float
  currency          String    @default("usd")
  status            InvoiceStatus
  billingType       BillingType?
  periodStart       DateTime?
  periodEnd         DateTime?
  paidAt            DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  paymentAttempts   PaymentAttempt[]
}

enum InvoiceStatus {
  DRAFT
  OPEN
  PAID
  VOID
  UNCOLLECTIBLE
}

model PaymentAttempt {
  id                String    @id @default(uuid())
  invoiceId         String
  invoice           Invoice   @relation(fields: [invoiceId], references: [id])
  stripePaymentIntentId String?
  attemptNumber     Int       @default(1)
  status            PaymentStatus
  amount            Float
  errorMessage      String?
  paymentMethodId   String?
  paymentMethod     PaymentMethod? @relation(fields: [paymentMethodId], references: [id])
  attemptedAt       DateTime  @default(now())
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  REQUIRES_ACTION
}

model WebhookEvent {
  id              String    @id @default(uuid())
  stripeEventId   String    @unique
  eventType       String
  payload         Json
  processedAt     DateTime?
  createdAt       DateTime  @default(now())
}
```

### 4.3 Credit Module

```prisma
model CreditBalance {
  id              String    @id @default(uuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  balance         Int       @default(0)
  lastResetAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  transactions    CreditTransaction[]
}

model CreditTransaction {
  id              String    @id @default(uuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  creditBalanceId String
  creditBalance   CreditBalance @relation(fields: [creditBalanceId], references: [id])
  type            CreditTransactionType
  amount          Int       // positive for additions, negative for consumption
  description     String    // "Monthly subscription renewed", "Purchased add-on", "Consumed 10 credits"
  referenceId     String?   // subscription ID, addon purchase ID, etc.
  createdAt       DateTime  @default(now())
}

enum CreditTransactionType {
  SUBSCRIPTION_RENEWAL
  ADDON_PURCHASE
  CONSUMPTION
  MANUAL_ADJUSTMENT
  RESET
}
```

---

## 5. Module Specifications

### 5.1 User Module

#### 5.1.1 Features

- **Registration:** Email/password with validation
- **Login:** JWT access + refresh tokens
- **OAuth:** Google OAuth via Passport.js
- **Profile:** View/update user profile
- **Role Management:** Admin endpoints to manage user roles

#### 5.1.2 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | Public |
| POST | `/auth/login` | Login with email/password | Public |
| POST | `/auth/refresh` | Refresh access token | Refresh token |
| GET | `/auth/google` | Initiate Google OAuth | Public |
| GET | `/auth/google/callback` | Google OAuth callback | Public |
| GET | `/users/me` | Get current user profile | JWT |
| PATCH | `/users/me` | Update profile | JWT |
| GET | `/users` | List all users (admin) | JWT + ADMIN |
| PATCH | `/users/:id/role` | Update user role (admin) | JWT + ADMIN |

#### 5.1.3 Events Emitted

- `user.registered` — New user registered

---

### 5.2 Billing Module

#### 5.2.1 Features

- **Plan Management:** Admin CRUD for subscription plans
- **Subscription Lifecycle:** Create, update, cancel subscriptions
- **Payment Methods:** Add, remove, set default payment methods
- **Add-on Purchases:** One-time credit purchases for Pro users
- **Webhook Handling:** Process Stripe events with idempotency
- **Invoice Tracking:** Track invoices and payment attempts

#### 5.2.2 API Endpoints

**Admin Endpoints:**

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/admin/plans` | Create plan | JWT + ADMIN |
| GET | `/admin/plans` | List all plans | JWT + ADMIN |
| PATCH | `/admin/plans/:id` | Update plan | JWT + ADMIN |
| POST | `/admin/addons` | Create add-on | JWT + ADMIN |
| GET | `/admin/addons` | List all add-ons | JWT + ADMIN |
| PATCH | `/admin/addons/:id` | Update add-on | JWT + ADMIN |

**User Endpoints:**

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/plans` | List active plans | JWT |
| GET | `/addons` | List active add-ons | JWT |
| POST | `/subscriptions` | Create subscription | JWT |
| GET | `/subscriptions/me` | Get current subscription | JWT |
| PATCH | `/subscriptions/me` | Update subscription (upgrade/downgrade) | JWT |
| DELETE | `/subscriptions/me` | Cancel subscription | JWT |
| POST | `/payment-methods` | Add payment method | JWT |
| GET | `/payment-methods` | List payment methods | JWT |
| DELETE | `/payment-methods/:id` | Remove payment method | JWT |
| POST | `/addons/:id/purchase` | Purchase add-on (Pro only) | JWT |
| GET | `/invoices` | List invoices | JWT |
| GET | `/invoices/:id` | Get invoice details | JWT |
| POST | `/webhooks/stripe` | Stripe webhook endpoint | Public (signed) |

#### 5.2.3 Stripe Integration

**Customer Creation:**
- Create Stripe customer on first subscription
- Store `stripeCustomerId` in `Subscription` table

**Subscription Management:**
- Use Stripe Prices for monthly/annual billing
- Sync subscription status via webhooks

**Webhook Events Handled:**

| Event | Action |
|-------|--------|
| `invoice.paid` | Update invoice status, allocate credits, emit `subscription.renewed` |
| `invoice.payment_failed` | Update invoice status, create payment attempt, update subscription to PAST_DUE |
| `customer.subscription.updated` | Sync subscription details |
| `customer.subscription.deleted` | Cancel subscription, downgrade to Free, emit `subscription.downgraded` |
| `payment_method.attached` | Save payment method |
| `payment_method.detached` | Remove payment method |

**Idempotency:**
- Store `stripeEventId` in `WebhookEvent` table
- Skip processing if event already exists
- Mark `processedAt` after successful handling

#### 5.2.4 Payment Retry Logic

- Stripe handles automatic retries (3 attempts in 3 days)
- Each retry creates a `PaymentAttempt` record
- After 3 failures, Stripe cancels subscription
- Webhook triggers downgrade to Free plan
- Credits locked while subscription is PAST_DUE

#### 5.2.5 Events Emitted

- `subscription.created` — New subscription created
- `subscription.renewed` — Subscription renewed (payment successful)
- `subscription.downgraded` — Subscription downgraded to Free
- `payment.failed` — Payment attempt failed
- `addon.purchased` — Add-on purchased

---

### 5.3 Credit Module

#### 5.3.1 Features

- **Credit Ledger:** Track current balance and transaction history
- **Monthly Reset:** Reset credits based on subscription type
- **Consumption:** Deduct credits for AI operations (simulated)
- **Add-on Allocation:** Add credits from purchased add-ons

#### 5.3.2 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/credits/balance` | Get current credit balance | JWT |
| GET | `/credits/transactions` | List credit transactions | JWT |
| POST | `/credits/consume` | Consume credits (simulation) | JWT |
| POST | `/credits/adjust` | Manual credit adjustment (admin) | JWT + ADMIN |

#### 5.3.3 Credit Reset Strategy

**Free Plan:**
- Stripe webhook (`invoice.paid`) triggers monthly reset
- 50 credits allocated

**Pro Monthly:**
- Stripe webhook (`invoice.paid`) triggers reset on successful payment
- Configurable credits based on plan

**Pro Annual:**
- Cron job runs daily
- Checks for Pro annual subscriptions
- Resets credits monthly based on subscription start date
- Configurable credits based on plan

#### 5.3.4 Credit Consumption

- Fixed cost per operation (simulated)
- Check balance before consumption
- Create `CreditTransaction` record with type `CONSUMPTION`
- Deduct from `CreditBalance`
- Reject if insufficient credits or subscription is PAST_DUE

#### 5.3.5 Events Emitted

- `credits.added` — Credits added to balance
- `credits.consumed` — Credits consumed
- `credits.reset` — Monthly credit reset completed

---

## 6. Authentication & Authorization

### 6.1 JWT Strategy

- **Access Token:** Short-lived (15 minutes), included in `Authorization: Bearer <token>`
- **Refresh Token:** Long-lived (7 days), stored in database, rotated on use
- **Payload:** `{ userId, email, role }`

### 6.2 OAuth Flow

1. User initiates Google OAuth
2. Passport.js redirects to Google
3. Google redirects back with code
4. Exchange code for tokens
5. Create or update user record
6. Issue JWT access + refresh tokens

### 6.3 Role-Based Access

- **USER:** Default role, access to own resources
- **ADMIN:** Full access to admin endpoints, can manage users/plans/add-ons

### 6.4 Guards

- `JwtAuthGuard` — Validates JWT token
- `RolesGuard` — Checks user role (USER, ADMIN)
- `SubscriptionGuard` — Checks active subscription status

---

## 7. Environment Configuration

```env
# Database
DATABASE_URL="postgresql://user:password@neon.tech/dbname"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_REFRESH_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLIC_KEY="pk_test_..."

# App
PORT=3000
NODE_ENV="development"
```

---

## 8. Development Setup

### 8.1 Stripe CLI

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to localhost
stripe listen --forward-to http://localhost:3000/webhooks/stripe
```

### 8.2 Database Setup

```bash
# Install Prisma
npm install @prisma/client prisma

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npm run seed
```

### 8.3 Project Structure

```
src/
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── modules/
│   ├── user/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── user.controller.ts
│   │   ├── user.module.ts
│   │   ├── user.service.ts
│   │   └── strategies/
│   ├── billing/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── stripe/
│   │   ├── webhooks/
│   │   ├── billing.controller.ts
│   │   ├── billing.module.ts
│   │   └── billing.service.ts
│   └── credit/
│       ├── dto/
│       ├── entities/
│       ├── credit.controller.ts
│       ├── credit.module.ts
│       └── credit.service.ts
├── events/
│   └── events.ts
├── prisma/
│   └── schema.prisma
├── app.module.ts
└── main.ts
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

- Service methods with mocked dependencies
- DTO validation
- Guard logic

### 9.2 Integration Tests

- API endpoints with test database
- Stripe webhook processing (mock Stripe API)
- Event flow between modules

### 9.3 Critical Flows to Test

- User registration and login
- Subscription creation and renewal
- Payment failure and retry
- Subscription downgrade
- Credit allocation and reset
- Add-on purchase
- Credit consumption

---

## 10. API Documentation

- Use `@nestjs/swagger` for OpenAPI/Swagger documentation
- Document all endpoints with request/response schemas
- Include authentication requirements
- Provide example payloads

---

## 11. Security Considerations

- Hash passwords with bcrypt
- Validate all input with class-validator
- Rate limiting on auth endpoints
- HTTPS in production
- Environment variables for secrets
- Webhook signature verification
- SQL injection prevention (Prisma handles this)

---

## 12. Out of Scope (MVP)

- Email notifications
- Actual AI service integration
- Multi-tenancy
- Advanced analytics
- Payment method validation (3D Secure handling delegated to Stripe)

---

## 13. Future Enhancements

- Email notifications (SendGrid, Resend)
- Team/organization support
- Usage-based billing
- Advanced credit consumption (variable costs)
- Analytics dashboard
- Stripe Customer Portal integration
