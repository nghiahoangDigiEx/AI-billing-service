## 1. Constants Setup

- [x] 1.1 Create `src/events/event.constants.ts` with named string constants.
- [x] 1.2 Create `src/common/constants/config.constants.ts` with `CONFIG_KEYS` object.

## 2. Event Replacements

- [x] 2.1 Replace raw strings in Stripe strategy classes (e.g., `@OnEvent('invoice.paid')`).
- [x] 2.2 Replace raw strings in Webhook Service `this.eventEmitter.emit(...)` calls.
- [x] 2.3 Replace raw strings in `billing.scheduler.ts`.

## 3. Configuration Key Replacements

- [x] 3.1 Replace hardcoded strings in `webhook.controller.ts`.
- [x] 3.2 Replace hardcoded strings in authentication strategies (`jwt.strategy.ts`, `google.strategy.ts`).
- [x] 3.3 Replace hardcoded strings in Stripe service injection logic.
- [x] 3.4 Replace hardcoded strings in `user.module.ts`.

## 4. Prisma Enum Refactoring

- [x] 4.1 Update `billing.service.ts` to use `@prisma/client` Enums instead of string literals.
- [x] 4.2 Update `billing.scheduler.ts` to use `@prisma/client` Enums where applicable.
- [x] 4.3 Update authorization guards (e.g., `require-active-subscription`) to use `@prisma/client` Enums instead of string literals.

## 5. Verification

- [x] 5.1 Run `npm run lint` and apply fixes to unused imports.
- [x] 5.2 Run `npm run typecheck` to ensure no typescript violations exist in services or tests.
- [x] 5.3 Verify all tests pass with `npm run test`, updating `.spec.ts` mocking structures as necessary to reflect the new typings.
