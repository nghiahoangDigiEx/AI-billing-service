## ADDED Requirements

### Requirement: Subscription Entity
The system SHALL maintain a Subscription entity representing a user's subscription to a plan. Each subscription SHALL track the plan, pricing option, Stripe subscription ID, status, and billing period.

#### Scenario: Subscription record structure
- **WHEN** a subscription is created in the database
- **THEN** the Subscription table contains fields: id, userId, planId, planPriceId, stripeSubscriptionId, status (ACTIVE, PAST_DUE, CANCELLED, TRIALING), currentPeriodStart, currentPeriodEnd, createdAt, updatedAt
- **AND** userId is a foreign key to User
- **AND** planId is a foreign key to Plan
- **AND** planPriceId is a foreign key to PlanPrice
- **AND** stripeSubscriptionId references the corresponding Stripe Subscription ID

#### Scenario: Subscription status values
- **WHEN** a subscription status is queried
- **THEN** status is one of: ACTIVE (valid, can consume credits), PAST_DUE (payment failed, credits locked), CANCELLED (terminated, no longer active), TRIALING (trial period, not yet billed)
- **AND** status transitions are driven by Stripe webhooks

### Requirement: One Active Subscription Per User
The system SHALL enforce that each user has at most one subscription with status=ACTIVE at any time. Historical subscriptions (CANCELLED, PAST_DUE) are preserved.

#### Scenario: User has one active subscription
- **WHEN** querying subscriptions for a user
- **THEN** at most one subscription has status=ACTIVE
- **AND** all other subscriptions have status=CANCELLED or PAST_DUE (historical)

#### Scenario: Upgrade creates new subscription
- **WHEN** user upgrades from Free to Pro
- **THEN** system cancels existing Free subscription (status=CANCELLED)
- **AND** system creates new Pro subscription (status=ACTIVE)
- **AND** both subscription records exist in database (history preserved)

### Requirement: Auto-Subscribe Free Plan on User Registration
The system SHALL automatically create a Stripe customer and subscribe the user to the Free plan immediately after successful user registration.

#### Scenario: Successful Free subscription creation
- **WHEN** user completes registration (email/password or OAuth)
- **THEN** system calls Stripe API to create Customer with user email
- **AND** system stores stripeCustomerId on User record
- **AND** system calls Stripe API to create Subscription for Free plan
- **AND** system inserts Subscription record with status=ACTIVE, planId=Free plan
- **AND** Stripe fires invoice.paid webhook for $0 Free plan invoice

#### Scenario: Stripe unavailable during registration
- **WHEN** user completes registration but Stripe API returns error
- **THEN** system creates User record with pendingStripeSetup=true
- **AND** system does NOT create Subscription record
- **AND** user can log in immediately
- **AND** background job retries Stripe customer + subscription creation

#### Scenario: User with pending Stripe setup
- **WHEN** user with pendingStripeSetup=true logs in
- **THEN** user can access application normally
- **AND** billing-related features show "Setting up your account" message
- **AND** user has no credits until Stripe setup completes

### Requirement: Background Job for Pending Stripe Setup
The system SHALL run a background job that retries Stripe customer and Free subscription creation for users with pendingStripeSetup=true.

#### Scenario: Background job retries with backoff
- **WHEN** background job runs (every 5 minutes)
- **THEN** system queries users where pendingStripeSetup=true
- **AND** system attempts Stripe customer creation for each user
- **AND** system attempts Free subscription creation
- **AND** on success: system sets pendingStripeSetup=false, creates Subscription record
- **AND** on failure: system increments retryCount, applies exponential backoff (1m, 5m, 15m, 1h)

#### Scenario: Max retries exceeded
- **WHEN** user has retryCount >= 5 (approximately 2 hours of retries)
- **THEN** system logs error "Failed to setup Stripe for user after max retries"
- **AND** system sends alert to admin (email or monitoring system)
- **AND** user remains in pending state until manual intervention

### Requirement: User Upgrade to Paid Plan
The system SHALL provide an endpoint for users to upgrade from Free to a paid plan (Pro). The endpoint SHALL create a Stripe subscription and wait for webhook confirmation.

#### Scenario: Successful upgrade request
- **WHEN** user with ACTIVE Free subscription calls POST /subscriptions/upgrade with planPriceId
- **THEN** system validates planPriceId exists and is ACTIVE
- **AND** system calls Stripe API to create Subscription for paid plan
- **AND** system returns 202 Accepted with message "Upgrade initiated, webhook will confirm"
- **AND** system does NOT update local subscription status yet (waits for webhook)

#### Scenario: User already on paid plan
- **WHEN** user with ACTIVE Pro subscription calls POST /subscriptions/upgrade
- **THEN** system returns 400 Bad Request with error message "User already has active paid subscription"
- **AND** no Stripe API calls are made

#### Scenario: Invalid plan price
- **WHEN** user calls POST /subscriptions/upgrade with non-existent or INACTIVE planPriceId
- **THEN** system returns 404 Not Found or 400 Bad Request
- **AND** no Stripe API calls are made

### Requirement: User Downgrade to Free Plan
The system SHALL handle automatic downgrade when Stripe cancels a paid subscription (after payment failure dunning). Downgrade creates a new Free subscription.

#### Scenario: Downgrade after payment failure
- **WHEN** Stripe fires customer.subscription.deleted webhook (after 3 payment retries failed)
- **THEN** system marks Pro subscription as CANCELLED
- **AND** system calls Stripe API to create new Free subscription
- **AND** system inserts new Subscription record with status=ACTIVE, planId=Free plan
- **AND** system freezes all ACTIVE CreditBalance records where source=ADDON for user
- **AND** system creates new MONTHLY CreditBalance record with Free plan allotment

#### Scenario: Downgrade orchestration order
- **WHEN** system processes downgrade
- **THEN** system creates Free subscription in Stripe FIRST (before DB transaction)
- **AND** if Stripe call succeeds: system executes DB transaction (cancel Pro, insert Free, freeze add-on CreditBalance, create new MONTHLY CreditBalance for Free plan)
- **AND** if Stripe call fails: system returns non-200 to webhook, Stripe retries event

### Requirement: User View Current Subscription
The system SHALL provide an endpoint for users to view their current active subscription and subscription history.

#### Scenario: View active subscription
- **WHEN** user calls GET /subscriptions/current
- **THEN** system queries Subscription table where userId=user.id AND status=ACTIVE
- **AND** response returns 200 with subscription details (plan name, billingInterval, status, currentPeriodEnd)
- **AND** response includes plan metadata (creditsIncluded)

#### Scenario: No active subscription
- **WHEN** user with pendingStripeSetup=true calls GET /subscriptions/current
- **THEN** response returns 200 with { status: 'PENDING', message: 'Setting up your account' }

#### Scenario: View subscription history
- **WHEN** user calls GET /subscriptions/history
- **THEN** system queries all Subscription records for user (including CANCELLED)
- **AND** response returns 200 with array of subscriptions ordered by createdAt DESC
- **AND** each subscription includes plan name, status, currentPeriodStart, currentPeriodEnd

### Requirement: Subscription Status Guard
The system SHALL provide a guard that restricts access to endpoints based on subscription status. Endpoints can require ACTIVE subscription, paid subscription (not Free), or specific plan.

#### Scenario: Active subscription required
- **WHEN** endpoint decorated with @RequireActiveSubscription()
- **AND** user has no ACTIVE subscription
- **THEN** guard returns 403 Forbidden with error message "Active subscription required"

#### Scenario: Paid subscription required
- **WHEN** endpoint decorated with @RequirePaidSubscription()
- **AND** user has ACTIVE Free subscription
- **THEN** guard returns 403 Forbidden with error message "Paid subscription required"

#### Scenario: Subscription check passes
- **WHEN** endpoint decorated with @RequireActiveSubscription()
- **AND** user has ACTIVE subscription (any plan)
- **THEN** guard allows request to proceed

### Requirement: Add-on Purchase
The system SHALL provide an endpoint for users to purchase one-time credit pack add-ons. Purchase is restricted to users with active paid subscriptions.

#### Scenario: Successful add-on purchase
- **WHEN** user with ACTIVE Pro subscription calls POST /addons/:id/purchase
- **THEN** system validates user has active paid subscription (not Free)
- **AND** system calls Stripe API to create PaymentIntent with metadata={userId, addonPackageId}
- **AND** system returns 202 Accepted with message "Payment initiated, webhook will confirm"
- **AND** system does NOT insert AddonPurchase or CreditBalance records yet (waits for payment_intent.succeeded webhook)

#### Scenario: User on Free plan
- **WHEN** user with ACTIVE Free subscription calls POST /addons/:id/purchase
- **THEN** system returns 403 Forbidden with error message "Add-on purchase requires active paid subscription"
- **AND** no Stripe API calls are made
- **AND** no AddonPurchase record is created

#### Scenario: User with PAST_DUE subscription
- **WHEN** user with PAST_DUE subscription calls POST /addons/:id/purchase
- **THEN** system returns 403 Forbidden with error message "Cannot purchase add-ons while subscription is past due"
- **AND** no Stripe API calls are made

#### Scenario: Add-on not found or inactive
- **WHEN** user calls POST /addons/:id/purchase with non-existent or INACTIVE add-on ID
- **THEN** system returns 404 Not Found or 400 Bad Request
- **AND** no Stripe API calls are made

### Requirement: AddonPurchase Entity
The system SHALL maintain an AddonPurchase entity representing a user's purchase of a credit pack add-on. Each purchase SHALL track the Stripe PaymentIntent and purchase metadata. Credits are stored in CreditBalance table.

#### Scenario: AddonPurchase record structure
- **WHEN** an add-on is purchased
- **THEN** the AddonPurchase table contains fields: id, userId, addonPackageId, stripePaymentIntentId, createdAt
- **AND** userId is a foreign key to User
- **AND** addonPackageId is a foreign key to AddonPackage
- **AND** stripePaymentIntentId references the Stripe PaymentIntent ID for the purchase
- **AND** credits are stored in CreditBalance table (source=ADDON, sourceRef=addonPurchaseId)

### Requirement: User View Add-on Purchases
The system SHALL provide an endpoint for users to view their add-on purchase history and current credit balances.

#### Scenario: View active add-ons
- **WHEN** user calls GET /addons/purchases
- **THEN** system queries CreditBalance table where userId=user.id AND source=ADDON AND status IN (ACTIVE, FROZEN)
- **AND** response returns 200 with array of add-on credit balances
- **AND** each record includes: add-on name (from AddonPackage), totalCredits, remainingCredits, status, purchasedAt

#### Scenario: View add-on history
- **WHEN** user calls GET /addons/purchases/history
- **THEN** system queries all CreditBalance records where source=ADDON for user (including EXHAUSTED)
- **AND** response returns 200 with array ordered by purchasedAt DESC
