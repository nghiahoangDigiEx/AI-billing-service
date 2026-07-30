## Context

The billing service is a fresh NestJS application with no existing implementation. This change establishes the foundational User module that enables all downstream billing and credit functionality. The project follows an event-driven modular monolith architecture with three bounded modules (User, Billing, Credit).

**Current State:**
- Basic NestJS scaffold with TypeScript
- No database layer (Prisma not configured)
- No authentication system
- No modules, controllers, or services
- No environment configuration

**Constraints:**
- Must emit `user.registered` event for Billing module (not implemented in this change)
- Must support future OAuth providers (extensible strategy pattern)
- Must integrate with Neon PostgreSQL
- All secrets via environment variables, never hardcoded

## Goals / Non-Goals

**Goals:**
- Implement complete User module with registration, login, token refresh, and profile management
- Establish Prisma database layer with User schema and migrations
- Implement JWT authentication with access/refresh token rotation
- Implement Google OAuth flow via Passport.js
- Implement role-based access control (USER/ADMIN)
- Establish event emission infrastructure for cross-module communication
- Create comprehensive test coverage for all authentication flows

**Non-Goals:**
- Implementing Billing or Credit modules (separate changes)
- Implementing email verification (explicitly out of scope per AGENTS.md)
- Implementing password reset/forgot password flow
- Implementing multi-factor authentication
- Implementing rate limiting (infrastructure concern)
- Setting up Stripe integration (Billing module)
- Implementing credit management (Credit module)

## Decisions

### 1. Database Schema: User + RefreshToken Tables

**Decision:** Create two tables - `User` for user data and `RefreshToken` for token rotation.

**Rationale:**
- Separate RefreshToken table enables token revocation without modifying User table
- Supports multiple active sessions per user (future requirement)
- Clean separation of concerns: User = identity, RefreshToken = session management
- Aligns with design spec Section 4.1

**Alternative Considered:**
- Store refresh tokens in User table as array field
  - Rejected: Harder to revoke individual tokens, requires array operations, less scalable

**Schema:**
```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String?   // null for OAuth users
  name          String?
  avatar        String?
  role          Role      @default(USER)
  provider      Provider  @default(LOCAL)
  providerId    String?   // Google OAuth ID
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model RefreshToken {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token         String    @unique
  expiresAt     DateTime
  createdAt     DateTime  @default(now())
  
  @@index([userId])
}

enum Role {
  USER
  ADMIN
}

enum Provider {
  LOCAL
  GOOGLE
}
```

### 2. JWT Strategy: Dual Token with Rotation

**Decision:** Implement access token (15 min) + refresh token (7 days) with rotation on refresh.

**Rationale:**
- Short-lived access tokens minimize exposure window if compromised
- Refresh tokens enable long sessions without frequent re-authentication
- Token rotation (new refresh token on each use) provides security against token theft
- Aligns with design spec Section 6.1

**Implementation:**
- Access token payload: `{ userId, email, role }`
- Refresh token: Random UUID stored in database with expiration
- On `/auth/refresh`: Validate refresh token, issue new access + refresh tokens, delete old refresh token
- Use `@nestjs/jwt` for token signing/verification

**Alternative Considered:**
- Single long-lived access token
  - Rejected: Security risk, no way to revoke without changing secret

### 3. Password Hashing: bcrypt with Cost Factor 10

**Decision:** Use bcrypt with default cost factor (10) for password hashing.

**Rationale:**
- Industry standard for password storage
- Adaptive cost factor allows tuning as hardware improves
- Built-in salt generation prevents rainbow table attacks
- Widely supported in Node.js ecosystem

**Implementation:**
- Use `bcrypt` package (not bcryptjs - native is faster)
- Hash on registration and password change
- Compare on login

### 4. OAuth Strategy: Passport.js with Google Provider

**Decision:** Use Passport.js with Google OAuth 2.0 strategy.

**Rationale:**
- Passport.js is the de facto standard for OAuth in NestJS
- Strategy pattern enables easy addition of other providers (GitHub, Facebook)
- Handles OAuth flow complexity (redirects, callbacks, token exchange)
- Aligns with design spec Section 6.2

**Implementation:**
- `passport-google-oauth20` strategy
- On successful OAuth: Create user if new, update if existing (match by providerId or email)
- Issue JWT tokens after OAuth success
- Store Google OAuth ID in `providerId` field

**Alternative Considered:**
- Manual OAuth implementation
  - Rejected: Reinventing wheel, error-prone, Passport.js is battle-tested

### 5. Event System: EventEmitter2 with Typed Events

**Decision:** Use EventEmitter2 with typed event constants.

**Rationale:**
- Lightweight, built-in NestJS support
- Enables loose coupling between modules
- Aligns with architecture decision: event-driven cross-module communication
- User module emits events, Billing/Credit modules consume (future)

**Implementation:**
- Define event constants in `src/events/event.constants.ts`
- Use typed event payloads (interfaces)
- Emit `user.registered` with `{ userId, email }` payload on registration
- Modules never call each other's services directly

**Events Defined:**
```typescript
export const USER_REGISTERED = 'user.registered';

export interface UserRegisteredEvent {
  userId: string;
  email: string;
}
```

### 6. Guards and Decorators: Custom Implementation

**Decision:** Implement custom guards and decorators for JWT and role-based access.

**Rationale:**
- NestJS guards are the idiomatic way to protect routes
- Custom decorators provide clean metadata for role requirements
- Reusable across all modules

**Implementation:**
- `JwtAuthGuard`: Validates JWT access token, attaches user to request
- `RolesGuard`: Checks user role against required roles (from `@Roles()` decorator)
- `@Public()`: Marks routes as public (no authentication required)
- `@CurrentUser()`: Extracts user from request object

**Guard Order:**
1. `JwtAuthGuard` (authentication)
2. `RolesGuard` (authorization)

### 7. DTO Validation: class-validator with Global ValidationPipe

**Decision:** Use class-validator decorators on all DTOs with global ValidationPipe.

**Rationale:**
- Type-safe validation with decorators
- Automatic validation error responses
- Swagger integration via @nestjs/swagger decorators
- Aligns with AGENTS.md conventions

**Implementation:**
- Apply `ValidationPipe` globally in `main.ts`
- Use decorators: `@IsEmail()`, `@IsString()`, `@MinLength()`, `@IsOptional()`, etc.
- Whitelist mode: strip unknown properties
- Forbid non-whitelisted: reject unknown properties

**Example DTO:**
```typescript
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
```

### 8. Module Structure: Feature Module with Sub-Controllers

**Decision:** Single User module with two controllers (AuthController, UsersController).

**Rationale:**
- Logical grouping: authentication and user management are related
- Separate controllers for clarity: auth endpoints vs user endpoints
- Single module easier to configure and test
- Aligns with AGENTS.md module organization

**Structure:**
```
src/modules/user/
├── dto/
│   ├── register.dto.ts
│   ├── login.dto.ts
│   ├── refresh.dto.ts
│   ├── update-profile.dto.ts
│   └── update-role.dto.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── roles.guard.ts
├── decorators/
│   ├── roles.decorator.ts
│   ├── public.decorator.ts
│   └── current-user.decorator.ts
├── strategies/
│   ├── jwt.strategy.ts
│   └── google.strategy.ts
├── auth.controller.ts
├── users.controller.ts
├── user.service.ts
├── user.module.ts
└── user.service.spec.ts
```

### 9. Error Handling: Domain Exceptions with Global Filter

**Decision:** Use typed domain exceptions with global exception filter.

**Rationale:**
- Clean separation: services throw domain exceptions, filter translates to HTTP
- Consistent error response format
- Sanitizes internal errors before sending to client

**Implementation:**
- Custom exceptions: `UserAlreadyExistsException`, `InvalidCredentialsException`, `InvalidRefreshTokenException`
- Global exception filter catches all exceptions, formats response
- Never expose stack traces or internal details to clients

**Error Response Format:**
```json
{
  "statusCode": 400,
  "message": "User with this email already exists",
  "error": "Bad Request"
}
```

### 10. Testing Strategy: Mock Prisma and External Dependencies

**Decision:** Unit tests with mocked Prisma, integration tests with test database.

**Rationale:**
- Fast unit tests for business logic
- Integration tests verify database interactions
- Mocking prevents external dependency failures
- Aligns with AGENTS.md testing strategy

**Implementation:**
- Unit tests: Mock PrismaService, test service methods in isolation
- Integration tests: Use separate test database, test full request flows
- Test all authentication flows: registration, login, refresh, OAuth
- Test guards and decorators

## Risks / Trade-offs

**Risk: OAuth Provider Changes**
- Google could change OAuth API, breaking integration
- **Mitigation:** Passport.js strategies are maintained by community, monitor for updates. Strategy pattern allows easy replacement.

**Risk: Token Storage Security**
- Refresh tokens stored in database could be compromised if database is breached
- **Mitigation:** Tokens are random UUIDs (not JWTs), so no sensitive data exposed. Token rotation limits exposure window. Database encryption at rest (Neon provides this).

**Risk: Password Hashing Performance**
- bcrypt is CPU-intensive, could impact registration/login performance under high load
- **Mitigation:** Cost factor 10 is balanced for security/performance. Can tune down if needed. Registration/login are infrequent operations compared to authenticated API calls.

**Risk: Event System Reliability**
- EventEmitter2 is in-memory, events lost if application crashes between emit and handler
- **Mitigation:** For User module, event loss is acceptable (user still registered, subscription creation can be retried manually). Future: Consider durable message queue (RabbitMQ, Kafka) for critical events.

**Risk: Prisma Migration Complexity**
- Database migrations can fail, especially with schema changes
- **Mitigation:** Test migrations in development first. Never modify applied migrations. Use `prisma migrate dev` for development, `prisma migrate deploy` for production. Backup database before production migrations.

**Trade-off: Single User Module**
- Combining auth and user management in one module increases module size
- **Benefit:** Logical grouping, easier to understand and test. Can split later if module becomes too large.

**Trade-off: No Email Verification**
- Users can register with any email without verification
- **Benefit:** Simpler implementation, faster user onboarding. Explicitly out of scope per AGENTS.md. Can add later if needed.

## Open Questions

(none - design is complete and ready for implementation)
