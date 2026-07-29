---
name: passport-auth
description: Use when implementing authentication, authorization guards, JWT strategies, OAuth flows, or role-based access control
---

# Passport Authentication

## Purpose

Covers Passport.js usage for JWT and OAuth authentication strategies, guards for route protection, and role-based access control within the User Module.

## Why This Technology

**Confirmed Decision:** Passport.js provides a pluggable authentication middleware system supporting both JWT (for API authentication) and OAuth (for Google sign-in). It integrates natively with NestJS guards and is isolated entirely within the User Module.

## Confirmed Decisions

### Strategy Isolation
- All authentication strategies live in the **User Module**
- Google OAuth is isolated in User Module strategies
- JWT strategy used for API route protection
- Other modules consume auth via guards, not by importing strategies directly

### Security Requirements
- Passwords hashed with **bcrypt** before storage
- Rate limiting on authentication endpoints
- Guards enforce role-based access on all endpoints
- All credentials via environment variables (ConfigModule)

### Authorization Model
- Guards enforce role-based access
- Least privilege principle on all endpoints
- Controllers use guards declaratively, never implement auth logic

## Recommended Conventions

### JWT Strategy
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

### Auth Guard
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### Role Guard
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>(
      'roles',
      context.getHandler()
    );
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

### Controller Usage
```typescript
@Controller('users')
export class UsersController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  getAdminData() { ... }
}
```

### OAuth Strategy
```typescript
@Injectable()
export class GoogleStrategy extends PassportStrategy(GoogleOAuthStrategy) {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return { email: profile.emails[0].value, name: profile.displayName };
  }
}
```

## Integration Boundaries

### User Module Owns Auth
- Strategies defined in User Module only
- Guards exported from User Module for other modules to use
- Other modules apply guards but never define strategies

### Cross-Module Guard Usage
```typescript
// Billing Module using User Module's guard (allowed)
@Controller('subscriptions')
export class SubscriptionsController {
  @UseGuards(JwtAuthGuard)
  @Get()
  getSubscriptions() { ... }
}
```

## Things AI Should Avoid

- Implementing auth logic in controllers (use guards)
- Defining strategies outside the User Module
- Hardcoding JWT secrets or OAuth credentials
- Storing plain-text passwords
- Skipping rate limiting on auth endpoints
- Creating custom auth middleware instead of using Passport guards
- Exposing internal error details in auth responses

## Verification

```bash
npm run test
npm run test:e2e
```
