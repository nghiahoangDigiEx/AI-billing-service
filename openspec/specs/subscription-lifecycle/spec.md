# subscription-lifecycle

## Purpose
TBD

## Requirements

### Requirement: Upgrade Subscription in Stripe
The system SHALL update the existing Stripe subscription via the Stripe API without synchronously creating or updating the local subscription record. Local database state SHALL ONLY be updated asynchronously when a webhook is received.

#### Scenario: Executing the upgrade API
- **WHEN** `upgradeSubscription` is called
- **THEN** it calls the Stripe API to update the current `stripeSubscriptionId` with the new price
- **AND** it returns a success response without modifying the `Subscription` table in the local database
