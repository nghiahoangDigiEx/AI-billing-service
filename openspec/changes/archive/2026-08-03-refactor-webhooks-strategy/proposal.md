## Why

Currently, `WebhookService` handles Stripe events using a large `switch` statement, which will become difficult to maintain as we support more events. Additionally, `BillingService` writes to the local database immediately when upgrading a subscription, before Stripe's webhook arrives. By refactoring webhook handling to a Strategy Pattern and making subscription creation strictly invoice-driven, we can clean up the codebase and ensure the local database is always a perfect, race-condition-free mirror of Stripe (since we only activate subscriptions and grant credits when payment is actually received).

## What Changes

- Introduce a `WebhookStrategy` interface and a `WebhookStrategyFactory`.
- Create isolated strategy classes for events (e.g., `InvoicePaidStrategy`, `InvoicePaymentFailedStrategy`, `SubscriptionDeletedStrategy`).
- Refactor `WebhookService` to delegate event processing to the appropriate strategy.
- Modify `BillingService.upgradeSubscription` to **only** interact with the Stripe API (e.g., updating the subscription in Stripe) and return a pending status, without creating or updating local Prisma subscription records immediately.
- Use `invoice.paid` as the sole source of truth for upserting active subscriptions and resetting/granting credits.

## Capabilities

### New Capabilities
- `webhook-strategy`: Structuring webhook event handlers using the strategy pattern.

### Modified Capabilities
- `subscription-lifecycle`: The requirements for creating and upgrading subscriptions locally are changing to rely entirely on asynchronous webhook delivery rather than synchronous API calls.

## Impact

- **WebhookService**: Completely refactored to use the factory and strategies.
- **BillingService**: Removal of local database writes inside `upgradeSubscription`.
- **Database**: No schema changes, but local subscription row updates will now happen asynchronously.
- **Client/UX**: Clients may experience a short delay before their active subscription appears locally while waiting for the webhook.
