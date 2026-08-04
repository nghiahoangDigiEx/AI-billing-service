## ADDED Requirements

### Requirement: Google OAuth authentication
The system SHALL allow users to authenticate via Google OAuth 2.0. The system SHALL create a new user record if the user does not exist, or update the existing user record if the user already exists (matched by Google provider ID or email). The system SHALL issue JWT access and refresh tokens after successful OAuth authentication.

#### Scenario: New user registers via Google OAuth
- **WHEN** a user initiates Google OAuth flow via GET `/auth/google` and completes authentication
- **THEN** the system creates a new User record with `provider: GOOGLE`, `providerId: <google-id>`, `email`, `name`, and `avatar` from Google profile, issues JWT access and refresh tokens, and redirects to the application

#### Scenario: Existing user logs in via Google OAuth (matched by providerId)
- **WHEN** a user with an existing User record (matched by `providerId`) initiates Google OAuth flow
- **THEN** the system updates the user record with latest profile information from Google, issues JWT access and refresh tokens, and redirects to the application

#### Scenario: Existing user logs in via Google OAuth (matched by email)
- **WHEN** a user with an existing User record (matched by `email` but no `providerId`) initiates Google OAuth flow
- **THEN** the system updates the user record with `provider: GOOGLE`, `providerId: <google-id>`, and latest profile information from Google, issues JWT access and refresh tokens, and redirects to the application

#### Scenario: Google OAuth callback handling
- **WHEN** Google redirects back to GET `/auth/google/callback` with an authorization code
- **THEN** the system exchanges the code for tokens, retrieves user profile from Google, creates or updates the user record, issues JWT tokens, and redirects to the application with tokens

### Requirement: OAuth user profile synchronization
The system SHALL synchronize user profile information from Google OAuth provider on each login. The system SHALL update name and avatar fields from Google profile data.

#### Scenario: Profile update on OAuth login
- **WHEN** an existing user logs in via Google OAuth and their Google profile has updated information
- **THEN** the system updates the user's `name` and `avatar` fields with the latest values from Google profile

### Requirement: OAuth provider identification
The system SHALL identify users by their OAuth provider and provider-specific ID. The system SHALL store the Google OAuth ID in the `providerId` field. The system SHALL set `provider: GOOGLE` for OAuth users.

#### Scenario: Provider information stored correctly
- **WHEN** a user registers via Google OAuth
- **THEN** the User record contains `provider: GOOGLE`, `providerId: <google-oauth-id>`, and `password: null`

#### Scenario: OAuth user cannot use password login
- **WHEN** a user registered via Google OAuth (with `provider: GOOGLE`) attempts password login
- **THEN** the system rejects the login attempt with a 401 Unauthorized error
