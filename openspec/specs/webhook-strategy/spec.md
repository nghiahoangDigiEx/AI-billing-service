# Webhook Strategy

## Purpose
TBD

## Requirements

### Requirement: Event-driven Webhook Processing
The system SHALL process Stripe webhook events using isolated strategy handlers, avoiding monolithic switch statements.

#### Scenario: Routing a webhook event
- **WHEN** a webhook event is received by the webhook controller
- **THEN** it is routed to the appropriate strategy handler based on the event type
- **AND** the strategy successfully processes the event or safely ignores it if unsupported

### Requirement: Invoice-Driven Subscription Management
The system SHALL upsert subscriptions and manage credits strictly based on invoice payment outcomes, using the `stripeCustomerId` to identify the user.

#### Scenario: Successful invoice payment
- **WHEN** an `invoice.paid` event is received
- **THEN** the system upserts the `Subscription` locally and marks it `ACTIVE`
- **AND** the system allocates the corresponding `MONTHLY` credits to the user

#### Scenario: Failed invoice payment
- **WHEN** an `invoice.payment_failed` event is received
- **THEN** the system marks the `Subscription` locally as `PAST_DUE`
- **AND** the system freezes the user's credits
