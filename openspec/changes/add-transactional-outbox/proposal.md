# Proposal: add-transactional-outbox

## Why

Cross-module events are currently published with fire-and-forget `EventEmitter2.emit()` calls. When credit provisioning fails after a subscription is committed, the error is swallowed by the listener, the webhook is marked `PROCESSED`, and no retry or recovery exists — leaving users with an `ACTIVE` subscription but no credits. The delivery path also has no idempotency guarantees, so duplicate webhook delivery can double-provision credits. The design must additionally be microservice-ready so the same event flow can later move to a real broker without rewriting business code.

## What Changes

- Introduce a transactional outbox: business writes and the corresponding domain event are committed in the same database transaction (per-module outbox tables, starting with `billing_outbox`).
- Introduce a standard domain event envelope (`id`, `type`, `version`, `occurredAt`, `payload`, `metadata`) in `src/events/` replacing ad-hoc listener payload interfaces.
- Introduce an `EventPublisher` abstraction with an in-process implementation wrapping EventEmitter2; a broker implementation can be swapped in later without changing producers or consumers.
- Introduce an `OutboxRelay` that publishes pending outbox rows with retry, exponential backoff, and error classification based on standard Prisma error codes:
  - Duplicate (P2002 on consumer idempotency keys) → treated as already processed.
  - Transient errors (timeouts, connection failures) → retry up to 5 attempts with backoff.
  - Permanent errors (FK violations, check constraints) → move to a dead-letter store and alert; never retry.
- Introduce consumer-side idempotency for the credit module (`credit_inbox` table checked inside the same transaction as credit mutations), plus a unique constraint on `CreditBalance(source, sourceRef)` as a second layer.
- Replace direct `emit()` calls in billing listeners with outbox inserts inside their existing transactions.
- Reclaim stale `PENDING` outbox rows (crash recovery) after a configurable timeout.
- Out of scope: reconciliation jobs, broker integration, CDC-based relay.

## Capabilities

### New Capabilities
- `transactional-outbox`: Outbox table, relay, retry/backoff policy, Prisma-based error classification, dead-letter handling, and stale-event reclaiming.
- `event-delivery-contract`: Standard domain event envelope and the `EventPublisher` abstraction that makes the transport swappable for future microservices.
- `consumer-idempotency`: Consumer-side inbox pattern and idempotency keys ensuring at-least-once delivery never causes duplicate side effects (credit double-provisioning).

### Modified Capabilities
- `webhook-strategy`: Invoice-driven subscription management now requires that downstream credit allocation be delivered reliably via the outbox rather than fire-and-forget events, and that webhook processing outcome reflects full pipeline completion.

## Impact

- **Database**: New tables `billing_outbox`, `credit_inbox`, `event_dlq`; new unique constraint on `CreditBalance(source, sourceRef)`. Requires Prisma schema changes and a migration.
- **Code**: `src/events/` (envelope contracts), `src/modules/billing/listeners/*` (outbox inserts instead of emit), `src/modules/credit/listeners/credit-provisioning.listener.ts` (inbox-based idempotency, error propagation), new relay + publisher infrastructure (likely `src/common/` or a shared infrastructure module).
- **Behavior**: Failed credit provisioning becomes retryable and observable instead of silently lost; duplicate events become safe.
- **Dependencies**: No new external dependencies for the in-process publisher; relay scheduling may use existing `@nestjs/schedule` or a post-commit kick.
