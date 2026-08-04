## Context

The billing service currently has a User module handling authentication (registration, login, OAuth, JWT). The database contains only User and RefreshToken tables. There is no billing infrastructure, no Stripe integration, no subscription management, and no credit system.

This design introduces the Billing module as the second major domain, establishing patterns for Stripe integration, webhook processing, and cross-module event communication that future billing features will follow.

**Constraints:**
- Stripe is the source of truth for billing state; local DB mirrors Stripe
- One active subscription per user at any time (history preserved)
- All credentials via environment variables (no hardcoded secrets)
- Webhook processing must be idempotent
- Credit mutations must be atomic (balance + transaction in same DB transaction)
- Cross-module communication via EventEmitter2 only

## Goals / Non-Goals

**Goals:**
- Establish a plan catalog system (Free + Pro, extensible to more plans) with monthly and annual pricing
- Implement subscription lifecycle: auto-subscribe Free on signup, upgrade/downgrade via Stripe, webhook-driven state reconciliation
- Create add-on credit pack system with purchase restrictions (active paid subscription only) and freeze/unfreeze on plan changes
- Build admin API for plan, pricing, and add-on management that syncs to Stripe
- Handle payment failure dunning via Stripe's built-in retry logic with automatic downgrade to Free
- Provide resilient signup flow that degrades gracefully when Stripe is unavailable

**Non-Goals:**
- Multi-tenancy or organization-level billing
- Usage-based pricing (per-API-call billing)
- Proration logic for mid-cycle plan changes (deferred to future iteration)
- Invoice generation or PDF delivery
- Tax calculation or regional pricing
- Payment method management beyond Stripe's default (no UI for card management in this iteration)
- Credit consumption logic (this change establishes the ledger structure but not the consumption API — that's a separate change)

## Decisions

### 1. Free Plan as Stripe Product (not absence of subscription)

**Decision:** Every user gets a Stripe subscription to the Free plan immediately upon registration.

**Rationale:** This makes credit reset uniform across all users. The `invoice.paid` webhook fires for both Free ($0) and Pro subscriptions, triggering credit reset with the amount determined by the active plan. No special-case logic needed for "free users."

**Alternative considered:** Free = no subscription. Simpler, but requires separate credit reset logic for free users (cron job vs webhook-driven). Rejected because it creates two code paths for the same behavior.

**Trade-off:** Signup now depends on Stripe availability. Mitigated by pending state (see Decision 5).

### 2. One Active Subscription Per User (History Preserved)

**Decision:** User has a 1:N relationship with Subscription table, but only one record has `status = ACTIVE` at any time. Upgrades, downgrades, and plan changes create new subscription records and cancel the previous one.

**Rationale:** Clean audit trail. Each subscription record represents a distinct billing period with specific plan/price. No resurrection of old records on downgrade.

**Alternative considered:** Single subscription record with status changes tracked in a separate history table. Rejected because it complicates queries (join required to see history) and makes Stripe reconciliation harder (one local record vs multiple Stripe subscription events).

### 3. Stripe Product/Price Hierarchy Mirrored Locally

**Decision:** Local database mirrors Stripe's Product → Price hierarchy:
- `Plan` table maps to Stripe Product (one row per plan: Free, Pro)
- `PlanPrice` table maps to Stripe Price (multiple rows per plan: monthly, annual)
- `AddonPackage` table maps to Stripe Product + Price (one-time purchase)

**Rationale:** Admin edits flow through to Stripe immediately. Local queries don't need to hit Stripe API. Stripe IDs stored locally for webhook reconciliation.

**Stripe constraint:** Stripe Prices are immutable. "Editing" a price means deactivating the old Price and creating a new one. This is handled transparently in the admin service.

### 3b. Credit Allotments Stored in Plan Table

**Decision:** The monthly credit allotment for a subscription tier is stored directly on the `Plan` table as `creditsIncluded` (int).

**Rationale:** Allows admins to dynamically adjust credit allotments via the API without requiring environment variable changes or code deployments. When webhooks like `invoice.paid` process, they read the `creditsIncluded` from the local `Plan` database record.

### 4. Webhook-Driven State Sync with Idempotency

**Decision:** All subscription state changes come from Stripe webhooks. Local API calls (upgrade, downgrade) trigger Stripe API calls, but the local DB update happens when the webhook arrives.

**Rationale:** Stripe is source of truth. If we update locally on API call and then webhook arrives, we risk double-processing or state drift. Webhook-first ensures consistency.

**Idempotency & State Tracking:** `WebhookEvent` table tracks each Stripe event ID with a 3-state machine (`PENDING`, `PROCESSED`, `FAILED`). 
- When an event arrives, insert as `PENDING`.
- If it already exists as `PROCESSED`, return 200 immediately (idempotent).
- If it exists as `PENDING`, return 409 to prevent concurrent processing.
- If it exists as `FAILED`, allow reprocessing.
- On success, update to `PROCESSED`. On error, update to `FAILED` and save the `errorMessage`. This allows safe retries and better visibility into webhook failures.

**Webhook events handled:**
- `invoice.paid` → reset credits based on active plan's monthly allotment (stored in Plan.creditsIncluded)
  - If subscription was PAST_DUE → mark ACTIVE, unfreeze add-ons
  - If invoice has no subscription field → it's a one-time charge (handled separately)
- `invoice.payment_failed` → mark subscription PAST_DUE, lock credits
- `customer.subscription.deleted` → cancel Pro sub, create Free sub, freeze add-ons, reset credits to Free tier
- `payment_intent.succeeded` → create AddonPurchase + CreditBalance record for one-time add-on purchases

### 5. Resilient Signup with Pending Stripe State

**Decision:** If Stripe is unavailable during user registration, the user is created with `pendingStripeSetup = true`. A background job retries Stripe customer + Free subscription creation with exponential backoff.

**Rationale:** Blocking signup on Stripe availability is unacceptable for user experience. Users can log in immediately; billing features show a "setting up your account" state until Stripe catches up.

**Implementation:**
- User registration attempts Stripe customer + Free subscription creation synchronously
- On failure: user is created with `pendingStripeSetup = true`, no subscription record
- Background job (cron) scans for users with `pendingStripeSetup = true`, retries with backoff (1m, 5m, 15m, 1h, then alerts admin)
- Once successful: `pendingStripeSetup = false`, Free subscription created, first `invoice.paid` webhook fires

**Trade-off:** User may exist for minutes/hours without credits. Acceptable for MVP; can be improved with optimistic credit grant later.

### 6. Add-on Freeze/Unfreeze on Plan Changes

**Decision:** Add-on credits are stored in `CreditBalance` table with source=ADDON. When user downgrades to Free, all ACTIVE add-on CreditBalance records are set to FROZEN. When user re-subscribes to paid plan, FROZEN add-on credits are set to ACTIVE. `remainingCredits` is preserved.

**Rationale:** User paid for add-on credits; they shouldn't lose them on downgrade. But frozen credits can't be consumed while on Free plan, enforcing the "add-ons require active paid subscription" rule.

**Implementation:** Triggered by webhook handlers:
- `customer.subscription.deleted` → UPDATE CreditBalance SET status = FROZEN WHERE userId = $userId AND source = ADDON AND status = ACTIVE
- `invoice.paid` (when subscription was PAST_DUE) → UPDATE CreditBalance SET status = ACTIVE WHERE userId = $userId AND source = ADDON AND status = FROZEN

### 7. Downgrade Orchestration (Stripe Call Before DB Transaction)

**Decision:** When downgrading (Pro → Free), create the Free subscription in Stripe **before** the database transaction that cancels Pro and freezes add-ons.

**Rationale:** If we do Stripe call inside the DB transaction and Stripe fails, the transaction rolls back — Pro is not cancelled locally, but we've lost the webhook opportunity. If we do DB transaction first and Stripe call fails, we have a cancelled Pro sub locally but no Free sub anywhere.

**Chosen approach:**
1. Create Free subscription in Stripe (API call)
2. If successful: DB transaction (cancel Pro, insert Free sub, freeze add-ons, reset credits)
3. If Stripe call fails: return non-200 to Stripe webhook, Stripe retries the event

**Trade-off:** If step 2 fails after step 1 succeeds, we have an orphaned Free subscription in Stripe. Mitigated by reconciliation job that compares local subscriptions to Stripe and flags discrepancies.

### 8. Module Structure and Event-Driven Communication

**Decision:** Billing module is self-contained. Cross-module communication (billing → credit) happens via EventEmitter2 only. Billing module never imports or calls Credit module services directly.

**Events emitted by Billing module:**
- `subscription.created` → payload: { userId, subscriptionId, planSlug, creditsIncluded }
- `subscription.cancelled` → payload: { userId, subscriptionId }
- `subscription.downgraded` → payload: { userId, fromPlan, toPlan }
- `addon.purchased` → payload: { userId, addonPurchaseId, credits }
- `addon.frozen` → payload: { userId }
- `addon.unfrozen` → payload: { userId }

**Rationale:** Follows existing architecture (AGENTS.md: "Module Communication Is Event-Driven"). Credit module listens to these events and updates credit ledger accordingly.

### 9. Admin API Design

**Decision:** Admin endpoints for plan/price/addon management are under `/admin/` prefix with role-based guard (ADMIN role only). Each admin operation:
1. Validates input
2. Calls Stripe API to create/update Product/Price
3. Mirrors the change in local database
4. Returns the local record with Stripe IDs

**Endpoints:**
- `POST /admin/plans` → create plan (Stripe Product + initial Price)
- `PATCH /admin/plans/:id` → update plan metadata
- `POST /admin/plans/:id/prices` → add pricing option (Stripe Price)
- `PATCH /admin/plans/:id/prices/:priceId` → deactivate old price, create new one
- `POST /admin/addons` → create add-on package (Stripe Product + Price, one-time)
- `PATCH /admin/addons/:id` → update add-on metadata
- `DELETE /admin/addons/:id` → deactivate (archive in Stripe, mark inactive locally)

**Rationale:** Admin is the only actor who can modify the plan catalog. Stripe is updated synchronously; if Stripe is down, admin operation fails with clear error message (no partial state).

### 10. Unified Credit Ledger (CreditBalance Table)

**Decision:** All credits (monthly subscription allotments and one-time add-on purchases) are stored in a single `CreditBalance` table with a `source` field distinguishing MONTHLY vs ADDON.

**Rationale:** Simplifies credit consumption queries (one table instead of joining Subscription + AddonPurchase). Makes the ledger uniform and easier to audit. Separates credit tracking from subscription/addon metadata.

**CreditBalance structure:**
- id, userId
- source: MONTHLY (from subscription) or ADDON (from one-time purchase)
- sourceRef: subscriptionId (for MONTHLY) or addonPurchaseId (for ADDON)
- totalCredits, remainingCredits
- status: ACTIVE, FROZEN, EXHAUSTED
- periodStart, periodEnd (for MONTHLY credits, null for ADDON)
- purchasedAt (for ADDON credits, null for MONTHLY)

**Credit reset flow:**
- `invoice.paid` webhook for subscription → creates new CreditBalance record with source=MONTHLY, totalCredits=plan.creditsIncluded
- Previous MONTHLY CreditBalance records marked EXHAUSTED (or remain with remaining balance for rollover, if implemented later)

**Add-on purchase flow:**
- `payment_intent.succeeded` webhook → creates CreditBalance record with source=ADDON, totalCredits=addonPackage.credits

**Freeze/unfreeze:**
- Operates on CreditBalance records where source=ADDON
- MONTHLY credits are never frozen (they expire at period end)

## Risks / Trade-offs

**[Risk] Stripe downtime blocks signup** → Mitigated by pending state + background retry job. User can log in but has no credits until healed.

**[Risk] Webhook delivery delays** → Stripe webhooks are eventually consistent. User may upgrade but local state lags by seconds/minutes. Mitigated by: (1) local API can optimistically update status for UX, (2) webhook is the final source of truth.

**[Risk] Orphaned Stripe subscriptions on failed downgrade** → If DB transaction fails after Stripe Free sub is created, we have a Stripe sub with no local record. Mitigated by reconciliation job (future task) that compares local vs Stripe subscriptions daily.

**[Risk] Add-on credit consumption race condition** → Multiple concurrent consumption requests could oversell add-on credits. Mitigated by: (1) atomic DB transaction with row-level locking on AddonPurchase, (2) CHECK constraint ensuring remainingCredits >= 0.

**[Risk] Admin edits plan while users are subscribed** → Changing a plan's price doesn't affect existing subscribers (Stripe Prices are immutable per subscription). New price applies only to new subscriptions. This is correct behavior but may confuse admins. Mitigated by clear API documentation and UI messaging.

**[Trade-off] No proration** → Mid-cycle plan changes are not prorated. User upgrading from Free to Pro mid-month pays full Pro price. Acceptable for MVP; proration can be added later with Stripe's proration API.

**[Trade-off] No payment method management UI** → Users manage payment methods via Stripe's hosted customer portal or default Stripe checkout flow. Building custom payment method UI is deferred.
