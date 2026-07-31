## Why

The codebase currently contains hardcoded "magic strings" for event names (e.g., `'invoice.paid'`), configuration keys (e.g., `'STRIPE_SECRET_KEY'`), and Prisma database enums (e.g., `'ACTIVE'`). This lack of type safety and centralization makes the code susceptible to typos, harder to refactor, and challenging to maintain as the project grows. Centralizing these strings into strongly-typed constants and enums will improve code reliability and developer experience.

## What Changes

- Create a centralized constants file for system events (`event.constants.ts`).
- Create a centralized constants file for configuration keys (`config.constants.ts`).
- Replace all hardcoded event string literals across services and strategies with constants.
- Replace all hardcoded configuration key strings across modules and services with constants.
- Replace all hardcoded Prisma enum values in business logic (e.g., `billing.service.ts`) with typed `@prisma/client` enums (e.g., `PlanStatus.ACTIVE`).
- Provide an automated way (or documentation) to detect any future magic strings injected into the project.

## Capabilities

### New Capabilities
- `coding-standards`: Establish strongly-typed constants for events and config keys to eliminate magic strings in the project.

### Modified Capabilities
- `environment-config`: Update the configuration capability to enforce the usage of typed `CONFIG_KEYS` rather than loose string keys.
- `prisma-integration`: Update the Prisma usage capability to enforce the usage of imported enums from `@prisma/client`.

## Impact

- **Affected Code**: `webhook.service.ts`, `billing.service.ts`, Stripe event strategies, authentication strategies, `billing.scheduler.ts`, and authorization guards.
- **Dependencies**: No new external dependencies required. Relies on `@nestjs/config` and `@prisma/client`.
- **Systems**: Improves overall type safety across the NestJS backend without altering external API contracts or database schemas.
