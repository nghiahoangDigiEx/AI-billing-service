# Billing Service API

Billing Service API managing user authentication, subscriptions, and credit-based consumption with Stripe integration.

## Architecture

This project follows an event-driven modular monolith architecture with layered internals.
- **User Module**: Identity, authentication, authorization, OAuth.
- **Billing Module**: Stripe integration, subscriptions, payments, add-ons.
- **Credit Module**: Ledger, monthly resets, consumption, freeze/unfreeze logic.

Cross-module communication is achieved via an **Event Bus** (EventEmitter2) and an **Outbox Pattern** to ensure reliable domain event delivery. Idempotency is guaranteed via the **Inbox Pattern** on the consumer side.

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Stripe Configuration

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/).
2. Obtain your **Publishable key** and **Secret key** from the Developers API keys section.
3. Obtain a **Webhook Signing Secret** by setting up a webhook (see Webhook Setup below).

### 3. Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

```env
# Database
DATABASE_URL="postgres://user:pass@host:port/db"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
JWT_REFRESH_EXPIRES_IN="7d"
GOOGLE_CLIENT_ID="google-client-id"
GOOGLE_CLIENT_SECRET="google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# Application
PORT=3000

# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_FREE_PLAN_PRICE_ID="price_1..." # Price ID for the default Free plan

# Billing Config
BILLING_MAX_RETRIES=5 # Max retries for Stripe setup background job
```

### 4. Database Setup & Seed

Initialize the database and seed the default plans and admin user (`admin@example.com` / `admin123`).

```bash
npx prisma generate
npx prisma migrate dev
npm run seed
```

### 5. Local Development & Webhooks

To receive Stripe webhooks locally, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

```bash
stripe login
stripe listen --forward-to http://localhost:3000/webhooks/stripe
```

Use the `whsec_...` secret printed by the CLI as your `STRIPE_WEBHOOK_SECRET` in `.env`.

**Events to enable in Stripe Dashboard (for production webhooks):**
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `payment_intent.succeeded`

---

## API Endpoints Summary

Swagger API documentation is accessible at `/api` when the server is running.

### Admin Endpoints (Requires ADMIN role)
- `POST /admin/plans`: Create a new billing plan (syncs Product/Price to Stripe).
- `POST /admin/addons`: Create a new credit add-on package (syncs Product/Price to Stripe).

### User Endpoints (Requires Authentication)
- `GET /subscriptions/my-plan`: View current active subscription and plan details.
- `POST /subscriptions/upgrade`: Upgrade to a paid plan.
- `POST /subscriptions/downgrade`: Downgrade to the Free plan.
- `POST /addons/purchase`: Purchase an add-on (returns Stripe Client Secret to complete payment).
- `GET /public/plans`: List available subscription plans.
- `GET /public/addons`: List available add-on packages.

---

## Technical Documentation

### Webhook Event Handling & Idempotency
Stripe webhooks are processed by the `WebhookController`, verified via signature, and mapped to internal generic events by `StripeWebhookStrategy`.
Each webhook event triggers a business operation (e.g., `invoice.paid` handles subscription renewal). To guarantee exactly-once processing:
1. `stripeEventId` is stored in the `WebhookEvent` table within the same transaction as the business operation.
2. If Stripe delivers the same webhook twice, the database constraint `UNIQUE(stripeEventId)` ensures the second attempt is safely ignored.

### Subscription Lifecycle
- **Registration**: Users get a default `Free` subscription. A background job (`BillingScheduler`) ensures Stripe Customer and Free Subscription are created.
- **Upgrade**: Modifies the existing Stripe subscription and updates the local state to `ACTIVE` with the new Plan.
- **Downgrade**: Cancels the paid Stripe subscription at the end of the billing cycle (or immediately). Local state reflects `Free` once the webhook `customer.subscription.deleted` is received.
- **Payment Failure**: Webhook `invoice.payment_failed` changes the local state to `PAST_DUE`. Add-ons are frozen.
- **Recovery**: Webhook `invoice.paid` for a `PAST_DUE` subscription restores the status to `ACTIVE`. Add-ons are unfrozen.

### Add-on Freeze / Unfreeze Behavior
When a subscription becomes `PAST_DUE` (or user downgrades to Free), any purchased credit add-ons are **frozen** (status changes from `ACTIVE` to `FROZEN`).
- Frozen credits cannot be consumed by the AI services.
- If the user recovers their subscription (pays their past-due invoice), the frozen add-ons are automatically **unfrozen** (status reverts to `ACTIVE`) and become available again.
- This logic is handled securely in `CreditModule` triggered by domain events `subscription.downgraded`, `subscription.payment_failed`, and `subscription.recovered`.

---

## Running the application

```bash
# development
npm run start:dev

# production build
npm run build
npm run start:prod
```

## Testing

```bash
npm run test        # Unit tests
npm run test:e2e    # Integration & E2E tests
```
