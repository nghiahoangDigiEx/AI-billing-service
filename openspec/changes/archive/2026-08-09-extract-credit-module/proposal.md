## Why

Currently, credit balance updates are scattered across listeners in the Billing Module (e.g., `invoice-paid.listener.ts`, `payment-intent-succeeded.listener.ts`), violating module boundaries. Furthermore, credit mutations lack an atomic audit trail: the `CreditBalance` is updated directly without a corresponding `CreditTransaction` being inserted, which violates the strict invariant defined in the architecture that requires all credit mutations to be recorded atomically. This change centralizes credit management into its own domain module and establishes a proper credit ledger system.

## What Changes

- Extract all credit management logic (provisioning, freezing, unfreezing, consuming) out of the Billing Module.
- Create a dedicated `Credit Module` responsible for credit ledger operations.
- Create a new `CreditTransaction` table in the database schema.
- **BREAKING**: Event listeners in Billing Module will no longer update `CreditBalance`. Instead, they will emit domain events (like `INVOICE_PAID`, `ADDON_PURCHASED`) which the `Credit Module` will listen to and act upon.
- Enforce atomic database transactions: every change to `CreditBalance` must insert a corresponding `CreditTransaction`.

## Capabilities

### New Capabilities
- `credit-ledger`: Defines the requirements for credit balance management, reset policies (monthly/addons), and transaction auditing.

### Modified Capabilities

## Impact

- **Database**: Adds `CreditTransaction` table to Prisma schema.
- **Code**: `src/modules/billing/listeners/` will be stripped of credit logic. A new `src/modules/credit` directory will be created.
- **Dependencies**: No external dependencies added, but internal event flow relies heavily on `EventEmitter2`.
