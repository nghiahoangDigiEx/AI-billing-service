## Context

The billing-service is a fresh NestJS scaffold with default boilerplate (app.controller, app.service, app.module). No database, no environment configuration, no shared utilities, no module structure.

**Current State:**
- Basic NestJS application with TypeScript
- Default scaffold files (app.controller.ts, app.service.ts, app.module.ts, main.ts)
- No dependencies beyond core NestJS packages
- No database integration
- No environment variable management
- No shared infrastructure

**Constraints:**
- Must follow AGENTS.md architecture: event-driven modular monolith
- Must integrate with Neon PostgreSQL
- All secrets via environment variables, never hardcoded
- Must support future modules (User, Billing, Credit)
- Must establish patterns that downstream features will follow

## Goals / Non-Goals

**Goals:**
- Integrate Prisma ORM with PostgreSQL (Neon)
- Configure environment variables via ConfigModule
- Establish shared infrastructure: PrismaService, global exception filter, event constants
- Create module directory structure (common, events, modules, prisma)
- Add core dependencies (config, validation, swagger, prisma, eventemitter2)
- Configure global validation pipe in main.ts
- Set up .env template with required environment variables
- Remove default NestJS scaffold files

**Non-Goals:**
- Implementing any business logic (no controllers, services, or DTOs)
- Creating database schema models (User, Subscription, etc. come later)
- Implementing authentication or authorization
- Setting up Stripe integration
- Creating test infrastructure (covered by individual feature changes)

## Decisions

### 1. Prisma Integration: Global PrismaService

**Decision:** Create a global PrismaService that wraps PrismaClient and is available application-wide via PrismaModule.

**Rationale:**
- Single source of database access across all modules
- Global availability eliminates need to import PrismaModule in every feature module
- Follows NestJS best practices for shared services
- Aligns with AGENTS.md: "PrismaService provided globally via PrismaModule"

**Implementation:**
- `src/prisma/prisma.service.ts`: Extends PrismaClient, implements OnModuleInit for connection
- `src/prisma/prisma.module.ts`: Global module that exports PrismaService
- Import PrismaModule in AppModule only (global: true makes it available everywhere)

**Alternative Considered:**
- Per-module PrismaService instances
  - Rejected: Redundant, harder to manage connections, violates single responsibility

### 2. Environment Configuration: ConfigModule with Global Validation

**Decision:** Use @nestjs/config with ConfigModule.forRoot() and global validation.

**Rationale:**
- Centralized configuration management
- Type-safe access to environment variables
- Validation ensures required variables are present at startup
- Global availability eliminates need to import in every module

**Implementation:**
- Import ConfigModule.forRoot() in AppModule with isGlobal: true
- Create .env file with template variables
- Create .env.example as documentation
- Use ConfigService to access variables throughout the application

**Environment Variables:**
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=...
REFRESH_TOKEN_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
PORT=3000
```

**Alternative Considered:**
- Manual process.env access
  - Rejected: No validation, scattered access, harder to test

### 3. Directory Structure: Feature-Based with Shared Infrastructure

**Decision:** Organize source code into common, events, modules, and prisma directories.

**Rationale:**
- Clear separation of concerns
- Shared infrastructure isolated from feature-specific code
- Scales well as modules are added
- Aligns with AGENTS.md conventions

**Structure:**
```
src/
├── common/
│   ├── filters/
│   │   └── global-exception.filter.ts
│   ├── decorators/
│   │   └── index.ts
│   ├── guards/
│   │   └── index.ts
│   ├── enums/
│   │   ├── error-code.enum.ts
│   │   └── index.ts
│   └── interfaces/
│       ├── api-response.interface.ts
│       └── index.ts
├── events/
│   └── event.constants.ts
├── modules/
│   └── (future: user/, billing/, credit/)
├── prisma/
│   ├── prisma.service.ts
│   └── prisma.module.ts
└── main.ts
```

**Alternative Considered:**
- Flat structure with all files in src/
  - Rejected: Doesn't scale, hard to find files as project grows

### 4. Global Exception Filter: Centralized Error Handling

**Decision:** Create a global exception filter that catches all exceptions and formats responses consistently.

**Rationale:**
- Consistent error response format across all endpoints
- Sanitizes internal errors (no stack traces exposed)
- Centralized error handling logic
- Aligns with AGENTS.md: "Global ExceptionFilter translates exceptions to HTTP responses"

**Implementation:**
- `src/common/filters/global-exception.filter.ts`: Implements ExceptionFilter
- Apply globally in main.ts via app.useGlobalFilters()
- Format: `{ statusCode, message, error }`

**Alternative Considered:**
- Per-controller exception handling
  - Rejected: Duplication, inconsistent responses, harder to maintain

### 5. Event System Foundation: EventEmitter2 with Typed Constants

**Decision:** Use EventEmitter2 with typed event constants defined in src/events/event.constants.ts.

**Rationale:**
- Lightweight, built-in NestJS support
- Enables loose coupling between modules
- Typed constants prevent typos and enable IDE autocomplete
- Aligns with AGENTS.md: "Event-driven cross-module communication"

**Implementation:**
- Install eventemitter2 package
- Import EventEmitterModule.forRoot() in AppModule
- Define event constants in src/events/event.constants.ts
- Future modules will emit events using these constants

**Event Constants:**
```typescript
export const USER_REGISTERED = 'user.registered';
export const USER_UPDATED = 'user.updated';
// Future events added as needed
```

**Alternative Considered:**
- String literals for events
  - Rejected: No type safety, easy to introduce typos, harder to refactor

### 6. Global Validation Pipe: class-validator with Strict Mode

**Decision:** Configure global ValidationPipe in main.ts with whitelist and forbidNonWhitelisted enabled.

**Rationale:**
- Automatic validation for all DTOs
- Strips unknown properties (whitelist)
- Rejects requests with unknown properties (forbidNonWhitelisted)
- Consistent validation behavior across all endpoints
- Aligns with AGENTS.md: "Global ValidationPipe applied in main.ts"

**Implementation:**
- Apply in main.ts: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`
- Enable transform for automatic type conversion
- Validation errors return 400 Bad Request with detailed messages

**Alternative Considered:**
- Per-controller validation
  - Rejected: Duplication, inconsistent validation, easy to forget

### 7. Swagger Documentation: @nestjs/swagger with Global Setup

**Decision:** Integrate @nestjs/swagger with global setup in main.ts.

**Rationale:**
- Automatic API documentation generation
- Interactive Swagger UI for testing
- Documents request/response schemas from DTOs
- Essential for API development and consumption

**Implementation:**
- Install @nestjs/swagger
- Configure in main.ts with SwaggerModule.createDocument()
- Set title, description, version
- Enable at /api endpoint

**Alternative Considered:**
- Manual API documentation
  - Rejected: Hard to maintain, gets out of sync with code

### 8. Remove Default Scaffold: Clean Slate

**Decision:** Remove app.controller.ts, app.service.ts, and update app.module.ts to remove their imports.

**Rationale:**
- Default scaffold is not needed for billing service
- Clean slate prevents confusion
- Establishes pattern: only necessary code exists
- Aligns with AGENTS.md: no "hello world" code

**Implementation:**
- Delete src/app.controller.ts
- Delete src/app.controller.spec.ts
- Delete src/app.service.ts
- Update src/app.module.ts to remove imports
- Keep src/app.module.ts as root module for global imports

**Alternative Considered:**
- Keep scaffold as example
  - Rejected: Unnecessary code, confusing for new developers

### 9. Standard API Response: Typed Response Interface

**Decision:** Create a standard ApiResponse interface and ErrorCode enum in src/common/ for consistent response formatting.

**Rationale:**
- Consistent response structure across all endpoints
- Type-safe error codes prevent typos
- Enables standardized client-side error handling
- Aligns with AGENTS.md: "Standardized error response format"

**Implementation:**
- `src/common/interfaces/api-response.interface.ts`: Define ApiResponse<T> interface
- `src/common/enums/error-code.enum.ts`: Define ErrorCode enum with common error types
- Update GlobalExceptionFilter to use ErrorCode in error responses
- Future services can use ApiResponse for consistent return types

**Alternative Considered:**
- Inline response objects
  - Rejected: No type safety, inconsistent responses, harder to maintain

## Risks / Trade-offs

**Risk: Prisma Migration Failures**
- Database migrations can fail, especially with schema changes
- **Mitigation:** Test migrations in development first. Never modify applied migrations. Use `prisma migrate dev` for development, `prisma migrate deploy` for production. Backup database before production migrations.

**Risk: Environment Variable Exposure**
- .env file contains secrets that could be committed to git
- **Mitigation:** Add .env to .gitignore. Provide .env.example with placeholder values. Document required variables in README.

**Risk: Global Module Overuse**
- Global modules can lead to tight coupling if overused
- **Mitigation:** Only PrismaModule and ConfigModule are global. Feature modules remain isolated and import dependencies explicitly.

**Risk: Exception Filter Hides Errors**
- Global exception filter might hide important error details during development
- **Mitigation:** Log full error details server-side. Only sanitize client-facing responses. Use different error handling in development vs production if needed.

**Trade-off: Empty Event Constants**
- Event constants file will be empty initially (no events emitted yet)
- **Benefit:** Establishes pattern early. Future modules can add events without restructuring.

**Trade-off: No Database Schema Yet**
- Prisma is integrated but no models are defined
- **Benefit:** Foundation is ready. User module can add models without setting up Prisma from scratch.

## Migration Plan

**Deployment Steps:**
1. Install dependencies: `npm install`
2. Create .env file from .env.example
3. Set DATABASE_URL to Neon PostgreSQL connection string
4. Run `npx prisma generate` to generate Prisma client
5. Run `npx prisma migrate dev --name init` to create initial migration
6. Run `npm run start:dev` to verify application starts

**Rollback Strategy:**
- Remove new directories (common, events, modules, prisma)
- Restore app.controller.ts, app.service.ts, app.module.ts from git
- Run `npm install` to remove new dependencies
- No database changes to rollback (no schema yet)

## Open Questions

(none - design is complete and ready for implementation)
