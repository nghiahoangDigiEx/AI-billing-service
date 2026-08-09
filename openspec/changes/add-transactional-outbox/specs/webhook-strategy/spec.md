# webhook-strategy

## MODIFIED Requirements

### Requirement: Invoice-Driven Subscription Management
The system SHALL upsert subscriptions and manage credits strictly based on invoice payment outcomes, using the `stripeCustomerId` to identify the user. Downstream credit allocation SHALL be delivered through the transactional outbox with at-least-once delivery and consumer idempotency, rather than fire-and-forget in-process events. The webhook processing outcome SHALL reflect completion of webhook handling (subscription write and event persisted to the outbox), not completion of downstream credit provisioning.

#### Scenario: Successful invoice payment
- **WHEN** an `invoice.paid` event is received
- **THEN** the system upserts the `Subscription` locally and marks it `ACTIVE`
- **AND** the system persists an `invoice.paid` domain event to the billing outbox in the same transaction
- **AND** the corresponding `MONTHLY` credits are allocated to the user via reliable outbox delivery with retry

#### Scenario: Failed invoice payment
- **WHEN** an `invoice.payment_failed` event is received
- **THEN** the system marks the `Subscription` locally as `PAST_DUE`
- **AND** the system freezes the user's credits via reliable outbox delivery with retry

#### Scenario: Credit provisioning fails transiently
- **WHEN** credit provisioning fails with a transient error after the subscription is committed
- **THEN** the webhook remains marked as processed
- **AND** the outbox event is retried until it succeeds or reaches the dead-letter store

#### Scenario: Credit provisioning fails permanently
- **WHEN** credit provisioning fails with a permanent error (constraint violation other than the idempotency key)
- **THEN** the event is moved to the dead-letter store with an alert-level log
- **AND** no further automatic retries occur
