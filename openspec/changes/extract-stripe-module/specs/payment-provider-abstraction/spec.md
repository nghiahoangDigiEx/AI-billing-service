## ADDED Requirements

### Requirement: Payment Provider Abstraction
The system MUST provide a generic `PaymentProviderAdapter` interface for all payment providers.

#### Scenario: Interacting with a payment provider
- **WHEN** the billing module needs to create a subscription
- **THEN** it resolves the appropriate adapter via `PaymentProviderFactory` and calls `createSubscription`
