## 1. Database Schema

- [x] 1.1 Add `CreditTransaction` model to `schema.prisma` linking to `CreditBalance`.
- [x] 1.2 Run `npx prisma migrate dev` to create the migration.
- [x] 1.3 Update `prisma validate` to ensure schema is correct.

## 2. Credit Module Scaffold

- [x] 2.1 Create `src/modules/credit` directory.
- [x] 2.2 Create `credit.module.ts`, registering necessary providers.
- [x] 2.3 Create `credit.service.ts`.
- [x] 2.4 Create `listeners/credit-provisioning.listener.ts`.
- [x] 2.5 Register `CreditModule` in `app.module.ts`.

## 3. Credit Service Implementation

- [x] 3.1 Implement `credit.service.ts` methods for provisioning monthly credits (using `$transaction`).
- [x] 3.2 Implement method for provisioning add-on credits.
- [x] 3.3 Implement method for freezing and unfreezing add-on credits.
- [x] 3.4 Implement method for consuming credits (deduct remainingCredits and insert transaction).

## 4. Refactoring Billing Module Listeners

- [x] 4.1 Remove direct `CreditBalance` mutations from `invoice-paid.listener.ts`.
- [x] 4.2 Remove direct `CreditBalance` mutations from `invoice-payment-failed.listener.ts`.
- [x] 4.3 Remove direct `CreditBalance` mutations from `subscription-deleted.listener.ts`.
- [x] 4.4 Remove direct `CreditBalance` mutations from `payment-intent-succeeded.listener.ts`.
- [x] 4.5 Ensure these listeners correctly emit their respective internal domain events (`INVOICE_PAID`, `ADDON_PURCHASED`, etc.) with necessary payload data.

## 5. Implement Credit Provisioning Listener

- [x] 5.1 Handle `INVOICE_PAID` event in `credit-provisioning.listener.ts` to provision monthly credits and unfreeze addons if active.
- [x] 5.2 Handle `ADDON_PURCHASED` event to provision addon credits.
- [x] 5.3 Handle `SUBSCRIPTION_PAYMENT_FAILED` event to freeze addon credits.
- [x] 5.4 Handle `SUBSCRIPTION_DELETED` event to provision free plan credits and freeze addons.

## 6. Testing

- [x] 6.1 Update existing tests in `billing` module that mock credit balance updates.
- [x] 6.2 Add unit tests for `credit.service.ts`.
- [x] 6.3 Run `npm run test` and `npm run test:e2e` to verify all flows.
