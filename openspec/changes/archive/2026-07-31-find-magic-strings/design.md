## Context

The system previously relied on hardcoded magic strings for database enums (`ACTIVE`, `INACTIVE`), configuration keys (`STRIPE_SECRET_KEY`), and event-bus event names (`invoice.paid`). This made it difficult to safely typecheck references, caused brittle tests, and increased the likelihood of breaking changes during refactors. We have introduced `event.constants.ts` and `config.constants.ts` to map string literals to typed variable references.

## Goals / Non-Goals

**Goals:**
- Centralize event and configuration string literals.
- Enforce strongly-typed Prisma enum usage in service layer business logic.
- Prevent regressions in automated test coverage.
- Allow TypeScript to warn developers during compile-time if an invalid key is referenced.

**Non-Goals:**
- Do not fundamentally alter the underlying database schema or the way Prisma handles enums.
- Do not refactor NestJS core configuration modules; only standardize the key inputs.
- Do not migrate from strings to numeric constants. 

## Decisions

- **Event Constants (`src/events/event.constants.ts`)**: Extracted strings to individual exported constants (e.g. `export const INVOICE_PAID = 'invoice.paid';`) rather than a monolithic object. This allows individual named imports that are easier to tree-shake and spot in PR reviews.
- **Config Constants (`src/common/constants/config.constants.ts`)**: Used a frozen typed object `export const CONFIG_KEYS = { ... } as const;`. This ensures `process.env[CONFIG_KEYS.FOO]` evaluates properly and allows autocomplete.
- **Prisma Enums**: Instead of duplicating enums locally, rely directly on `@prisma/client` generated enums (e.g. `PlanStatus.ACTIVE`). This guarantees that code stays perfectly in sync with the database schema source of truth.

## Risks / Trade-offs

- **Risk: Eslint and TypeScript conflicts in mock testing** → Mock functions (`mockResolvedValue`) for Prisma calls may complain if deep mock typing isn't cast correctly. **Mitigation**: Temporarily suppress ESLint warnings in unit tests specifically around mocked types (`@typescript-eslint/no-unsafe-call`) while retaining full runtime assertions and compiler checks on production code.
- **Trade-off: Increased verbosity** → Developer code uses longer tokens (`CONFIG_KEYS.STRIPE_SECRET_KEY`) vs `'STRIPE_SECRET_KEY'`, but gains IDE autocomplete and compile-time validation.
