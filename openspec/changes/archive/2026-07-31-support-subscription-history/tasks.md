## 1. Database Schema Updates

- [x] 1.1 Remove `@unique` constraint from `stripeSubscriptionId` in `schema.prisma`
- [x] 1.2 Generate Prisma client and run dev migration

## 2. Stripe Service Modifications

- [x] 2.1 Add `updateSubscription` method to `StripeService` wrapper
- [x] 2.2 Write unit tests for `updateSubscription` in `stripe.service.spec.ts`

## 3. Billing Service Modifications

- [x] 3.1 Refactor `BillingService.upgradeSubscription` to use `updateSubscription` instead of `createSubscription`
- [x] 3.2 Update `BillingService.upgradeSubscription` to mark old local row as CANCELLED and create new local row as ACTIVE
- [x] 3.3 Ensure existing unit tests for `upgradeSubscription` are updated to reflect the new logic

## 4. Webhook Handlers Updates

- [x] 4.1 Update `handleInvoicePaid` to search for active subscription using `findFirst` with `{ stripeSubscriptionId, status: 'ACTIVE' }`
- [x] 4.2 Update `handleInvoicePaymentFailed` to use `findFirst` for active subscription lookup
- [x] 4.3 Update `handleSubscriptionDeleted` to use `findFirst` for active subscription lookup
- [x] 4.4 Fix any webhook tests failing due to `findUnique` changing to `findFirst`

## 5. Final Verification

- [x] 5.1 Run all tests (`npm run test` and `npm run test:e2e`)
- [x] 5.2 Build and verify no typescript errors (`npm run typecheck` and `npm run build`)
