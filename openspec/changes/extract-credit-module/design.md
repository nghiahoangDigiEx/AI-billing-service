## Context

The Billing Module currently manages both subscription lifecycles (interacting with Stripe) and credit balances (the internal ledger for usage). Credit logic is scattered inside webhook event listeners (like `invoice-paid.listener.ts`), leading to tight coupling between payment events and credit ledger management. Furthermore, the system directly mutates `CreditBalance` records without creating an append-only ledger transaction log, violating the architectural invariant that "Credit mutations are atomic" with a corresponding `CreditTransaction`.

## Goals / Non-Goals

**Goals:**
- Decouple Credit management from Billing/Stripe webhooks.
- Ensure all credit changes are recorded atomically in a `CreditTransaction` table.
- Centralize credit provisioning (monthly refills, add-on purchases) into a `CreditService` within a new `CreditModule`.

**Non-Goals:**
- Implementing the actual API endpoints for AI service consumption (we only provide the `consume` method in the service).
- Modifying the external Stripe integration or webhook verification (Billing module still handles this).

## Decisions

1. **Create CreditModule and CreditService**
   - Rationale: Aligns with the bounded contexts defined in `AGENTS.md`. The `CreditModule` will own the `CreditBalance` and `CreditTransaction` tables.
   - Alternatives: Keep logic in Billing Module but extract to `BillingCreditService`. Rejected because `AGENTS.md` explicitly calls for a separate `Credit Module`.

2. **Event-Driven Integration**
   - Rationale: The Billing module's webhook listeners will only update subscription states, and then emit internal application events (e.g., `INVOICE_PAID`, `SUBSCRIPTION_PAYMENT_FAILED`, `SUBSCRIPTION_DELETED`, `ADDON_PURCHASED`). The `CreditModule` will have its own listeners (`credit-provisioning.listener.ts`) that react to these events.
   - Alternatives: Direct service calls from `BillingService` to `CreditService`. Rejected because the architectural style mandates "Event-driven cross-module communication".

3. **Atomic Transactions via Prisma**
   - Rationale: We will add a `CreditTransaction` model to Prisma. Any method in `CreditService` that modifies a `CreditBalance` (e.g., `addCredits`, `freezeCredits`, `consumeCredits`) MUST use a Prisma `$transaction` to update the balance and insert a `CreditTransaction` simultaneously.

## Risks / Trade-offs

- [Risk] Event duplication / Webhook replays could cause double credit provisioning.
  - Mitigation: The Billing module already enforces idempotency via the `WebhookEvent` table for Stripe events. However, `CreditTransaction` should include a `sourceRef` and we must ensure operations are idempotent (e.g., checking if a transaction for a specific `sourceRef` and `type` already exists before provisioning).
- [Risk] Missing Event Data.
  - Mitigation: Ensure events like `INVOICE_PAID` contain all necessary data (e.g., `userId`, `planId`, `creditsIncluded`) so the Credit Module doesn't need to query Stripe or deeply query billing tables unnecessarily.
