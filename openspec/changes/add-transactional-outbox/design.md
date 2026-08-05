# Design: add-transactional-outbox

## Context

The billing service is an event-driven modular monolith (NestJS + Prisma + PostgreSQL). Cross-module communication uses `EventEmitter2`: billing listeners translate raw Stripe webhook events into domain events (`invoice.paid`, `addon.purchased`, `subscription.payment_failed`, `subscription.deleted`) which the credit module consumes to provision/freeze credits.

Current failure mode: the webhook is marked `PROCESSED` before the credit listener runs, `emit()` is fire-and-forget, and the credit listener swallows all errors (`credit-provisioning.listener.ts`). Result: subscription `ACTIVE` but credits missing, with no retry, no rollback, no alert. Additionally, `CreditBalance` has no unique constraint on `sourceRef`, so duplicate delivery can double-provision credits.

The design must be microservice-ready: business code should not know or care which transport delivers events, so the monolith can later be split into services with a real broker without rewriting producers or consumers.

## Goals / Non-Goals

**Goals:**
- Business write and event emission are atomic (no lost or phantom events).
- Failed credit provisioning is retried for transient errors and surfaced (DLQ + alert) for permanent errors — never silently swallowed.
- At-least-once delivery is safe: consumers are idempotent; duplicate events never double-provision credits.
- Transport is swappable behind an `EventPublisher` interface (in-process now, broker later).
- Error classification lives in the relay using standard Prisma error codes; listeners stay simple.

**Non-Goals:**
- Reconciliation jobs (subscription ↔ credit balance auditing) — separate change.
- Real broker integration (Kafka/RabbitMQ/NATS) — the interface is designed for it, implementation later.
- CDC-based relay (Debezium) — poller is sufficient at this scale.
- Saga orchestration / compensating transactions — not applicable while "Stripe is source of truth"; nothing in this flow is legitimately compensable.
- Changing the raw→domain event translation layer in `src/events/`.

## Decisions

### D1: Transactional outbox over direct emit
Business listeners write the domain event into a per-module outbox table inside the same Prisma `$transaction` as the business write. A relay publishes later.

- *Alternative considered — emitAsync + await + rethrow:* smaller change, but delivery still fails silently on process crash between commit and emit, and webhook status would depend on downstream listener success (tight coupling).
- *Alternative considered — saga with compensation:* wrong semantics here; Stripe has already committed the payment, so compensating the subscription violates "Stripe is source of truth". The correct response to credit failure is retry/alert, not undo.

### D2: Per-module outbox tables (`billing_outbox` now)
Each module owns its outbox table, mirroring the future microservice split. A shared single table would violate the "module owns its tables" principle and create a cross-module write point.

### D3: Standard domain event envelope
All outbox rows and published events use one envelope defined in `src/events/`:

```
{
  id: string            // event instance id (uuid), used for consumer dedup
  type: string          // 'invoice.paid'
  version: number       // payload schema version, starts at 1
  occurredAt: Date
  payload: object       // typed per event
  metadata: { providerEventId?, causationId?, correlationId? }
}
```

This replaces the ad-hoc payload interfaces currently declared inside listener files. `metadata.correlationId` ties a whole webhook → event chain for tracing across future services.

### D4: `EventPublisher` interface as the microservice seam
```
interface EventPublisher { publish(event: DomainEvent): Promise<void> }
```
- `InProcessPublisher` (now): wraps `EventEmitter2.emitAsync`.
- `BrokerPublisher` (later): Kafka/RabbitMQ — swap via DI, no business code changes.

The relay depends only on this interface. Consumers keep using `@OnEvent` now; when a module becomes a service, its listener becomes a broker consumer with the same idempotency logic.

### D5: Relay with retry, backoff, and Prisma-based error classification
The relay picks rows where `status = PENDING AND attempts < 5 AND nextAttemptAt <= now`, publishes, then:

| Outcome | Handling |
|---|---|
| Success | `status = PROCESSED`, `processedAt = now` |
| Duplicate (P2002 on idempotency key) | Treated as already done → `PROCESSED` (idempotency working as intended) |
| Transient (P2024 timeout, P1001/P1017 connection, lock errors) | `attempts++`, `nextAttemptAt = now + backoff`, stay `PENDING` |
| Permanent (P2003 FK, P2025 not-found, check-constraint violations) | → `event_dlq` immediately, `status = DEAD_LETTERED`, alert log |
| 5 attempts exhausted | → `event_dlq`, `status = DEAD_LETTERED`, alert log |

Backoff: exponential, base 5s (5s → 25s → 2m05s → 10m25s → DLQ). Classification logic lives in the relay as a mapper from Prisma error codes; listeners may optionally override classification for domain-specific errors.

- *Alternative considered — listener-level classification:* rejected; duplicates logic across consumers and buries infrastructure policy in business code.

### D6: Consumer-side idempotency — inbox table + unique constraint (two layers)
1. **Primary:** `credit_inbox` table. The credit listener, inside the same transaction as the balance/transaction writes, checks whether `event.id` exists; if yes, skip; if no, perform the mutation and insert the inbox row atomically.
2. **Secondary:** unique constraint `CreditBalance(source, sourceRef)`. Catches duplicates even if the inbox is bypassed, and turns accidental double-provision into a catchable P2002 that the relay classifies as "already processed".

At-least-once delivery + consumer dedup is the standard pairing; exactly-once delivery is not attempted.

### D7: Stale PENDING reclaim
If the process crashes between claiming an outbox row and publishing, the row stays `PENDING`. The relay reclaims rows with `status = PENDING AND lockedAt < now - STALE_TIMEOUT` (default 10 minutes, configurable). Claiming uses an UPDATE-with-condition (optimistic claim) rather than SELECT-then-UPDATE to avoid races when multiple relay instances run.

### D8: Webhook status semantics
The webhook's `WebhookEvent.status` continues to reflect webhook handling (raw event → domain event persisted in outbox), not downstream credit provisioning. Downstream reliability is now the outbox's job. This keeps the webhook layer and delivery layer independently observable.

## Risks / Trade-offs

- [Polling adds latency (seconds) to credit provisioning] → Relay also gets a post-commit "kick" so the happy path publishes almost immediately; poll interval is only a safety net.
- [Poison message stops silently if nobody watches the DLQ] → DLQ writes emit a structured error log with full event payload; alerting on that log is an ops concern documented in the runbook. No silent swallowing by design.
- [Unique constraint on `CreditBalance(source, sourceRef)` may conflict with existing data] → Migration must check for existing duplicates before adding the constraint; seed/test data uses distinct sourceRefs today.
- [Outbox rows accumulate] → `PROCESSED` rows are purged by a retention policy (e.g., delete older than 7 days) in the relay or a small cleanup step; exact retention is configurable.
- [In-process publisher still loses events if the process dies between relay publish and listener execution] → Acceptable for the monolith: the outbox row is only marked `PROCESSED` after the listener resolves (emitAsync awaited), so a crash leaves the row `PENDING` and it is redelivered; consumer idempotency makes redelivery safe.
- [Two-layer idempotency adds a table + constraint] → Small cost; the inbox table is the exact mechanism that will travel with the credit module when it becomes a service.

## Migration Plan

1. Additive schema migration: create `billing_outbox`, `credit_inbox`, `event_dlq`; add unique index on `CreditBalance(source, sourceRef)` (after duplicate check).
2. Deploy code with outbox inserts running in parallel with existing emit paths only if a feature flag is used; otherwise deploy atomically since all paths are internal (no external API change).
3. Backfill consideration: subscriptions currently `ACTIVE` with missing credits are NOT fixed by this change (reconciliation is a separate change).
4. Rollback: drop the new tables and revert the code; no data in existing tables is altered by this change.

## Open Questions

- Retention period for `PROCESSED` outbox rows (default proposal: 7 days).
- Whether `event_dlq` replay is a CLI script or an admin endpoint in this change (leaning: CLI script, minimal).
- Exact set of Prisma codes in the transient vs permanent classifier — finalize from observed error surface during implementation.
