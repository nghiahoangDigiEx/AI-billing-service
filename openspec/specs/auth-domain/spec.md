# Auth Domain

## Purpose
TBD

## Requirements

### Requirement: Independent Auth Module
The system SHALL isolate all authentication and authorization logic within an `AuthModule`.

#### Scenario: User registration
- **WHEN** a user registers via the auth endpoint
- **THEN** the `AuthService` hashes the password and delegates persistence to `UserService`

#### Scenario: User login
- **WHEN** a user logs in with valid credentials
- **THEN** the `AuthService` retrieves the hashed password from `UserService`, validates it, and issues JWTs

### Requirement: Auth Internal Data Retrieval
The `AuthService` SHALL retrieve sensitive user information (like password hashes) exclusively via dedicated internal methods provided by `UserService`, not via public profile endpoints.

#### Scenario: Internal lookup
- **WHEN** `AuthService` needs to validate a password
- **THEN** it uses `UserService.findByEmailWithPassword` which returns the password hash for validation
