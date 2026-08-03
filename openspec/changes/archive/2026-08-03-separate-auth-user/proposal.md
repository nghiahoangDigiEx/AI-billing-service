## Why

Currently, the `UserModule` acts as a "God Module" that handles both the Authentication domain (passwords, tokens, login, registration, OAuth validation) and the Identity domain (user profiles, roles, queries). This blurring of responsibilities violates the single responsibility principle, making the `UserService` overly complex, risking accidental password hash leakage in API responses, and tightly coupling two independent domains. Separating them creates a much cleaner architecture.

## What Changes

- Create a new `AuthModule` to encapsulate all authentication and authorization logic.
- Move `AuthController`, `JwtStrategy`, `GoogleStrategy`, and related DTOs/Guards to the new `AuthModule`.
- Extract authentication logic (password hashing, token generation, login validation, registration orchestration, OAuth mapping) from `UserService` into a new `AuthService`.
- Refactor `UserService` to focus solely on identity management (CRUD operations, role management).
- Add distinct fetch methods in `UserService` (e.g., `findByEmailWithPassword`) for internal use by `AuthService` to safely retrieve password hashes, while ensuring public methods like `getProfile` do not expose sensitive data.
- Ensure the `USER_REGISTERED` event continues to be emitted by `UserService` when a user record is created.

## Capabilities

### New Capabilities
- `auth-domain`: Extraction of the Authentication domain into its own independent module and service.

### Modified Capabilities
- `user-identity`: Modifying the existing user identity capability to remove authentication concerns and define strict interfaces for the Auth domain to consume (e.g., internal lookup methods that return password hashes).

## Impact

- **Affected Code**: `src/modules/user/*` (Controllers, Services, Module, DTOs, Guards, Strategies).
- **New Code**: `src/modules/auth/*` (New module, service, controller, and moved dependencies).
- **APIs**: The API contracts and route paths (e.g., `/auth/login`, `/users/profile`) will remain identical, but they will be served by different controllers in different modules.
- **Dependencies**: `AuthModule` will depend on `UserModule` to fetch user records. `UserModule` will have no dependency on `AuthModule` (preventing circular dependencies).
