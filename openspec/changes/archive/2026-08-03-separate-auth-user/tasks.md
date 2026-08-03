## 1. Preparation & Scaffold

- [x] 1.1 Create `src/modules/auth` directory and `auth.module.ts` scaffold.
- [x] 1.2 Add `AuthModule` to `app.module.ts` imports.

## 2. Refactor UserModule

- [x] 2.1 Add `findByEmailWithPassword(email: string)` method to `UserService`.
- [x] 2.2 Remove auth-related methods (`login`, `refreshToken`, `validateOAuthUser`, `generateAccessToken`, `generateRefreshToken`) from `UserService`.
- [x] 2.3 Refactor `UserService.register` to `UserService.createUser`, ensuring it throws `UserAlreadyExistsException` and emits `USER_REGISTERED` but does not hash passwords.
- [x] 2.4 Remove `JwtStrategy` and `GoogleStrategy` from `user.module.ts` providers.
- [x] 2.5 Remove `AuthController` from `user.module.ts`.

## 3. Implement AuthModule

- [x] 3.1 Create `AuthService` and implement authentication methods (`register`, `login`, `refreshToken`, `validateOAuthUser`).
- [x] 3.2 Update `AuthService` to call `UserService.createUser` for registration and `UserService.findByEmailWithPassword` for login.
- [x] 3.3 Move `auth.controller.ts`, auth-related DTOs (`login.dto.ts`, `register.dto.ts`), and strategies to the `auth` module directory and fix their imports.
- [x] 3.4 Wire up `AuthModule` to import `UserModule`, `JwtModule`, `PassportModule`, etc., and provide `AuthService`, `JwtStrategy`, `GoogleStrategy`.

## 4. Testing & Verification

- [x] 4.1 Update existing `user.service.spec.ts` unit tests to reflect the removed auth responsibilities.
- [x] 4.2 Create `auth.service.spec.ts` unit tests.
- [x] 4.3 Run `npm run lint` and `npm run typecheck` to verify no broken imports remain.
- [x] 4.4 Run unit tests and integration tests (`npm run test`, `npm run test:e2e`) and fix any failures.
- [x] 4.5 Verify the application builds successfully (`npm run build`).
