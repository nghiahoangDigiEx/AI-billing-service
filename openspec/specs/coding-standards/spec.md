# coding-standards

## Purpose
Enforce strongly-typed configuration keys and centralized event string constants across the codebase.

## Requirements

### Requirement: Strongly-Typed Config Keys
The system SHALL NOT use loose magic strings (e.g., `'STRIPE_SECRET_KEY'`) to access environment variables. All references to configuration keys MUST be accessed via the centralized `CONFIG_KEYS` object exported from `src/common/constants/config.constants.ts`.

#### Scenario: Developer retrieves a configuration variable
- **WHEN** a service injects `ConfigService` to retrieve an environment variable
- **THEN** the key is referenced using `CONFIG_KEYS.<KEY_NAME>` (e.g., `CONFIG_KEYS.STRIPE_SECRET_KEY`)
- **AND** the code fails to compile or lint if a raw string is used.

### Requirement: Centralized Event String Constants
The system SHALL NOT use loose magic strings (e.g., `'invoice.paid'`) when emitting or subscribing to internal event-bus events. All event identifiers MUST be imported as named constants from `src/events/event.constants.ts`.

#### Scenario: Webhook service emits an event
- **WHEN** the webhook service emits an event via EventEmitter2
- **THEN** the event name argument is a constant like `INVOICE_PAID` rather than `'invoice.paid'`

#### Scenario: Strategy subscribes to an event
- **WHEN** a strategy listens to an event via `@OnEvent()`
- **THEN** the decorator argument is a constant like `INVOICE_PAID` rather than `'invoice.paid'`
