# Tasks: add-transactional-outbox

## 1. Schema & Migration

- [x] 1.1 Add `billing_outbox` model to prisma/schema.prisma (eventId unique, type, payload Json, status enum PENDING/PROCESSED/DEAD_LETTERED, attempts, nextAttemptAt, lockedAt, errorMessage, timestamps) with indexes on (status, nextAttemptAt)
- [x] 1.2 Add `credit_inbox` model (eventId unique, type, processedAt)
- [x] 1.3 Add `event_dlq` model (eventId, type, payload Json, errorMessage, attempts, failedAt)
- [x] 1.4 Check existing data for duplicate `(source, sourceRef)` pairs, then add unique index on `CreditBalance(source, sourceRef)`
- [x] 1.5 Create migration with `npx prisma migrate dev`, review generated SQL, run `npx prisma validate`

## 2. Event Contract

- [x] 2.1 Define `DomainEvent<T>` envelope type and metadata (providerEventId, causationId, correlationId) in src/events/
- [x] 2.2 Move/consolidate event payload types (InvoicePaidPayload, AddonPurchasedPayload, etc.) from listener files into src/events/ as typed payloads per event constant
- [x] 2.3 Update credit-provisioning.listener.ts to import shared payload types instead of local interfaces

## 3. Publisher Abstraction

- [x] 3.1 Define `EventPublisher` interface (publish(event: DomainEvent): Promise<void>)
- [x] 3.2 Implement `InProcessPublisher` wrapping `EventEmitter2.emitAsync`
- [x] 3.3 Register publisher in a shared infrastructure module and expose via DI token

## 4. Outbox Writer

- [x] 4.1 Create outbox insert helper usable inside a Prisma `$transaction` (inserts billing_outbox row from a DomainEvent)
- [x] 4.2 Update invoice-paid.listener.ts: insert outbox event inside the existing subscription transaction, remove direct `eventEmitter.emit(INVOICE_PAID, ...)`
- [x] 4.3 Update payment-intent-succeeded.listener.ts: outbox insert for ADDON_PURCHASED inside its transaction
- [x] 4.4 Update invoice-payment-failed.listener.ts: outbox insert for SUBSCRIPTION_PAYMENT_FAILED inside its transaction
- [x] 4.5 Update subscription-deleted.listener.ts: outbox insert for SUBSCRIPTION_DELETED inside its transaction
- [x] 4.6 Add post-commit kick (best-effort immediate relay trigger) after each outbox write

## 5. Outbox Relay

- [x] 5.1 Implement relay claim logic: atomic conditional UPDATE selecting PENDING rows with attempts < 5 and nextAttemptAt <= now (optimistic claim with lockedAt)
- [x] 5.2 Implement stale reclaim: rows PENDING with lockedAt older than configurable stale timeout (default 10 min) are re-claimable
- [x] 5.3 Implement Prisma error classifier: P2002 → already processed; P2024/P1001/P1017 → transient; P2003/P2025/check violations → permanent; allow listener-level override
- [x] 5.4 Implement retry handling: attempts++, exponential backoff (base 5s) on nextAttemptAt
- [x] 5.5 Implement dead-letter handling: move event to event_dlq, mark outbox DEAD_LETTERED, emit alert-level structured log with payload and error
- [x] 5.6 Implement retention: purge PROCESSED rows older than configurable retention (default 7 days)
- [x] 5.7 Schedule relay poll via @nestjs/schedule (configurable interval)

## 6. Consumer Idempotency (Credit Module)

- [x] 6.1 Extend CreditService.provisionMonthlyCredits to accept eventId and perform inbox check + balance + transaction + inbox insert in one $transaction
- [x] 6.2 Extend CreditService.provisionAddonCredits with the same inbox pattern
- [x] 6.3 Make freezeAddonCredits/unfreezeAddonCredits idempotent against duplicate delivery (inbox check, no duplicate freeze/unfreeze transactions)
- [x] 6.4 Update credit-provisioning.listener.ts: stop swallowing errors (remove try/catch that only logs); propagate errors to the relay; handle P2002 as success path
- [x] 6.5 Ensure subscription-deleted handling provisions free-plan credits only once per sourceRef

## 7. Tests

- [x] 7.1 Unit tests: outbox writer inserts event in same transaction as business write (rollback case included)
- [x] 7.2 Unit tests: relay error classification (P2002 → PROCESSED, transient → retry/backoff, permanent → DLQ, 5 attempts → DLQ)
- [x] 7.3 Unit tests: stale reclaim and concurrent claim race
- [x] 7.4 Unit tests: credit inbox dedup (duplicate event skipped, no double balance)
- [x] 7.5 Unit tests: unique constraint on CreditBalance(source, sourceRef) blocks duplicate provisioning
- [x] 7.6 E2E test: invoice.paid webhook → subscription ACTIVE + credits provisioned; simulated transient credit failure → retry succeeds
- [x] 7.7 E2E test: duplicate webhook delivery does not double-provision credits

## 8. Verification & Docs

- [x] 8.1 Run npm run lint, npm run typecheck, npm run test, npm run test:e2e, npm run build, npx prisma validate — all pass
- [x] 8.2 Update AGENTS.md invariants if webhook status semantics or event delivery guarantees changed
- [x] 8.3 Document DLQ replay procedure (CLI script) and alerting expectations in runbook/README
