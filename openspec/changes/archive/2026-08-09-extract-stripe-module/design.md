## Context

The system currently relies heavily on Stripe, and all integration logic, SDK usage, and webhook parsing are embedded directly within the `billing` module. `AGENTS.md` prescribes an event-driven modular architecture with a `PaymentProviderAdapter`, but this has not yet been realized.

## Goals / Non-Goals

**Goals:**
- Decouple `billing` from Stripe specifics.
- Implement the `PaymentProviderAdapter` interface for future extensibility.
- Convert Stripe webhook handling into internal domain events.

**Non-Goals:**
- We are not adding PayPal or another provider in this change. We are just creating the abstract foundation and the Stripe implementation.
- We are not changing the database schema. Webhook idempotency checks will continue to use the existing structures.

## Decisions

- **Event-Driven Webhooks**: `StripeModule` will receive webhook POSTs, verify signatures, parse them, and emit generic `PaymentEvent`s (e.g., `payment.invoice.paid`) using `EventEmitter2`. This ensures the `billing` module only reacts to domain events, not Stripe's raw objects.
- **PaymentProviderFactory**: To fulfill synchronous API needs (e.g., creating a checkout session), `billing` will inject `PaymentProviderFactory` to obtain a `PaymentProviderAdapter`, allowing the actual implementation to be injected at runtime.
- **Adapter Interface Structure**: The interface will abstract away Stripe types, returning standardized objects (e.g., `{ id: string, status: string }`) instead of `Stripe.Customer` or `Stripe.Subscription`.

## Risks / Trade-offs

- **Risk**: Event typing mismatch. Emitting generic events requires careful mapping from Stripe's rich webhook payloads to generic types.
  - *Mitigation*: Define strong TypeScript interfaces for the internal `PaymentEvent`s and validate mappings in `StripeWebhookService`.
- **Risk**: Idempotency breakdown.
  - *Mitigation*: To keep the schema unchanged, `StripeWebhookService` will save the `StripeEventId` to the existing table before emitting the event, ensuring no duplicate events are sent to the `billing` module.
