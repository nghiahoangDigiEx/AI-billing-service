## Context

Currently, the database enforces that a user can only have one `Subscription` row mapped to a `stripeSubscriptionId` because of a `@unique` constraint. This forces the system to either create duplicate, disconnected Stripe subscriptions when a user upgrades, or manually delete rows in the local database. To support showing users their historical plan changes and keeping Stripe's automatic proration via `Stripe.subscriptions.update()`, we must relax this constraint.

## Goals / Non-Goals

**Goals:**
- Allow multiple historical `Subscription` records for a user that share the same `stripeSubscriptionId`.
- Ensure there is only ever ONE active subscription per user at a time locally.
- Correctly update Stripe subscriptions instead of replacing them to preserve out-of-the-box Stripe proration logic.

**Non-Goals:**
- Refactoring the entire `CreditBalance` logic or Addon architecture.
- Changing how invoices and payments are collected.

## Decisions

1. **Remove `@unique` on `stripeSubscriptionId` in Prisma schema**
   - *Rationale*: We must maintain the exact same `stripeSubscriptionId` during a plan upgrade so Stripe can prorate. We need to create a new row locally to record the user's historical state. Without removing `@unique`, Prisma will throw a unique constraint violation.
   - *Alternatives considered*: Cancel the old Stripe subscription and create a new one. Rejected because we lose automatic proration.

2. **Update Stripe subscription instead of creating new ones on upgrade**
   - *Rationale*: Proration and continuity on Stripe Dashboard. We will add an `updateSubscription` wrapper in `StripeService`.

3. **Lookup active subscriptions combining `stripeSubscriptionId` and `status`**
   - *Rationale*: Webhooks like `invoice.paid` currently look up by just `stripeSubscriptionId`. They will now need to query `stripeSubscriptionId` + `status: 'ACTIVE'` (using `findFirst`) to find the correct local mapping.

## Risks / Trade-offs

- **Risk**: A webhook handler accidentally modifies a `CANCELLED` historical row instead of the `ACTIVE` one.
  - *Mitigation*: Ensure all `findUnique` calls that previously relied solely on `stripeSubscriptionId` are updated to `findFirst` with `{ stripeSubscriptionId, status: 'ACTIVE' }`.
