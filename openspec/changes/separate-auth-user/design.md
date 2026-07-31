## Context

The `UserService` in the billing-service currently manages both user identity (profiles, roles) and authentication (passwords, JWTs, OAuth strategies). This tightly couples the domains and creates a risk of exposing password hashes during profile queries.

## Goals / Non-Goals

**Goals:**
- Extract all authentication logic into a new `AuthModule`.
- Keep identity management in `UserModule`.
- Prevent `UserModule` from knowing about JWTs, passwords, or strategies.
- Prevent accidental password hash exposure by creating explicit internal methods for the `AuthService` to fetch user credentials.

**Non-Goals:**
- Do not change any database schemas.
- Do not change any API contracts. The external behavior of API endpoints remains identical.

## Decisions

- **Decision 1: `AuthService` orchestrates registration.** `AuthService` handles password hashing and then delegates to `UserService.createUser` to persist the record. `UserService.createUser` handles duplicate email exceptions and emits the `USER_REGISTERED` event.
- **Decision 2: Internal fetch method for authentication.** `UserService` will expose a new method `findByEmailWithPassword(email: string)` specifically for `AuthService` to use during login. This ensures we do not leak the `password` field in the standard `getProfile` or `findAll` methods.

## Risks / Trade-offs

- **Risk**: Circular dependencies between `UserModule` and `AuthModule`.
  **Mitigation**: The dependency is strictly one-way: `AuthModule` imports `UserModule`. `UserModule` is fully decoupled from `AuthModule` and does not import it.
