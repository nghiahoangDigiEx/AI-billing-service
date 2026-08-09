## Why

Currently, the billing module is tightly coupled with Stripe specifics, violating the `PaymentProviderAdapter` architecture defined in `AGENTS.md`. Separating Stripe into a dedicated module allows the billing module to be provider-agnostic, making it extensible for other payment providers (like PayPal) and keeping domain logic isolated from external SDKs.

## What Changes

- Extract Stripe-specific logic (`StripeService`, `WebhookController`, `WebhookStrategies`) from the `billing` module into a new `stripe` module.
- Create a common `payment` module with a `PaymentProviderAdapter` interface and `PaymentProviderFactory` for the `billing` module to use.
- Implement `StripeAdapter` (implementing `PaymentProviderAdapter`) in the `stripe` module.
- Refactor webhook handling: `StripeModule` will receive webhooks, parse them, and emit standardized `PaymentEvent`s via `EventEmitter2`.
- Refactor `BillingModule` to listen to these internal `PaymentEvent`s instead of handling Stripe webhooks directly.

## Capabilities

### New Capabilities

- `payment-provider-abstraction`: The generic architecture for abstracting payment operations and standardizing webhook events.
- `stripe-integration`: The specific implementation of the payment provider adapter for Stripe, encapsulating SDK usage and Stripe event parsing.

### Modified Capabilities

- `subscription-lifecycle`: The implementation of subscription lifecycle events changes from direct Stripe webhook strategies to listening to standardized internal payment events.

## Impact

- **Billing Module**: `billing.module.ts`, `services`, and `strategies` will be refactored to remove Stripe dependencies.
- **Event Bus**: New internal payment events will be defined.
- **Controllers**: Webhook endpoints move from `BillingModule` to `StripeModule`.
- **Database**: No schema changes. Events will still use existing mechanisms/tables (e.g. idempotency checks).
