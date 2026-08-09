# transactional-outbox

## ADDED Requirements

### Requirement: Atomic Business Write and Event Persistence
The system SHALL persist domain events in a module-owned outbox table within the same database transaction as the business write that produces them, so that either both commit or neither commits.

#### Scenario: Subscription write with outbox event
- **WHEN** a billing listener upserts a subscription in response to an invoice payment
- **THEN** the corresponding `invoice.paid` domain event is inserted into `billing_outbox` inside the same transaction
- **AND** if the transaction fails, neither the subscription nor the outbox row exists

#### Scenario: Commit succeeds but process crashes before publishing
- **WHEN** the transaction commits and the process crashes before the relay publishes
- **THEN** the outbox row remains in `PENDING` status
- **AND** the relay eventually publishes it

### Requirement: Relay Publishing with Retry and Backoff
The system SHALL run an outbox relay that publishes pending events with at-least-once delivery, retrying transient failures up to 5 attempts with exponential backoff.

#### Scenario: Successful publish
- **WHEN** the relay publishes a pending outbox event and the consumer processes it without error
- **THEN** the outbox row is marked `PROCESSED` with a processed timestamp

#### Scenario: Transient failure retry
- **WHEN** publishing fails with a transient error (timeout or connection failure)
- **THEN** the outbox row remains `PENDING` with its attempt count incremented
- **AND** its `nextAttemptAt` is set using exponential backoff (base 5 seconds)

#### Scenario: Retry budget exhausted
- **WHEN** an event has failed 5 times with transient errors
- **THEN** the event is moved to the dead-letter store and the outbox row is marked `DEAD_LETTERED`
- **AND** an alert-level log entry containing the event payload and last error is emitted

### Requirement: Prisma-Based Error Classification
The system SHALL classify consumer errors in the relay using standard Prisma error codes, treating duplicate-key violations on idempotency keys as successful (already processed), foreign-key and check-constraint violations as permanent, and timeout/connection errors as transient.

#### Scenario: Duplicate delivery detected by idempotency key
- **WHEN** the consumer raises a unique-constraint violation (P2002) on its idempotency key
- **THEN** the relay marks the outbox row `PROCESSED` without retrying

#### Scenario: Permanent error goes straight to dead letter
- **WHEN** the consumer raises a foreign-key violation (P2003) or record-not-found error (P2025)
- **THEN** the event is moved to the dead-letter store without retrying
- **AND** an alert-level log entry is emitted

### Requirement: Stale Pending Reclaim
The system SHALL reclaim outbox rows stuck in `PENDING` beyond a configurable stale timeout, using an atomic conditional update so concurrent relay instances do not double-claim.

#### Scenario: Crash leaves row locked
- **WHEN** an outbox row has been `PENDING` with a lock timestamp older than the stale timeout
- **THEN** the relay reclaims it and attempts publishing again

#### Scenario: Concurrent relay instances
- **WHEN** two relay instances attempt to claim the same stale row
- **THEN** exactly one instance acquires the claim

### Requirement: Dead-Letter Store
The system SHALL persist dead-lettered events with their payload, error message, attempt count, and failure timestamp, and SHALL provide a way to replay them manually after the underlying data issue is fixed.

#### Scenario: Replay after data fix
- **WHEN** an operator fixes the underlying data problem and replays a dead-lettered event
- **THEN** the event is re-published through the normal delivery path
- **AND** consumer idempotency prevents duplicate side effects if it had partially succeeded before

### Requirement: Outbox Retention
The system SHALL purge `PROCESSED` outbox rows older than a configurable retention period.

#### Scenario: Old processed rows removed
- **WHEN** a processed outbox row is older than the retention period
- **THEN** the relay or cleanup process deletes it
