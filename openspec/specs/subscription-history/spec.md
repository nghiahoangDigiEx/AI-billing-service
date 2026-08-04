# subscription-history

## Purpose
TBD

## Requirements

### Requirement: Historical Subscription Tracking
The system SHALL keep historical records of all previous subscription plans a user has held, marking them as CANCELLED when an upgrade or downgrade occurs.

#### Scenario: User upgrades to a new plan
- **WHEN** a user initiates an upgrade to a new plan
- **THEN** the existing active subscription row is marked as `CANCELLED`
- **AND** a new subscription row is created with status `ACTIVE` and the new `planPriceId`
- **AND** both rows share the same `stripeSubscriptionId`
