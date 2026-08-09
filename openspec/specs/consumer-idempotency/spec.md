# consumer-idempotency

## Purpose
TBD

## Requirements

### Requirement: Inbox-Based Consumer Deduplication
The system SHALL record processed event ids in a consumer-owned inbox table within the same database transaction as the resulting state mutation, and SHALL skip processing when the event id already exists.

#### Scenario: First delivery processed
- **WHEN** the credit module receives an `invoice.paid` envelope whose event id is not in `credit_inbox`
- **THEN** it provisions credits and inserts the event id into `credit_inbox` in one transaction

#### Scenario: Duplicate delivery skipped
- **WHEN** the credit module receives an `invoice.paid` envelope whose event id already exists in `credit_inbox`
- **THEN** it skips the mutation and completes without error
- **AND** no duplicate credit balance or transaction is created

#### Scenario: Crash between processing and acknowledgement
- **WHEN** the consumer crashes after committing the mutation but before the outbox row is marked processed
- **THEN** the event is redelivered
- **AND** the inbox check prevents any duplicate side effect

### Requirement: Idempotency Key on Credit Balances
The system SHALL enforce a unique constraint on `CreditBalance(source, sourceRef)` so that the same source event cannot create two credit balances, providing a second layer of protection independent of the inbox.

#### Scenario: Duplicate provisioning blocked at database level
- **WHEN** a credit provisioning attempt targets a `(source, sourceRef)` pair that already exists
- **THEN** the database rejects the insert with a unique-constraint violation
- **AND** the relay classifies the violation as already processed

### Requirement: Idempotent Credit Operations
The system SHALL make all credit mutations triggered by events idempotent, including provisioning, freezing, and unfreezing, so that at-least-once delivery never corrupts balances.

#### Scenario: Duplicate freeze event
- **WHEN** a freeze event is delivered twice for the same subscription
- **THEN** the second delivery observes no ACTIVE add-on balances to freeze
- **AND** completes without error and without duplicate freeze transactions

#### Scenario: Duplicate subscription-deleted handling
- **WHEN** a `subscription.deleted` event is delivered twice
- **THEN** free-plan credits are provisioned only once for the given sourceRef
