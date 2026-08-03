## 1. Webhook Strategy Refactor

- [x] 1.1 Create `StripeEventStrategy` interface in `src/modules/billing/strategies/`
- [x] 1.2 Implement `InvoicePaidStrategy` moving logic from `WebhookService.handleInvoicePaid`
- [x] 1.3 Implement `InvoicePaymentFailedStrategy` moving logic from `WebhookService.handleInvoicePaymentFailed`
- [x] 1.4 Implement `SubscriptionDeletedStrategy` moving logic from `WebhookService.handleSubscriptionDeleted`
- [x] 1.5 Implement `PaymentIntentSucceededStrategy` moving logic from `WebhookService.handlePaymentIntentSucceeded`
- [x] 1.6 Implement `WebhookStrategyFactory` to route events to the correct strategy
- [x] 1.7 Refactor `WebhookService.processEvent` to use the factory and remove the switch statement

## 2. Invoice-Driven Subscriptions

- [x] 2.1 Update `InvoicePaidStrategy` to look up user by `stripeCustomerId` (found on invoice) and upsert the local `Subscription` record
- [x] 2.2 Update `InvoicePaymentFailedStrategy` to look up user by `stripeCustomerId` and mark `Subscription` as `PAST_DUE`
- [x] 2.3 Modify `BillingService.upgradeSubscription` to only call the Stripe API and return without making local `Subscription` DB writes

## 3. Testing and Verification

- [x] 3.1 Write unit tests for all new Webhook Strategies
- [x] 3.2 Update `WebhookService.spec.ts` to mock the factory
- [x] 3.3 Update `BillingService.spec.ts` to verify `upgradeSubscription` no longer writes to Prisma
- [x] 3.4 Ensure integration/E2E tests simulate `invoice.paid` properly to activate subscriptions