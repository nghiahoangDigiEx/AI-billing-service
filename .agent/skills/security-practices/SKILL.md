---
name: security-practices
description: Use when implementing authentication, handling sensitive data, securing API endpoints, or configuring environment variables
---

# Security Practices

## Purpose

Covers security requirements including credential management, input validation, error handling, rate limiting, and secure coding practices for a billing service.

## Why This Technology

**Confirmed Decision:** Security is critical for a billing service handling payments, subscriptions, and user data. The architecture enforces security through environment-based configuration, input validation, signature verification, and role-based access control.

## Confirmed Decisions

### Credential Management
- **All credentials via environment variables**: No Stripe keys, JWT secrets, OAuth credentials, or database URLs in source code
- **ConfigModule**: Centralized configuration access via NestJS ConfigModule
- **Never log secrets**: No tokens, keys, or credentials in logs
- **Never hardcode**: All sensitive values from `.env` file

### Input Validation
- **Global ValidationPipe**: All external input validated with class-validator
- **Sanitize error messages**: Never expose internal details to clients
- **Standardized error responses**: Global ExceptionFilter translates exceptions to HTTP responses

### Authentication Security
- **Password hashing**: bcrypt before storage
- **JWT tokens**: Secure token-based authentication
- **Rate limiting**: Authentication endpoints rate limited
- **Role-based access**: Guards enforce least privilege on all endpoints

### Payment Security
- **Webhook signature verification**: Verify Stripe webhook signatures before processing
- **3D Secure delegation**: Payment method validation delegated to Stripe
- **Idempotent processing**: No duplicate webhook event processing

### Database Security
- **SQL injection prevention**: Prisma ORM prevents raw SQL injection
- **No raw SQL**: All queries through Prisma client
- **HTTPS in production**: Enforced at infrastructure level

## Recommended Conventions

### Environment Configuration
```typescript
// .env (never commit)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

// config/configuration.ts
export default () => ({
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
});
```

### ConfigModule Setup
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
})
export class AppModule {}
```

### Using ConfigService
```typescript
@Injectable()
export class StripeAdapter {
  constructor(private readonly config: ConfigService) {}

  private get stripe() {
    return new Stripe(this.config.get('stripe.secretKey'));
  }
}
```

### Password Hashing
```typescript
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  async create(email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { email, password: hashedPassword }
    });
  }

  async validatePassword(plainPassword: string, hashedPassword: string) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
```

### Webhook Signature Verification
```typescript
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly stripe: Stripe
  ) {}

  @Post('stripe')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() payload: Buffer
  ) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.get('stripe.webhookSecret')
      );
      // Process event
    } catch (err) {
      throw new BadRequestException('Invalid signature');
    }
  }
}
```

### Rate Limiting
```typescript
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  @Post('login')
  @Throttle(5, 60) // 5 requests per 60 seconds
  async login(@Body() loginDto: LoginDto) { ... }
}
```

### Error Handling
```typescript
// Global ExceptionFilter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    // Never expose internal details
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : 500;
    
    response.status(status).json({
      statusCode: status,
      message: 'An error occurred', // Generic message
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Integration Boundaries

### Configuration Access
```typescript
// ✅ CORRECT: Use ConfigService
constructor(private readonly config: ConfigService) {}
const secret = this.config.get('jwt.secret');

// ❌ WRONG: Direct process.env access
const secret = process.env.JWT_SECRET;

// ❌ WRONG: Hardcoded values
const secret = 'my-secret-key';
```

### Logging Practices
```typescript
// ✅ CORRECT: Log without sensitive data
this.logger.log(`User ${userId} logged in`);
this.logger.log(`Payment processed for subscription ${subscriptionId}`);

// ❌ WRONG: Logging sensitive data
this.logger.log(`User logged in with token: ${token}`);
this.logger.log(`Stripe key: ${stripeKey}`);
this.logger.log(`Password: ${password}`);
```

### Error Messages
```typescript
// ✅ CORRECT: Generic error messages
throw new UnauthorizedException('Invalid credentials');
throw new BadRequestException('Invalid request');

// ❌ WRONG: Exposing internal details
throw new UnauthorizedException(`Password hash mismatch: ${hash}`);
throw new BadRequestException(`Database error: ${err.message}`);
```

## Things AI Should Avoid

- Hardcoding secrets, keys, or credentials in source code
- Logging sensitive information (tokens, passwords, keys)
- Exposing stack traces or internal error details to clients
- Using plain-text passwords
- Skipping webhook signature verification
- Using raw SQL queries (SQL injection risk)
- Forgetting rate limiting on auth endpoints
- Committing `.env` files to version control
- Using weak JWT secrets
- Not validating all external input

## Verification

```bash
npm run lint
npm run test
npm run test:e2e
# Check for hardcoded secrets: grep -r "sk_test" src/
# Check for console.log: grep -r "console.log" src/
```
