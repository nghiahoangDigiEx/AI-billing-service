## 1. Setup Structure

- [x] 1.1 Create `controllers/` and `services/` directories for the `billing` module
- [x] 1.2 Create `controllers/` and `services/` directories for the `auth` module
- [x] 1.3 Create `controllers/` and `services/` directories for the `user` module

## 2. Relocate Files

- [x] 2.1 Move all `.controller.ts` (and `.spec.ts`) files in `billing`, `auth`, and `user` to their respective `controllers/` directories
- [x] 2.2 Move all `.service.ts` (and `.spec.ts`) files in `billing`, `auth`, and `user` to their respective `services/` directories
- [x] 2.3 Move `billing.scheduler.ts` and its `.spec.ts` file to `billing/services/`

## 3. Update Imports

- [x] 3.1 Update controller and service imports in `billing.module.ts`
- [x] 3.2 Update controller and service imports in `auth.module.ts`
- [x] 3.3 Update controller and service imports in `user.module.ts`
- [x] 3.4 Verify and fix any other broken relative imports across the project

## 4. Verification

- [x] 4.1 Run `npm run typecheck` to ensure no import errors exist
- [x] 4.2 Run `npm run build` to ensure the project compiles successfully
- [x] 4.3 Run `npm run test` to verify unit tests still pass
