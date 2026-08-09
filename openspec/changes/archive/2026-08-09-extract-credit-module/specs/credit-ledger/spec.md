## ADDED Requirements

### Requirement: Atomic Credit Transactions
The system SHALL ensure that every mutation to a `CreditBalance` is accompanied by a corresponding `CreditTransaction` record within the same database transaction.

#### Scenario: Provisioning new credits
- **WHEN** the system adds credits to a user's balance
- **THEN** a `CreditTransaction` of type `PROVISION` is created
- **AND** the `CreditBalance` is updated in the same atomic transaction

### Requirement: Provision Monthly Credits
The system SHALL provision monthly credits when an invoice is successfully paid. Existing active monthly credits SHALL be marked as exhausted.

#### Scenario: Invoice paid event received
- **WHEN** the `INVOICE_PAID` event is emitted by the Billing module
- **THEN** the Credit module marks any existing `ACTIVE` monthly credit balances as `EXHAUSTED`
- **AND** creates a new `ACTIVE` monthly credit balance with the credits included in the plan
- **AND** logs a `PROVISION` transaction for the new balance

### Requirement: Provision Add-on Credits
The system SHALL provision add-on credits when an add-on purchase is successful.

#### Scenario: Add-on purchased event received
- **WHEN** the `ADDON_PURCHASED` event is emitted
- **THEN** the Credit module creates a new `ACTIVE` add-on credit balance
- **AND** logs a `PROVISION` transaction

### Requirement: Freeze Add-on Credits on Payment Failure
The system SHALL freeze any active add-on credits when a subscription payment fails or the subscription is deleted/downgraded to a free tier.

#### Scenario: Subscription payment fails
- **WHEN** the `SUBSCRIPTION_PAYMENT_FAILED` event is emitted
- **THEN** the Credit module updates all `ACTIVE` add-on credit balances to `FROZEN`
- **AND** logs a `FREEZE` transaction for each affected balance

### Requirement: Unfreeze Add-on Credits
The system SHALL unfreeze frozen add-on credits when a subscription becomes active again (e.g., a past due invoice is paid).

#### Scenario: Past due invoice paid
- **WHEN** the `INVOICE_PAID` event is emitted and the user has `FROZEN` add-on credits
- **THEN** the Credit module updates the `FROZEN` add-on credit balances to `ACTIVE`
- **AND** logs an `UNFREEZE` transaction for each affected balance
