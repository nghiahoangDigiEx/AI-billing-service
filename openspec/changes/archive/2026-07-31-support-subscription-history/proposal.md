## Why

Users need to be able to see their entire subscription history (past cancelled or upgraded plans) while maintaining exactly one active subscription row. The current database schema uses a `@unique` constraint on `stripeSubscriptionId` on the `Subscription` table, which prevents us from modifying the existing active subscription in Stripe (the recommended best practice to preserve automatic proration) while generating new tracking rows in the local database. This change removes the uniqueness blocker and fixes the upgrade flow to correctly maintain subscription histories and respect Stripe's automatic proration rules.

## What Changes

- **BREAKING**: Remove the `@unique` constraint from the `stripeSubscriptionId` column in the `Subscription` table (Prisma Schema).
- Update the upgrade subscription logic to update the existing Stripe subscription via Stripe API, rather than blindly calling `createSubscription` and creating duplicate billing states.
- On upgrade, mark the previous local `Subscription` row as cancelled, and create a new row as active pointing to the same Stripe Subscription ID.
- Update webhook handlers (`webhook.service.ts`) to locate the active local subscription row when querying by `stripeSubscriptionId` instead of relying on uniqueness.

## Capabilities

### New Capabilities
- `subscription-history`: Tracking and persisting the history of user subscriptions across plan changes, while keeping Stripe IDs consistent.

### Modified Capabilities
- `subscription-lifecycle`: Modifying the requirements of how upgrades are executed in Stripe and how they map to the local database.

## Impact

- **Database**: Prisma schema change for `Subscription` table (requires migration).
- **Stripe Service**: Adding `updateSubscription` functionality.
- **Billing Service**: The `upgradeSubscription` method will be refactored to perform updates instead of creations.
- **Webhooks**: Webhook handlers looking up subscriptions by `stripeSubscriptionId` will now need to also filter by `status: 'ACTIVE'` to fetch the current state.
