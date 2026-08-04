## 1. Core Abstractions

- [x] 1.1 Create `src/modules/payment/payment.module.ts`
- [x] 1.2 Define `PaymentProviderAdapter` interface in `src/modules/payment/interfaces/payment-provider-adapter.interface.ts`
- [x] 1.3 Create `PaymentProviderFactory` in `src/modules/payment/factories/payment-provider.factory.ts`
- [x] 1.4 Define standard payment events in `src/events/payment.events.ts` (e.g., `PAYMENT_EVENTS.INVOICE_PAID`)

## 2. Stripe Module Implementation

- [x] 2.1 Create `src/modules/stripe/stripe.module.ts`
- [x] 2.2 Move logic from `StripeService` to `src/modules/stripe/adapters/stripe.adapter.ts` and implement `PaymentProviderAdapter`
- [x] 2.3 Create `StripeWebhookController` in `src/modules/stripe/controllers/stripe-webhook.controller.ts`
- [x] 2.4 Create `StripeWebhookService` to verify, parse webhooks, check idempotency, and emit standard events

## 3. Billing Module Refactoring

- [x] 3.1 Remove `StripeService`, `WebhookController`, `WebhookService`, and webhook strategies from `BillingModule`
- [x] 3.2 Update `BillingService` and `BillingScheduler` to use `PaymentProviderFactory` instead of `StripeService`
- [x] 3.3 Convert existing webhook strategies into event listeners (e.g., `invoice-paid.listener.ts`) and move to `src/modules/billing/listeners/`
- [x] 3.4 Update `BillingModule` to register new listeners and import `PaymentModule`

## 4. Testing & Verification

- [x] 4.1 Update unit tests for `BillingService` using mocked `PaymentProviderAdapter`
- [x] 4.2 Write unit tests for `StripeAdapter`
- [x] 4.3 Verify end-to-end webhook processing flow
- [x] 4.4 Run `npm run typecheck`, `npm run lint`, and tests to ensure success
