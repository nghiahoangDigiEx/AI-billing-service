## Why

The billing service requires a foundational user authentication system to enable subscription management, credit tracking, and role-based access control. This is the first module needed to support all downstream billing and credit functionality. Without user registration and login, we cannot create subscriptions, track credit balances, or enforce access control.

## What Changes

- **User Registration**: Email/password registration with validation, password hashing, and automatic free subscription creation via event emission
- **JWT Authentication**: Login endpoint issuing short-lived access tokens (15 min) and long-lived refresh tokens (7 days) with token rotation
- **Token Refresh**: Refresh endpoint to obtain new access tokens using valid refresh tokens
- **Google OAuth**: Passport.js-based Google OAuth flow for social login, creating or updating user records
- **Profile Management**: Endpoints for users to view and update their own profile information
- **Role-Based Access Control**: USER and ADMIN roles with guards enforcing role requirements on endpoints
- **Admin User Management**: Admin-only endpoints to list users and update user roles
- **Event-Driven Integration**: Emit `user.registered` event to trigger free subscription creation in Billing module

## Capabilities

### New Capabilities

- `user-auth`: Core authentication including registration, login, token refresh, and JWT strategy implementation
- `user-oauth`: Google OAuth integration via Passport.js with user creation/update logic
- `user-profile`: Profile viewing and updating for authenticated users
- `user-rbac`: Role-based access control including guards, decorators, and admin user management endpoints

### Modified Capabilities

(none - this is a new module)

## Impact

**Code**: New User module with controller, service, DTOs, guards, decorators, and Passport strategies

**APIs**: 9 new endpoints (5 public/auth, 2 user profile, 2 admin)

**Database**: User table with role and provider enums, RefreshToken table for token rotation

**Dependencies**: @nestjs/passport, @nestjs/jwt, passport-jwt, passport-google-oauth20, bcrypt, class-validator, class-transformer

**Events**: Emits `user.registered` event consumed by Billing module (not implemented in this change)

**Security**: Password hashing with bcrypt, JWT secrets via environment variables, OAuth credentials via environment variables
