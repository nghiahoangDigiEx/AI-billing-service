## 1. Database Schema and Migration

- [x] 1.1 Add billing enums to Prisma schema (SubscriptionStatus, PlanStatus, BillingInterval, CreditSource, CreditStatus)
- [x] 1.2 Add Plan model to Prisma schema with fields: id, stripeProductId, name, slug, status, timestamps
- [x] 1.3 Add PlanPrice model to Prisma schema with fields: id, stripePriceId, planId, billingInterval, amount, currency, status, timestamps
- [x] 1.4 Add Subscription model to Prisma schema with fields: id, userId, planId, planPriceId, stripeSubscriptionId, status, currentPeriodStart, currentPeriodEnd, timestamps
- [x] 1.5 Add AddonPackage model to Prisma schema with fields: id, stripeProductId, stripePriceId, name, credits, amount, currency, status, timestamps
- [x] 1.6 Add AddonPurchase model to Prisma schema with fields: id, userId, addonPackageId, stripePaymentIntentId, createdAt
- [x] 1.7 Add CreditBalance model to Prisma schema with fields: id, userId, source (MONTHLY/ADDON), sourceRef, totalCredits, remainingCredits, status (ACTIVE/FROZEN/EXHAUSTED), periodStart, periodEnd, purchasedAt, frozenAt, unfrozenAt, timestamps
- [x] 1.8 Add WebhookEvent model to Prisma schema with fields: id, stripeEventId (unique), eventType, payload, status (PENDING/PROCESSED/FAILED), errorMessage, processedAt, createdAt
- [x] 1.9 Extend User model with stripeCustomerId (optional, unique), pendingStripeSetup (boolean, default false), retryCount (int, default 0)
- [x] 1.10 Add relations: User to Subscription (1:N), User to AddonPurchase (1:N), User to CreditBalance (1:N), Plan to PlanPrice (1:N), Plan to Subscription (1:N), PlanPrice to Subscription (1:N), AddonPackage to AddonPurchase (1:N)
- [x] 1.11 Add indexes: Subscription(userId, status), AddonPurchase(userId), CreditBalance(userId, status), WebhookEvent(stripeEventId)
- [x] 1.12 Add CHECK constraint on CreditBalance: remainingCredits >= 0
- [x] 1.13 Create Prisma migration: npx prisma migrate dev --name add_billing_models
- [x] 1.14 Verify migration applies successfully to development database
- [x] 1.15 Run npx prisma validate to ensure schema is valid
- [x] 1.16 Run npx prisma generate to regenerate Prisma client
- [x] 1.17 Create Prisma migration to add creditsIncluded to Plan model: npx prisma migrate dev --name add_credits_included
- [x] 1.18 Create Prisma migration to add WebhookEventStatus enum and status/errorMessage fields to WebhookEvent model: npx prisma migrate dev --name add_webhook_event_status

## 2. Environment Configuration

- [x] 2.1 Add STRIPE_SECRET_KEY to .env.example with placeholder value and comment
- [x] 2.2 Add STRIPE_WEBHOOK_SECRET to .env.example with placeholder value and comment
- [x] 2.3 Add STRIPE_FREE_PLAN_PRICE_ID to .env.example with placeholder value and comment
- [x] 2.4 Add BILLING_RETRY_INTERVAL to .env.example with default value (300000) and comment
- [x] 2.5 Add BILLING_MAX_RETRIES to .env.example with default value (5) and comment
- [x] 2.6 Add Stripe configuration section to .env.example with instructions for obtaining keys
- [x] 2.7 Verify .env is in .gitignore (should already exist)
- [x] 2.8 Update ConfigModule validation to include Stripe environment variables

## 3. Billing Module Setup

- [x] 3.1 Create src/modules/billing/ directory structure (dto/, entities/, guards/)
- [x] 3.2 Create billing.module.ts with module definition, imports (PrismaModule, ConfigModule), and providers
- [x] 3.3 Import BillingModule in AppModule
- [x] 3.4 Add Stripe SDK to package.json dependencies (npm install stripe)
- [x] 3.5 Create stripe.service.ts with Stripe client injection and configuration
- [x] 3.6 Implement StripeService.createCustomer(email) method with error handling
- [x] 3.7 Implement StripeService.createSubscription(customerId, priceId) method with error handling
- [x] 3.8 Implement StripeService.cancelSubscription(subscriptionId) method with error handling
- [x] 3.9 Implement StripeService.createProduct(name) method with error handling
- [x] 3.10 Implement StripeService.createPrice(productId, amount, currency, interval) method with error handling
- [x] 3.11 Implement StripeService.archiveProduct(productId) method with error handling
- [x] 3.12 Implement StripeService.createPaymentIntent(amount, currency, metadata) method with error handling
- [x] 3.13 Implement StripeService.verifyWebhookSignature(payload, signature) method
- [x] 3.14 Write unit tests for StripeService methods (mock Stripe SDK)

## 4. Event Constants and Error Codes

- [x] 4.1 Add billing event constants to src/events/event.constants.ts (SUBSCRIPTION_CREATED, SUBSCRIPTION_CANCELLED, SUBSCRIPTION_DOWNGRADED, SUBSCRIPTION_RENEWED, SUBSCRIPTION_PAYMENT_FAILED, SUBSCRIPTION_RECOVERED, ADDON_PURCHASED, ADDON_FROZEN, ADDON_UNFROZEN)
- [x] 4.2 Add billing error codes to src/common/enums/error-code.enum.ts (SUBSCRIPTION_NOT_FOUND, PLAN_NOT_FOUND, PLAN_PRICE_NOT_FOUND, ADDON_NOT_FOUND, INVALID_SUBSCRIPTION_STATUS, ADDON_PURCHASE_RESTRICTED, INSUFFICIENT_CREDITS, STRIPE_API_ERROR, WEBHOOK_SIGNATURE_INVALID, DUPLICATE_PLAN_SLUG, DUPLICATE_BILLING_INTERVAL, CANNOT_DEACTIVATE_LAST_PRICE)
- [x] 4.3 Export new event constants and error codes from barrel files

## 5. DTOs and Validation

- [x] 5.1 Create CreatePlanDto with validation decorators (name, slug, creditsIncluded, billingInterval, amount, currency)
- [x] 5.2 Create UpdatePlanDto with validation decorators (name, creditsIncluded)
- [x] 5.3 Create CreatePlanPriceDto with validation decorators (billingInterval, amount, currency)
- [x] 5.4 Create CreateAddonPackageDto with validation decorators (name, credits, amount, currency)
- [x] 5.5 Create UpdateAddonPackageDto with validation decorators (name)
- [x] 5.6 Create UpgradeSubscriptionDto with validation decorators (planPriceId)
- [x] 5.7 Create PlanResponseDto with Swagger decorators
- [x] 5.8 Create PlanPriceResponseDto with Swagger decorators
- [x] 5.9 Create SubscriptionResponseDto with Swagger decorators
- [x] 5.10 Create AddonPackageResponseDto with Swagger decorators
- [x] 5.11 Create AddonPurchaseResponseDto with Swagger decorators
- [x] 5.12 Create CreditBalanceResponseDto with Swagger decorators
- [x] 5.13 Add Swagger decorators to all DTOs for API documentation

## 6. Guards and Decorators

- [x] 6.1 Create RequireActiveSubscription guard in src/modules/billing/guards/
- [x] 6.2 Implement RequireActiveSubscription guard logic (check user has ACTIVE subscription)
- [x] 6.3 Create RequirePaidSubscription guard in src/modules/billing/guards/
- [x] 6.4 Implement RequirePaidSubscription guard logic (check user has ACTIVE paid subscription, not Free)
- [x] 6.5 Create AdminOnly guard in src/common/guards/ (or reuse if exists)
- [x] 6.6 Implement AdminOnly guard logic (check user.role == ADMIN)
- [x] 6.7 Create @RequireActiveSubscription() decorator
- [x] 6.8 Create @RequirePaidSubscription() decorator
- [x] 6.9 Create @AdminOnly() decorator
- [x] 6.10 Write unit tests for all guards

## 7. Admin API - Plan Management

- [x] 7.1 Create billing.controller.ts with @Controller('admin/plans') and @AdminOnly() decorator
- [x] 7.2 Implement POST /admin/plans endpoint (create plan with Stripe Product + Price)
- [x] 7.3 Implement billing.service.ts createPlan() method with Stripe API calls and DB inserts
- [x] 7.4 Implement PATCH /admin/plans/:id endpoint (update plan metadata and creditsIncluded)
- [x] 7.5 Implement billing.service.ts updatePlan() method with Stripe API call and DB update
- [x] 7.6 Implement POST /admin/plans/:id/prices endpoint (add new pricing option)
- [x] 7.7 Implement billing.service.ts createPlanPrice() method with Stripe API call and DB insert
- [x] 7.8 Implement DELETE /admin/plans/:id/prices/:priceId endpoint (deactivate price)
- [x] 7.9 Implement billing.service.ts deactivatePlanPrice() method with validation (cannot deactivate last active price)
- [x] 7.10 Add Swagger decorators to all admin plan endpoints
- [x] 7.11 Write unit tests for admin plan endpoints (mock StripeService and PrismaService)
- [x] 7.12 Write integration tests for admin plan endpoints (test full request/response cycle)

## 8. Admin API - Add-on Management

- [x] 8.1 Add add-on endpoints to billing.controller.ts with @Controller('admin/addons') and @AdminOnly() decorator
- [x] 8.2 Implement POST /admin/addons endpoint (create add-on with Stripe Product + Price)
- [x] 8.3 Implement billing.service.ts createAddonPackage() method with Stripe API calls and DB inserts
- [x] 8.4 Implement PATCH /admin/addons/:id endpoint (update add-on metadata)
- [x] 8.5 Implement billing.service.ts updateAddonPackage() method with Stripe API call and DB update
- [x] 8.6 Implement DELETE /admin/addons/:id endpoint (deactivate add-on)
- [x] 8.7 Implement billing.service.ts deactivateAddonPackage() method with Stripe archive and DB update
- [x] 8.8 Add Swagger decorators to all admin add-on endpoints
- [x] 8.9 Write unit tests for admin add-on endpoints (mock StripeService and PrismaService)
- [x] 8.10 Write integration tests for admin add-on endpoints (test full request/response cycle)

## 9. Public API - Plan and Add-on Listing

- [x] 9.1 Create public controller with @Controller('plans') for public plan listing
- [x] 9.2 Implement GET /plans endpoint (list all active plans with active prices)
- [x] 9.3 Implement billing.service.ts getActivePlans() method with Prisma query
- [x] 9.4 Create public controller with @Controller('addons') for public add-on listing
- [x] 9.5 Implement GET /addons endpoint (list all active add-ons)
- [x] 9.6 Implement billing.service.ts getActiveAddonPackages() method with Prisma query
- [x] 9.7 Add Swagger decorators to public endpoints
- [x] 9.8 Write unit tests for public endpoints
- [x] 9.9 Write integration tests for public endpoints

## 10. User API - Subscription Management

- [x] 10.1 Create subscription controller with @Controller('subscriptions') and JWT authentication
- [x] 10.2 Implement POST /subscriptions/upgrade endpoint (upgrade from Free to paid plan)
- [x] 10.3 Implement billing.service.ts upgradeSubscription() method (create Stripe subscription, return 202 Accepted)
- [x] 10.4 Implement GET /subscriptions/current endpoint (view current active subscription)
- [x] 10.5 Implement billing.service.ts getCurrentSubscription() method (query ACTIVE subscription)
- [x] 10.6 Implement GET /subscriptions/history endpoint (view subscription history)
- [x] 10.7 Implement billing.service.ts getSubscriptionHistory() method (query all subscriptions)
- [x] 10.8 Add Swagger decorators to subscription endpoints
- [x] 10.9 Write unit tests for subscription endpoints (mock StripeService and PrismaService)
- [x] 10.10 Write integration tests for subscription endpoints

## 11. User API - Add-on Purchase

- [x] 11.1 Add add-on purchase endpoint to subscription controller with @RequirePaidSubscription() decorator
- [x] 11.2 Implement POST /addons/:id/purchase endpoint (purchase one-time credit pack)
- [x] 11.3 Implement billing.service.ts purchaseAddon() method (validate paid subscription, create Stripe PaymentIntent with metadata, return 202 Accepted)
- [x] 11.4 Implement GET /addons/purchases endpoint (view active and frozen add-ons)
- [x] 11.5 Implement billing.service.ts getUserAddonPurchases() method (query CreditBalance where source=ADDON AND status IN (ACTIVE, FROZEN))
- [x] 11.6 Implement GET /addons/purchases/history endpoint (view all add-on purchases)
- [x] 11.7 Implement billing.service.ts getUserAddonHistory() method (query all CreditBalance where source=ADDON)
- [x] 11.8 Add Swagger decorators to add-on purchase endpoints
- [x] 11.9 Write unit tests for add-on purchase endpoints
- [x] 11.10 Write integration tests for add-on purchase endpoints

## 12. Webhook Handling

- [x] 12.1 Create webhook.controller.ts with @Controller('webhooks/stripe') (no authentication)
- [x] 12.2 Implement POST /webhooks/stripe endpoint (receive Stripe events)
- [x] 12.3 Implement webhook signature verification using StripeService.verifyWebhookSignature()
- [x] 12.4 Create webhook.service.ts for webhook event processing
- [x] 12.5 Implement idempotency check in webhook.service.ts (query WebhookEvent by stripeEventId, check status, insert PENDING if not exists)
- [x] 12.6 Implement handleInvoicePaid() method (find subscription and its related plan, check if PAST_DUE for recovery, mark previous MONTHLY CreditBalance as EXHAUSTED, create new MONTHLY CreditBalance using plan.creditsIncluded, emit events)
- [x] 12.7 Implement handleInvoicePaymentFailed() method (mark subscription PAST_DUE, emit subscription.payment_failed event)
- [x] 12.8 Implement handleSubscriptionDeleted() method (create Free sub in Stripe, DB transaction: cancel Pro, insert Free, freeze add-on CreditBalance, create MONTHLY CreditBalance for Free, emit events)
- [x] 12.9 Implement handlePaymentIntentSucceeded() method (check metadata for addonPackageId, insert AddonPurchase, insert CreditBalance with source=ADDON, emit addon.purchased event)
- [x] 12.10 Implement webhook routing logic (route event type to appropriate handler: invoice.paid, invoice.payment_failed, customer.subscription.deleted, payment_intent.succeeded)
- [x] 12.11 Handle unsupported event types (log and return 200 OK)
- [x] 12.12 Implement WebhookEvent status update (update to PROCESSED on success, or FAILED with errorMessage on catch)
- [x] 12.13 Add error handling for webhook processing (return 500 to trigger Stripe retry)
- [x] 12.14 Write unit tests for webhook handlers (mock StripeService and PrismaService)
- [x] 12.15 Write integration tests for webhook endpoint (test signature verification, idempotency, event processing)

## 13. Background Job - Pending Stripe Setup

- [x] 13.1 Create billing.scheduler.ts with @Cron() decorator for background job
- [x] 13.2 Configure cron schedule from BILLING_RETRY_INTERVAL environment variable
- [x] 13.3 Implement processPendingStripeSetup() method (query users with pendingStripeSetup=true)
- [x] 13.4 Implement retry logic with exponential backoff (use retryCount field on User model)
- [x] 13.5 Implement Stripe customer creation in background job
- [x] 13.6 Implement Free subscription creation in background job
- [x] 13.7 Update User record on success (pendingStripeSetup=false, stripeCustomerId set)
- [x] 13.8 Implement max retries check (BILLING_MAX_RETRIES) and log error when exceeded
- [x] 13.9 Write unit tests for background job (mock StripeService and PrismaService)

## 14. User Registration Integration

- [ ] 14.1 Update user.service.ts register() and validateOAuthUser() to set pendingStripeSetup=true upon user creation
- [ ] 14.2 Create user.listener.ts in billing module to listen for USER_REGISTERED event
- [ ] 14.3 Implement handleUserRegistered() to create Stripe customer and insert Subscription record for Free plan
- [ ] 14.4 On success, emit stripe.setup.success event from Billing module
- [ ] 14.5 On failure, error is logged and background job (Section 13) will handle retries since pendingStripeSetup remains true
- [ ] 14.6 Create billing.listener.ts in user module to listen for stripe.setup.success
- [ ] 14.7 Implement handleStripeSetupSuccess() in user module to update user record (pendingStripeSetup=false, set stripeCustomerId)
- [ ] 14.8 Update user registration tests and billing listener tests

## 15. Add-on Freeze/Unfreeze Logic

- [ ] 15.1 Implement freezeAddons() method in billing.service.ts (update CreditBalance where source=ADDON AND status=ACTIVE to FROZEN, set frozenAt)
- [ ] 15.2 Implement unfreezeAddons() method in billing.service.ts (update CreditBalance where source=ADDON AND status=FROZEN to ACTIVE, set unfrozenAt)
- [ ] 15.3 Integrate freezeAddons() into handleSubscriptionDeleted() webhook handler
- [ ] 15.4 Integrate unfreezeAddons() into handleInvoicePaid() webhook handler (when subscription was PAST_DUE)
- [ ] 15.5 Emit addon.frozen event after freezing add-ons
- [ ] 15.6 Emit addon.unfrozen event after unfreezing add-ons
- [ ] 15.7 Write unit tests for freeze/unfreeze logic

## 16. Downgrade Orchestration

- [ ] 16.1 Implement downgradeToFree() method in billing.service.ts
- [ ] 16.2 Implement Stripe Free subscription creation before DB transaction (as per design decision)
- [ ] 16.3 Implement DB transaction: cancel Pro subscription, insert Free subscription, freeze add-on CreditBalance (source=ADDON), create MONTHLY CreditBalance for Free plan
- [ ] 16.4 Implement error handling for Stripe failure during downgrade (return 500 to webhook)
- [ ] 16.5 Implement error handling for DB transaction failure (log orphaned Stripe subscription)
- [ ] 16.6 Emit subscription.downgraded event after successful downgrade
- [ ] 16.7 Write unit tests for downgrade orchestration
- [ ] 16.8 Write integration test for full downgrade flow (webhook → Stripe → DB transaction)

## 17. Event Emission

- [ ] 17.1 Inject EventEmitter2 into billing.service.ts
- [ ] 17.2 Emit subscription.created event when Free subscription is created (registration or background job)
- [ ] 17.3 Emit subscription.cancelled event when subscription is cancelled
- [ ] 17.4 Emit subscription.downgraded event when user downgrades to Free
- [ ] 17.5 Emit subscription.renewed event when invoice.paid webhook is processed
- [ ] 17.6 Emit subscription.payment_failed event when invoice.payment_failed webhook is processed
- [ ] 17.7 Emit subscription.recovered event when invoice.paid webhook detects PAST_DUE subscription
- [ ] 17.8 Emit addon.purchased event when payment_intent.succeeded webhook creates add-on purchase
- [ ] 17.9 Emit addon.frozen event when add-ons are frozen (during downgrade)
- [ ] 17.10 Emit addon.unfrozen event when add-ons are unfrozen (during recovery)
- [ ] 17.11 Write unit tests to verify events are emitted with correct payloads

## 18. Testing and Verification

- [ ] 18.1 Run npm run lint and fix any linting errors
- [ ] 18.2 Run npm run typecheck and fix any type errors
- [ ] 18.3 Run npm run test and ensure all unit tests pass
- [ ] 18.4 Run npm run test:e2e and ensure all integration tests pass
- [ ] 18.5 Run npm run build and ensure application compiles successfully
- [ ] 18.6 Run npx prisma validate and ensure schema is valid
- [ ] 18.7 Test admin plan creation flow end-to-end (create plan, verify Stripe Product and Price created)
- [ ] 18.8 Test admin add-on creation flow end-to-end (create add-on, verify Stripe Product and Price created)
- [ ] 18.9 Test user registration flow with Stripe mock (verify Free subscription created)
- [ ] 18.10 Test user upgrade flow with Stripe mock (verify subscription upgrade)
- [ ] 18.11 Test webhook processing with Stripe mock (verify invoice.paid, payment_failed, subscription.deleted, payment_intent.succeeded)
- [ ] 18.12 Test add-on purchase flow with Stripe mock (verify PaymentIntent created with metadata)
- [ ] 18.13 Test downgrade flow with Stripe mock (verify Pro cancelled, Free created, add-on CreditBalance frozen, MONTHLY CreditBalance created for Free)
- [ ] 18.14 Test background job with Stripe mock (verify pending users are processed)
- [ ] 18.15 Test CreditBalance creation and consumption logic
- [ ] 18.16 Test freeze/unfreeze logic on CreditBalance records

## 19. Documentation

- [ ] 19.1 Update README.md with Stripe setup instructions (obtain API keys, configure webhook endpoint)
- [ ] 19.2 Update README.md with webhook configuration instructions (list of events to enable in Stripe Dashboard)
- [ ] 19.3 Update README.md with environment variable documentation (Stripe keys, billing config)
- [ ] 19.4 Update README.md with local development instructions (stripe listen command for webhook forwarding)
- [ ] 19.5 Create API documentation summary for billing endpoints (admin and user-facing)
- [ ] 19.6 Document webhook event handling and idempotency guarantees
- [ ] 19.7 Document subscription lifecycle and state transitions
- [ ] 19.8 Document add-on freeze/unfreeze behavior

## 20. Seed Data

- [ ] 20.1 Update seed script to create Free plan with monthly price (if not exists)
- [ ] 20.2 Update seed script to create Pro plan with monthly and annual prices (if not exists)
- [ ] 20.3 Update seed script to create sample add-on packages (if not exists)
- [ ] 20.4 Ensure seed script is idempotent (can run multiple times without errors)
- [ ] 20.5 Test seed script execution
