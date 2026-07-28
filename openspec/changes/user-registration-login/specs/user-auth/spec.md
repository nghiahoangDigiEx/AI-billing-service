## ADDED Requirements

### Requirement: User registration with email and password
The system SHALL allow new users to register with an email address and password. The system SHALL hash passwords using bcrypt before storage. The system SHALL reject duplicate email addresses. The system SHALL emit a `user.registered` event upon successful registration.

#### Scenario: Successful registration
- **WHEN** a user submits a valid email and password (minimum 8 characters) via POST `/auth/register`
- **THEN** the system creates a new User record with hashed password, returns the user profile (excluding password), and emits `user.registered` event with `{ userId, email }`

#### Scenario: Duplicate email registration
- **WHEN** a user submits an email that already exists in the system via POST `/auth/register`
- **THEN** the system rejects the request with a 409 Conflict error and message "User with this email already exists"

#### Scenario: Invalid email format
- **WHEN** a user submits an invalid email format via POST `/auth/register`
- **THEN** the system rejects the request with a 400 Bad Request validation error

#### Scenario: Password too short
- **WHEN** a user submits a password shorter than 8 characters via POST `/auth/register`
- **THEN** the system rejects the request with a 400 Bad Request validation error

### Requirement: User login with email and password
The system SHALL authenticate users with email and password credentials. The system SHALL issue a short-lived JWT access token (15 minutes) and a long-lived refresh token (7 days) upon successful authentication. The system SHALL store the refresh token in the database.

#### Scenario: Successful login
- **WHEN** a user submits valid email and password via POST `/auth/login`
- **THEN** the system returns an access token and a refresh token, and stores the refresh token in the RefreshToken table

#### Scenario: Invalid credentials
- **WHEN** a user submits incorrect email or password via POST `/auth/login`
- **THEN** the system rejects the request with a 401 Unauthorized error and message "Invalid email or password"

#### Scenario: OAuth user attempts password login
- **WHEN** a user registered via Google OAuth (no password set) attempts login via POST `/auth/login`
- **THEN** the system rejects the request with a 401 Unauthorized error and message "Invalid email or password"

### Requirement: Token refresh with rotation
The system SHALL allow users to obtain a new access token using a valid refresh token. The system SHALL rotate the refresh token (issue new, delete old) on each refresh request. The system SHALL reject expired or invalid refresh tokens.

#### Scenario: Successful token refresh
- **WHEN** a user submits a valid, non-expired refresh token via POST `/auth/refresh`
- **THEN** the system returns a new access token and a new refresh token, deletes the old refresh token from the database, and stores the new refresh token

#### Scenario: Expired refresh token
- **WHEN** a user submits an expired refresh token via POST `/auth/refresh`
- **THEN** the system rejects the request with a 401 Unauthorized error and message "Invalid or expired refresh token"

#### Scenario: Invalid refresh token
- **WHEN** a user submits a refresh token that does not exist in the database via POST `/auth/refresh`
- **THEN** the system rejects the request with a 401 Unauthorized error and message "Invalid or expired refresh token"

#### Scenario: Reused refresh token
- **WHEN** a user submits a refresh token that was already rotated (no longer in database) via POST `/auth/refresh`
- **THEN** the system rejects the request with a 401 Unauthorized error and message "Invalid or expired refresh token"

### Requirement: JWT access token validation
The system SHALL validate JWT access tokens on protected endpoints. The system SHALL extract user information (userId, email, role) from the token payload and attach it to the request object. The system SHALL reject expired or malformed tokens.

#### Scenario: Valid access token
- **WHEN** a request includes a valid, non-expired JWT in the `Authorization: Bearer <token>` header
- **THEN** the system extracts the user from the token and attaches it to the request object as `request.user`

#### Scenario: Expired access token
- **WHEN** a request includes an expired JWT in the `Authorization: Bearer <token>` header
- **THEN** the system rejects the request with a 401 Unauthorized error

#### Scenario: Missing access token
- **WHEN** a request to a protected endpoint does not include an Authorization header
- **THEN** the system rejects the request with a 401 Unauthorized error

#### Scenario: Malformed access token
- **WHEN** a request includes a malformed or invalid JWT in the Authorization header
- **THEN** the system rejects the request with a 401 Unauthorized error
