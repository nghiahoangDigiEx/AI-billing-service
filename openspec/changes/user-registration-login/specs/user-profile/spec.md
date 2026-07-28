## ADDED Requirements

### Requirement: View current user profile
The system SHALL allow authenticated users to view their own profile information. The system SHALL return user data excluding sensitive fields (password, providerId).

#### Scenario: Successful profile retrieval
- **WHEN** an authenticated user requests GET `/users/me` with a valid JWT access token
- **THEN** the system returns the user's profile information including id, email, name, avatar, role, provider, createdAt, and updatedAt (excluding password and providerId)

#### Scenario: Unauthenticated profile access
- **WHEN** a request to GET `/users/me` does not include a valid JWT access token
- **THEN** the system rejects the request with a 401 Unauthorized error

### Requirement: Update user profile
The system SHALL allow authenticated users to update their own profile information (name and avatar). The system SHALL validate input data and reject invalid updates.

#### Scenario: Successful profile update
- **WHEN** an authenticated user submits valid data via PATCH `/users/me` with name and/or avatar fields
- **THEN** the system updates the user's profile, returns the updated profile information, and sets updatedAt to current timestamp

#### Scenario: Update name only
- **WHEN** an authenticated user submits only the name field via PATCH `/users/me`
- **THEN** the system updates only the user's name field and returns the updated profile

#### Scenario: Update avatar only
- **WHEN** an authenticated user submits only the avatar field via PATCH `/users/me`
- **THEN** the system updates only the user's avatar field and returns the updated profile

#### Scenario: Invalid profile data
- **WHEN** an authenticated user submits invalid data (e.g., name exceeding maximum length) via PATCH `/users/me`
- **THEN** the system rejects the request with a 400 Bad Request validation error

#### Scenario: Unauthenticated profile update
- **WHEN** a request to PATCH `/users/me` does not include a valid JWT access token
- **THEN** the system rejects the request with a 401 Unauthorized error

#### Scenario: Attempt to update restricted fields
- **WHEN** an authenticated user attempts to update restricted fields (email, password, role, provider, providerId) via PATCH `/users/me`
- **THEN** the system ignores the restricted fields and only updates allowed fields (name, avatar)
