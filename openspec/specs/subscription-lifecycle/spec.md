# subscription-lifecycle

## Purpose
TBD

## Requirements

### Requirement: Upgrade Subscription in Stripe
The system SHALL update the existing Stripe subscription to apply the new price instead of creating a secondary subscription, to preserve proration and billing continuity.

#### Scenario: Executing the upgrade API
- **WHEN** `upgradeSubscription` is called
- **THEN** it calls the Stripe API to update the current `stripeSubscriptionId` with the new price
- **AND** Stripe automatically handles any necessary proration
