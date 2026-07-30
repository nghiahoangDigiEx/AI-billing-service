## Why

The billing service currently has user authentication but no billing domain. Users can register and log in, but there is no mechanism to manage subscription plans, process payments, track credit balances, or handle plan lifecycle events. This change introduces the core subscription billing system that enables monetization — admin-managed plans with Stripe-backed pricing, automatic subscription lifecycle management via webhooks, and a credit ledger tied to subscription status.

## What Changes

- **New Billing Module** with plan catalog management, subscription lifecycle, and Stripe integration
- **Plan & Pricing management** — Admin can create/edit plans (Free, Pro, future plans) with monthly and annual pricing options, backed by Stripe Products and Prices
- **Add-on package management** — Admin can create one-time credit pack add-ons; users on active paid subscriptions can purchase them
- **Subscription lifecycle** — Users auto-subscribe to Free plan on registration; upgrade/downgrade to Pro with Stripe managing the subscription; one active subscription per user with full history
- **Webhook-driven state sync** — Stripe webhooks reconcile local subscription state (payment success, payment failure, dunning retries, cancellation)
- **Credit reset on billing cycle** — Monthly credit allotment resets triggered by Stripe `invoice.paid` webhook, amount determined by active plan
- **Add-on freeze/unfreeze** — Add-on credits frozen when user downgrades to Free, unfrozen when user re-subscribes to paid plan; remaining credits preserved
- **Dunning handling** — Stripe retries failed payments 3 times (1/day), then cancels subscription; system downgrades user to Free plan automatically
- **Stripe resilience** — If Stripe is unavailable during signup, user can log in with "pending" billing state; background job heals the subscription once Stripe recovers
- **Admin API** — CRUD endpoints for plans, pricing options, and add-on packages that sync to Stripe and mirror locally

## Capabilities

### New Capabilities
- `plan-catalog`: Plan and pricing option management (Free, Pro with monthly/annual prices), admin CRUD synced to Stripe Products/Prices, local DB mirror
- `addon-package`: One-time credit pack add-on management, admin CRUD synced to Stripe, purchase restricted to active paid subscribers
- `subscription-lifecycle`: User subscription management — auto-subscribe Free on signup, upgrade/downgrade, one active subscription per user with history, Stripe webhook-driven state sync
- `stripe-webhook-handling`: Stripe webhook processing for subscription events (invoice.paid, payment_failed, subscription.deleted), idempotent event handling, credit reset triggers
- `addon-freeze-unfreeze`: Freeze add-on credits on downgrade to Free, unfreeze on re-subscribe to paid plan, preserve remaining credit balance

### Modified Capabilities
- `prisma-integration`: Add billing domain models (Plan, PlanPrice, Subscription, AddonPackage, AddonPurchase, WebhookEvent) to the Prisma schema with new migration
- `environment-config`: Add Stripe API keys, Stripe webhook secret, and billing-related configuration variables
- `shared-infrastructure`: Add billing-related event constants, add subscription status guards, extend ErrorCode enum with billing error codes

## Impact

- **Database**: New Prisma migration adding 6+ tables (Plan, PlanPrice, Subscription, AddonPackage, AddonPurchase, WebhookEvent) and associated indexes
- **User model**: Add `stripeCustomerId` and `pendingStripeSetup` fields to existing User model
- **APIs**: New admin endpoints for plan/price/addon CRUD; new user-facing endpoints for subscription management and add-on purchase; new Stripe webhook endpoint
- **Dependencies**: Stripe SDK integration, Stripe webhook signature verification
- **External systems**: Stripe API becomes a runtime dependency for billing operations; webhook endpoint must be publicly accessible for Stripe event delivery
- **Modules**: New Billing module with controllers, services, guards, and event handlers; cross-module communication via EventEmitter2 (billing events → credit module)
- **Existing user flow**: User registration now triggers Stripe customer creation and Free subscription; graceful degradation if Stripe is unavailable
