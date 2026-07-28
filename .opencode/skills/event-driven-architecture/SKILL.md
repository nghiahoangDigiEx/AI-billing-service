---
name: event-driven-architecture
description: Use when implementing cross-module communication, emitting events, handling event listeners, or designing decoupled module interactions
---

# Event-Driven Architecture

## Purpose

Covers EventEmitter2 usage for cross-module communication, event-driven design patterns, and maintaining module boundaries without direct service dependencies.

## Why This Technology

**Confirmed Decision:** EventEmitter2 provides a lightweight, in-process event bus for cross-module communication. Modules emit events rather than calling each other's services directly, maintaining loose coupling and clear module boundaries.

## Confirmed Decisions

### Communication Pattern
- **Event-driven cross-module communication**: Modules never call each other's services directly
- **EventEmitter2**: Internal event bus for all cross-module interactions
- **Event type definitions**: Centralized in `src/events/` directory
- **Event naming**: Past tense (e.g., `user.registered`, `subscription.created`)

### Module Boundaries
- **No cross-module database writes**: Each module owns its tables exclusively
- **Modules may read** other modules' tables but never write
- **Owning module is sole writer**: Only the module that owns a table can modify it

### Idempotency
- **Idempotent event handlers**: Event processing must handle duplicate delivery
- **Webhook processing**: No Stripe event processed more than once
- **WebhookEvent table**: Enforces unique `stripeEventId` constraint

## Recommended Conventions

### Event Type Definitions
```typescript
// src/events/user.events.ts
export interface UserRegisteredEvent {
  userId: string;
  email: string;
  registeredAt: Date;
}

export interface UserUpdatedEvent {
  userId: string;
  changes: Partial<User>;
}

export const USER_EVENTS = {
  REGISTERED: 'user.registered',
  UPDATED: 'user.updated',
} as const;
```

### Emitting Events
```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async register(email: string, password: string) {
    const user = await this.prisma.user.create({
      data: { email, password: await bcrypt.hash(password, 10) }
    });

    this.eventEmitter.emit(USER_EVENTS.REGISTERED, {
      userId: user.id,
      email: user.email,
      registeredAt: user.createdAt
    });

    return user;
  }
}
```

### Event Listeners
```typescript
@Injectable()
export class BillingEventListener {
  constructor(private readonly prisma: PrismaService) {}

  @On(USER_EVENTS.REGISTERED)
  async handleUserRegistered(event: UserRegisteredEvent) {
    await this.prisma.creditBalance.create({
      data: {
        userId: event.userId,
        balance: 0
      }
    });
  }
}
```

### Event Naming Convention
```typescript
// ✅ CORRECT: Past tense, descriptive
'user.registered'
'subscription.created'
'subscription.cancelled'
'payment.failed'
'credit.consumed'

// ❌ WRONG: Present tense, vague
'user.register'
'newSubscription'
'payment'
```

## Integration Boundaries

### Cross-Module Communication
```typescript
// User Module emits event
this.eventEmitter.emit('user.registered', { userId, email });

// Billing Module listens (in separate module)
@On('user.registered')
async handleUserRegistered(event: UserRegisteredEvent) {
  // Create initial subscription or credit balance
}

// Credit Module listens (in separate module)
@On('user.registered')
async initializeCreditBalance(event: UserRegisteredEvent) {
  // Create credit balance record
}
```

### Module Independence
- User Module knows nothing about Billing or Credit modules
- Billing Module listens to User events but doesn't call User services
- Credit Module listens to User and Billing events but doesn't call their services

## Things AI Should Avoid

- Direct service-to-service calls across modules
- Creating circular event dependencies
- Emitting events without proper error handling
- Forgetting to make event handlers idempotent
- Using synchronous event handlers for long-running operations
- Hardcoding event names (use constants)
- Emitting events before database transaction commits
- Not logging event emissions for debugging

## Verification

```bash
npm run test
npm run test:e2e
```
