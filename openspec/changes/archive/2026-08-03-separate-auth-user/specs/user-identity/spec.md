## ADDED Requirements

### Requirement: Independent Identity Module
The system SHALL isolate all user identity and profile management logic within a `UserModule`, completely decoupled from authentication mechanisms.

#### Scenario: User profile fetch
- **WHEN** an authenticated request asks for the user profile
- **THEN** the `UsersController` returns the profile without exposing password hashes or internal auth states

### Requirement: Identity Persistence and Events
The `UserService` SHALL be the sole owner of user persistence and lifecycle events.

#### Scenario: Record creation
- **WHEN** `AuthService` delegates registration to `UserService`
- **THEN** `UserService` creates the record in the database, throwing an exception on duplicate email, and emits the `USER_REGISTERED` event

### Requirement: Internal Auth Lookups
The `UserService` SHALL provide explicit internal methods for the `AuthModule` to fetch user credentials.

#### Scenario: Auth login lookup
- **WHEN** `AuthService` calls `UserService.findByEmailWithPassword`
- **THEN** it receives the user record containing the password hash
