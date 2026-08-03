## Context

Currently, the `WebhookService` uses a large `switch` statement to process Stripe webhook events. This approach violates the Open/Closed Principle and makes testing isolated event handlers difficult. In parallel, `BillingService.upgradeSubscription` immediately writes the new subscription state to the local Prisma database when a user upgrades. This creates a race condition with Stripe webhooks and risks leaving the local database out of sync with Stripe's actual state (the source of truth).

## Goals / Non-Goals

**Goals:**
- Refactor webhook event parsing and processing using the Strategy Pattern.
- Ensure that the local database mirrors Stripe exactly by relying on Stripe webhooks (`invoice.paid` and `invoice.payment_failed`) to upsert `Subscription` records.
- Stop synchronously creating `Subscription` records in `BillingService` during upgrade requests.

**Non-Goals:**
- Modifying how addons or credits are modeled in Prisma.
- Handling mid-cycle prorated plan changes that do not generate immediate invoices (this may require adding a `customer.subscription.updated` strategy in the future, but is out of scope for this initial refactor).

## Decisions

1. **Implement `WebhookStrategy` Interface and Factory**
   - *Rationale*: We need an extensible way to add new Stripe event handlers. A `WebhookStrategyFactory` will map `event.type` to concrete strategy classes (e.g., `InvoicePaidStrategy`). This keeps `WebhookService` clean.
   - *Alternatives considered*: Keeping the `switch` statement. Rejected because it scales poorly.

2. **Invoice-driven Subscription Upserts**
   - *Rationale*: By waiting for `invoice.paid`, we guarantee that a subscription is only marked `ACTIVE` and credits are only granted when payment succeeds. The `InvoicePaidStrategy` will look up the user using `stripeCustomerId` found in the invoice, and look up the plan using the `price.id` in the invoice line items.
   - *Alternatives considered*: Creating the subscription synchronously and updating it later. Rejected because it violates "Stripe is Source of Truth" and creates complex reconciliation edge cases.

## Risks / Trade-offs

- **Risk**: Prorated plan changes that do not generate immediate invoices will not reflect in the local database immediately because no `invoice.paid` is sent until the next cycle.
  - *Mitigation*: For now, we accept this trade-off in favor of architectural simplicity and payment guarantees. Future iterations can introduce a `customer.subscription.updated` strategy to handle these edge cases without generating credits.
