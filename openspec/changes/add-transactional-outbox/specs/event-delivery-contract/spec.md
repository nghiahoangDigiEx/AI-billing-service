# event-delivery-contract

## ADDED Requirements

### Requirement: Standard Domain Event Envelope
The system SHALL publish all domain events using a single standard envelope containing a unique event instance id, event type, schema version, occurrence timestamp, typed payload, and metadata (provider event id, causation id, correlation id).

#### Scenario: Event carries traceable identity
- **WHEN** a domain event is produced from a Stripe webhook
- **THEN** the envelope contains a unique `id`, the event `type`, `version`, `occurredAt`, and `metadata.providerEventId` referencing the Stripe event
- **AND** `metadata.correlationId` links all events derived from the same webhook

#### Scenario: Envelope replaces ad-hoc payloads
- **WHEN** any module emits a domain event
- **THEN** the payload is wrapped in the standard envelope rather than a listener-specific interface

### Requirement: Swappable Event Publisher
The system SHALL publish domain events exclusively through an `EventPublisher` interface, with an in-process implementation wrapping the internal event bus, so that a broker-based implementation can be substituted without changing producers or consumers.

#### Scenario: In-process delivery
- **WHEN** the relay publishes an envelope via the in-process publisher
- **THEN** registered listeners receive the envelope through the internal event bus
- **AND** the publisher resolves only after listeners complete (awaited delivery)

#### Scenario: Transport substitution
- **WHEN** a broker-based publisher is configured in place of the in-process publisher
- **THEN** producers, the relay, and consumer business logic require no code changes

### Requirement: Event Contracts Location
The system SHALL define event envelope types and event type constants in the shared events location (`src/events/`) so they serve as the inter-service contract when modules are extracted into services.

#### Scenario: Consumer depends on shared contract
- **WHEN** the credit module handles an `invoice.paid` event
- **THEN** it imports the envelope and payload types from the shared events location rather than declaring local payload interfaces
