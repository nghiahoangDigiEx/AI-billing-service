## 1. Project Setup and Dependencies

- [x] 1.1 Install required dependencies: @nestjs/config, @nestjs/passport, @nestjs/jwt, passport, passport-jwt, passport-google-oauth20, @prisma/client, prisma, bcrypt, class-validator, class-transformer, @nestjs/swagger, eventemitter2
- [x] 1.2 Install dev dependencies: @types/passport-jwt, @types/passport-google-oauth20, @types/bcrypt
- [x] 1.3 Create .env.example file with all required environment variables (DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, PORT)
- [x] 1.4 Create .env file with development values
- [x] 1.5 Configure ConfigModule in app.module.ts to load environment variables globally
- [x] 1.6 Update main.ts to enable global ValidationPipe with whitelist and forbidNonWhitelisted options
- [x] 1.7 Add Swagger/OpenAPI setup in main.ts with document builder and setup endpoint at /api/docs

## 2. Database Schema and Prisma Setup

- [x] 2.1 Initialize Prisma with PostgreSQL provider: run npx prisma init
- [x] 2.2 Define User model in prisma/schema.prisma with fields: id (uuid), email (unique), password (optional), name (optional), avatar (optional), role (enum USER/ADMIN, default USER), provider (enum LOCAL/GOOGLE, default LOCAL), providerId (optional), createdAt, updatedAt
- [x] 2.3 Define RefreshToken model in prisma/schema.prisma with fields: id (uuid), userId (relation to User with cascade delete), token (unique), expiresAt, createdAt, and index on userId
- [x] 2.4 Define Role enum (USER, ADMIN) and Provider enum (LOCAL, GOOGLE) in schema.prisma
- [x] 2.5 Generate Prisma client: run npx prisma generate
- [x] 2.6 Create initial migration: run npx prisma migrate dev --name init_user_schema
- [x] 2.7 Create PrismaService class in src/prisma/prisma.service.ts extending PrismaClient with onModuleInit and enableShutdownHooks
- [x] 2.8 Create PrismaModule in src/prisma/prisma.module.ts exporting PrismaService as global module

## 3. Event System Infrastructure

- [x] 3.1 Create src/events/event.constants.ts with USER_REGISTERED constant
- [x] 3.2 Create src/events/user.events.ts with UserRegisteredEvent interface (userId, email)
- [x] 3.3 Configure EventEmitterModule in app.module.ts with wildcard: false and global: true

## 4. Exception Handling Infrastructure

- [x] 4.1 Create src/common/exceptions/user-already-exists.exception.ts extending ConflictException with message "User with this email already exists"
- [x] 4.2 Create src/common/exceptions/invalid-credentials.exception.ts extending UnauthorizedException with message "Invalid email or password"
- [x] 4.3 Create src/common/exceptions/invalid-refresh-token.exception.ts extending UnauthorizedException with message "Invalid or expired refresh token"
- [x] 4.4 Create src/common/exceptions/user-not-found.exception.ts extending NotFoundException with message "User not found"
- [x] 4.5 Create src/common/filters/http-exception.filter.ts implementing global exception filter to format error responses consistently
- [x] 4.6 Register HttpExceptionFilter globally in app.module.ts using APP_FILTER provider

## 5. DTOs and Validation

- [x] 5.1 Create src/modules/user/dto/register.dto.ts with email (@IsEmail), password (@IsString, @MinLength(8)), and optional name (@IsString, @IsOptional)
- [x] 5.2 Create src/modules/user/dto/login.dto.ts with email (@IsEmail) and password (@IsString)
- [x] 5.3 Create src/modules/user/dto/refresh.dto.ts with refreshToken (@IsString, @IsNotEmpty)
- [x] 5.4 Create src/modules/user/dto/update-profile.dto.ts with optional name (@IsString, @IsOptional) and optional avatar (@IsString, @IsOptional)
- [x] 5.5 Create src/modules/user/dto/update-role.dto.ts with role (@IsEnum(Role))
- [x] 5.6 Create src/modules/user/dto/auth-response.dto.ts with accessToken and refreshToken fields
- [x] 5.7 Create src/modules/user/dto/user-response.dto.ts with id, email, name, avatar, role, provider, createdAt, updatedAt (excluding password and providerId)
- [x] 5.8 Add @ApiProperty decorators to all DTOs for Swagger documentation

## 6. Guards and Decorators

- [x] 6.1 Create src/modules/user/decorators/roles.decorator.ts using SetMetadata to store required roles
- [x] 6.2 Create src/modules/user/decorators/public.decorator.ts using SetMetadata with IS_PUBLIC_KEY
- [x] 6.3 Create src/modules/user/decorators/current-user.decorator.ts using createParamDecorator to extract user from request
- [x] 6.4 Create src/modules/user/guards/jwt-auth.guard.ts extending AuthGuard('jwt') with canActivate method checking IS_PUBLIC_KEY metadata
- [x] 6.5 Create src/modules/user/guards/roles.guard.ts implementing CanActivate with canActivate method checking user role against required roles from @Roles decorator
- [x] 6.6 Register JwtAuthGuard globally in app.module.ts using APP_GUARD provider

## 7. JWT Strategy Implementation

- [x] 7.1 Create src/modules/user/strategies/jwt.strategy.ts extending PassportStrategy(Strategy) with constructor injecting ConfigService to get JWT_SECRET
- [x] 7.2 Implement validate method in JwtStrategy to extract userId, email, and role from payload and return user object
- [x] 7.3 Configure JwtModule in user.module.ts with secret from ConfigService and expiresIn from JWT_EXPIRES_IN

## 8. Google OAuth Strategy Implementation

- [x] 8.1 Create src/modules/user/strategies/google.strategy.ts extending PassportStrategy(Strategy, 'google') with constructor injecting ConfigService for GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
- [x] 8.2 Configure Google strategy with scope: ['email', 'profile']
- [x] 8.3 Implement validate method in GoogleStrategy to extract profile data (id, email, name, avatar) and return user data
- [x] 8.4 Inject UserService into GoogleStrategy for user lookup/creation logic

## 9. User Service Implementation

- [x] 9.1 Create src/modules/user/user.service.ts with constructor injecting PrismaService, JwtService, ConfigService, and EventEmitter2
- [x] 9.2 Implement register method: validate email uniqueness, hash password with bcrypt (salt rounds 10), create user in database, emit user.registered event, return user response (excluding password)
- [x] 9.3 Implement login method: find user by email, validate password with bcrypt.compare, generate access and refresh tokens, store refresh token in database with 7-day expiration, return tokens
- [x] 9.4 Implement refreshToken method: validate refresh token exists and not expired, find associated user, generate new access and refresh tokens, delete old refresh token, store new refresh token, return new tokens
- [x] 9.5 Implement validateOAuthUser method: find user by providerId or email, create new user if not found (with provider: GOOGLE, providerId, email, name, avatar, password: null), update existing user with latest Google profile data, generate and return tokens
- [x] 9.6 Implement getProfile method: find user by id, return user response excluding password and providerId
- [x] 9.7 Implement updateProfile method: find user by id, update name and/or avatar fields, return updated user response
- [x] 9.8 Implement findAll method: return paginated list of all users excluding password and providerId fields
- [x] 9.9 Implement updateRole method: find user by id (throw UserNotFoundException if not found), update role field, return updated user response
- [x] 9.10 Implement generateAccessToken helper method: sign JWT with userId, email, role payload using JWT_SECRET and JWT_EXPIRES_IN
- [x] 9.11 Implement generateRefreshToken helper method: generate random UUID, store in RefreshToken table with userId and 7-day expiration, return token string
- [x] 9.12 Implement excludePasswordFromUser helper method: destructure password and providerId from user object, return rest of fields

## 10. Authentication Controller

- [x] 10.1 Create src/modules/user/auth.controller.ts with @Controller('auth') decorator
- [x] 10.2 Inject UserService into AuthController constructor
- [x] 10.3 Implement POST /auth/register endpoint with @Public() decorator, @Body() RegisterDto, calling userService.register, returning user response
- [x] 10.4 Implement POST /auth/login endpoint with @Public() decorator, @Body() LoginDto, calling userService.login, returning auth response with tokens
- [x] 10.5 Implement POST /auth/refresh endpoint with @Public() decorator, @Body() RefreshDto, calling userService.refreshToken, returning new tokens
- [x] 10.6 Implement GET /auth/google endpoint with @Public() decorator, @UseGuards(AuthGuard('google')) to initiate OAuth flow
- [x] 10.7 Implement GET /auth/google/callback endpoint with @Public() decorator, @UseGuards(AuthGuard('google')), @Req() to get user from request, call userService.validateOAuthUser, redirect to application with tokens
- [x] 10.8 Add @ApiTags('auth') and @ApiOperation decorators to all endpoints for Swagger documentation
- [x] 10.9 Add @ApiResponse decorators documenting success and error responses for all endpoints

## 11. Users Controller

- [x] 11.1 Create src/modules/user/users.controller.ts with @Controller('users') decorator
- [x] 11.2 Inject UserService into UsersController constructor
- [x] 11.3 Implement GET /users/me endpoint with @UseGuards(JwtAuthGuard), @CurrentUser() decorator, calling userService.getProfile, returning user response
- [x] 11.4 Implement PATCH /users/me endpoint with @UseGuards(JwtAuthGuard), @CurrentUser() decorator, @Body() UpdateProfileDto, calling userService.updateProfile, returning updated user response
- [x] 11.5 Implement GET /users endpoint with @UseGuards(JwtAuthGuard, RolesGuard), @Roles(Role.ADMIN) decorator, calling userService.findAll, returning paginated user list
- [x] 11.6 Implement PATCH /users/:id/role endpoint with @UseGuards(JwtAuthGuard, RolesGuard), @Roles(Role.ADMIN) decorator, @Param('id') and @Body() UpdateRoleDto, calling userService.updateRole, returning updated user response
- [x] 11.7 Add @ApiTags('users') and @ApiOperation decorators to all endpoints for Swagger documentation
- [x] 11.8 Add @ApiResponse decorators documenting success and error responses for all endpoints

## 12. User Module Configuration

- [x] 12.1 Create src/modules/user/user.module.ts with @Module decorator
- [x] 12.2 Import PassportModule, JwtModule (async configuration with ConfigService), PrismaModule, and EventEmitterModule
- [x] 12.3 Register AuthController and UsersController in controllers array
- [x] 12.4 Register UserService, JwtStrategy, and GoogleStrategy in providers array
- [x] 12.5 Export UserService from UserModule for use by other modules
- [x] 12.6 Import UserModule in app.module.ts

## 13. Database Seed Script

- [x] 13.1 Create prisma/seed.ts script to seed initial data
- [x] 13.2 Seed default Free and Pro plans in Plan table (for future Billing module)
- [x] 13.3 Seed default admin user with email admin@example.com, password admin123 (hashed), role ADMIN
- [x] 13.4 Add "seed": "ts-node prisma/seed.ts" script to package.json
- [x] 13.5 Add prisma.seed configuration to package.json

## 14. Unit Testing - User Service

- [x] 14.1 Create src/modules/user/user.service.spec.ts with Test.createTestingModule setup
- [x] 14.2 Mock PrismaService with jest.fn() for all methods used by UserService
- [x] 14.3 Mock JwtService with jest.fn() for signAsync method
- [x] 14.4 Mock EventEmitter2 with jest.fn() for emit method
- [x] 14.5 Write test: register method creates user with hashed password and emits user.registered event
- [x] 14.6 Write test: register method throws UserAlreadyExistsException when email exists
- [x] 14.7 Write test: login method validates credentials and returns tokens
- [x] 14.8 Write test: login method throws InvalidCredentialsException for wrong password
- [x] 14.9 Write test: login method throws InvalidCredentialsException for OAuth user (no password)
- [x] 14.10 Write test: refreshToken method validates token and returns new tokens
- [x] 14.11 Write test: refreshToken method throws InvalidRefreshTokenException for expired token
- [x] 14.12 Write test: refreshToken method throws InvalidRefreshTokenException for non-existent token
- [x] 14.13 Write test: validateOAuthUser creates new user for first-time OAuth login
- [x] 14.14 Write test: validateOAuthUser updates existing user on subsequent OAuth login
- [x] 14.15 Write test: getProfile returns user data excluding password and providerId
- [x] 14.16 Write test: updateProfile updates name and avatar fields
- [x] 14.17 Write test: findAll returns paginated user list for admin
- [x] 14.18 Write test: updateRole updates user role and returns updated user
- [x] 14.19 Write test: updateRole throws UserNotFoundException for non-existent user

## 15. Unit Testing - Guards and Strategies

- [x] 15.1 Create src/modules/user/guards/jwt-auth.guard.spec.ts with test setup
- [x] 15.2 Write test: canActivate returns true for valid JWT token
- [x] 15.3 Write test: canActivate returns true for public endpoints (IS_PUBLIC_KEY metadata)
- [x] 15.4 Write test: canActivate throws UnauthorizedException for missing token
- [x] 15.5 Create src/modules/user/guards/roles.guard.spec.ts with test setup
- [x] 15.6 Write test: canActivate returns true when user role matches required role
- [x] 15.7 Write test: canActivate throws ForbiddenException when user role doesn't match
- [x] 15.8 Write test: canActivate returns true when no @Roles decorator is present
- [x] 15.9 Create src/modules/user/strategies/jwt.strategy.spec.ts with test setup
- [x] 15.10 Write test: validate method extracts and returns user data from payload

## 16. Integration Testing - Authentication Flows

- [x] 16.1 Create test/auth.e2e-spec.ts with Test.createTestingModule setup using real database connection
- [x] 16.2 Setup test database with schema push before tests, cleanup after tests
- [x] 16.3 Write test: POST /auth/register creates new user and returns user data
- [x] 16.4 Write test: POST /auth/register rejects duplicate email with 409 status
- [x] 16.5 Write test: POST /auth/register validates email format and password length
- [x] 16.6 Write test: POST /auth/login with valid credentials returns tokens
- [x] 16.7 Write test: POST /auth/login with invalid credentials returns 401 status
- [x] 16.8 Write test: POST /auth/refresh with valid refresh token returns new tokens
- [x] 16.9 Write test: POST /auth/refresh with expired token returns 401 status
- [x] 16.10 Write test: Protected endpoint with valid JWT returns 200 status
- [x] 16.11 Write test: Protected endpoint without JWT returns 401 status
- [x] 16.12 Write test: Admin-only endpoint with ADMIN role returns 200 status
- [x] 16.13 Write test: Admin-only endpoint with USER role returns 403 status

## 17. Integration Testing - User Profile and Management

- [x] 17.1 Write test: GET /users/me returns current user profile
- [x] 17.2 Write test: PATCH /users/me updates user profile and returns updated data
- [x] 17.3 Write test: PATCH /users/me ignores restricted fields (email, password, role)
- [x] 17.4 Write test: GET /users with ADMIN role returns paginated user list
- [x] 17.5 Write test: GET /users with USER role returns 403 status
- [x] 17.6 Write test: PATCH /users/:id/role with ADMIN role updates user role
- [x] 17.7 Write test: PATCH /users/:id/role with non-existent user returns 404 status
- [x] 17.8 Write test: PATCH /users/:id/role with USER role returns 403 status

## 18. Documentation and Verification

- [x] 18.1 Update README.md with setup instructions, environment variables, and available endpoints
- [x] 18.2 Add API documentation section with Swagger endpoint URL and authentication flow
- [x] 18.3 Run `npm run lint` and fix any issues
- [x] 18.4 Run `npm run typecheck` and fix any issues
- [x] 18.5 Run `npm run test` and ensure all unit tests pass
- [x] 18.6 Run `npm run test:e2e` and ensure all integration tests pass
- [x] 18.7 Verify Prisma migrations are successfully applied
- [x] 18.8 Verify database seed script runs without errors
- [x] 18.9 Start the application with `npm run start:dev` to verify it boots
- [x] 18.10 Check off completed tasks in tasks.md
