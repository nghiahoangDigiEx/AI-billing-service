## ADDED Requirements

### Requirement: Role-based access control guards
The system SHALL enforce role-based access control using guards. The system SHALL support USER and ADMIN roles. The system SHALL provide decorators to mark endpoints with required roles.

#### Scenario: USER role access
- **WHEN** a user with role USER attempts to access an endpoint protected with `@Roles(Role.USER)` or `@Roles(Role.ADMIN, Role.USER)`
- **THEN** the system grants access to the endpoint

#### Scenario: ADMIN role access
- **WHEN** a user with role ADMIN attempts to access an endpoint protected with `@Roles(Role.ADMIN)` or `@Roles(Role.ADMIN, Role.USER)`
- **THEN** the system grants access to the endpoint

#### Scenario: Insufficient role
- **WHEN** a user with role USER attempts to access an endpoint protected with `@Roles(Role.ADMIN)`
- **THEN** the system rejects the request with a 403 Forbidden error and message "Insufficient permissions"

#### Scenario: No role requirement
- **WHEN** an authenticated user accesses an endpoint without `@Roles()` decorator (but with `@UseGuards(JwtAuthGuard)`)
- **THEN** the system grants access to any authenticated user regardless of role

### Requirement: Admin user listing
The system SHALL allow ADMIN users to list all users in the system. The system SHALL support pagination and filtering.

#### Scenario: Admin lists all users
- **WHEN** an ADMIN user requests GET `/users` with a valid JWT access token
- **THEN** the system returns a paginated list of all users including id, email, name, avatar, role, provider, createdAt, and updatedAt (excluding password and providerId)

#### Scenario: Non-admin attempts to list users
- **WHEN** a USER (non-admin) attempts to access GET `/users`
- **THEN** the system rejects the request with a 403 Forbidden error

#### Scenario: Unauthenticated user listing attempt
- **WHEN** a request to GET `/users` does not include a valid JWT access token
- **THEN** the system rejects the request with a 401 Unauthorized error

### Requirement: Admin role management
The system SHALL allow ADMIN users to update the role of other users. The system SHALL validate that the target user exists before updating.

#### Scenario: Admin updates user role
- **WHEN** an ADMIN user submits a valid role via PATCH `/users/:id/role` with a target user ID and new role (USER or ADMIN)
- **THEN** the system updates the target user's role and returns the updated user profile

#### Scenario: Admin attempts to update non-existent user
- **WHEN** an ADMIN user attempts to update the role of a user that does not exist via PATCH `/users/:id/role`
- **THEN** the system rejects the request with a 404 Not Found error and message "User not found"

#### Scenario: Non-admin attempts to update role
- **WHEN** a USER (non-admin) attempts to access PATCH `/users/:id/role`
- **THEN** the system rejects the request with a 403 Forbidden error

#### Scenario: Invalid role value
- **WHEN** an ADMIN user submits an invalid role value (not USER or ADMIN) via PATCH `/users/:id/role`
- **THEN** the system rejects the request with a 400 Bad Request validation error

#### Scenario: Unauthenticated role update attempt
- **WHEN** a request to PATCH `/users/:id/role` does not include a valid JWT access token
- **THEN** the system rejects the request with a 401 Unauthorized error

### Requirement: Public endpoint decorator
The system SHALL provide a `@Public()` decorator to mark endpoints as publicly accessible (no authentication required). The system SHALL bypass JWT validation for public endpoints.

#### Scenario: Public endpoint access
- **WHEN** a request is made to an endpoint marked with `@Public()` decorator
- **THEN** the system grants access without requiring JWT authentication

#### Scenario: Mixed public and protected endpoints
- **WHEN** a controller has both public and protected endpoints
- **THEN** the system correctly applies authentication only to protected endpoints, allowing public access to public endpoints
