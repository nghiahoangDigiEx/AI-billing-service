## MODIFIED Requirements

### Requirement: Upgrade Subscription in Stripe
The system SHALL update the existing Stripe subscription to apply the new price instead of creating a secondary subscription, to preserve proration and billing continuity.

#### Scenario: Executing the upgrade API
- **WHEN** `upgradeSubscription` is called
- **THEN** it calls the `PaymentProviderAdapter` to update the current subscription with the new price
- **AND** the underlying provider automatically handles any necessary proration
