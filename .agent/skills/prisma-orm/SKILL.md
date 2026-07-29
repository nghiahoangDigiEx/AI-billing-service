---
name: prisma-orm
description: Use when defining database schemas, creating migrations, querying data, or working with Prisma client
---

# Prisma ORM

## Purpose

Covers Prisma ORM usage for PostgreSQL database access, schema management, migrations, and type-safe queries in a multi-module architecture.

## Why This Technology

**Confirmed Decision:** Prisma provides type-safe database access, prevents SQL injection, manages migrations, and generates TypeScript types from schema definitions. It enforces the repository pattern and supports atomic transactions required for credit mutations.

## Confirmed Decisions

### Schema Location
- **Single schema file**: `prisma/schema.prisma` for all modules
- **Generated types**: `src/modules/{module}/entities/` (Prisma-generated)
- **Migrations**: `prisma/migrations/` directory

### Database Access Pattern
- **PrismaService** provided globally via PrismaModule
- Services inject PrismaService for database operations
- **No raw SQL** — all queries through Prisma client
- **Module ownership**: Each module owns its tables exclusively
- **No cross-module writes**: Modules may read other modules' tables but never write

### Migration Workflow
1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name {descriptive_name}`
3. Review generated SQL in `prisma/migrations/`
4. Commit migration files
5. Deploy with `npx prisma migrate deploy`

### Atomic Transactions
- Credit mutations require atomic balance updates and transaction records
- Use Prisma's `$transaction()` for multi-step operations
- Balance must equal sum of all transactions

## Recommended Conventions

### Schema Definition
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("users")
}
```

### Service Query Pattern
```typescript
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { subscriptions: true }
    });
  }

  async createTransaction(data: CreateCreditDto) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.creditTransaction.create({
        data: { amount: data.amount, userId: data.userId }
      });
      
      await tx.creditBalance.update({
        where: { userId: data.userId },
        data: { balance: { increment: data.amount } }
      });
      
      return transaction;
    });
  }
}
```

### Migration Naming
- Use descriptive snake_case: `add_user_email_index`, `create_subscriptions_table`
- Never modify applied migrations
- Test migrations in development before production

## Integration Boundaries

### Module Ownership
- **User Module**: users, user_roles tables
- **Billing Module**: subscriptions, plans, payment_methods, webhook_events tables
- **Credit Module**: credit_balances, credit_transactions tables

### Cross-Module Reads
```typescript
// Billing Module reading User Module's table (allowed)
async getSubscriptionWithUser(subscriptionId: string) {
  return this.prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: true }  // Read-only access
  });
}
```

### Cross-Module Writes (Forbidden)
```typescript
// ❌ WRONG: Billing Module writing to User Module's table
await this.prisma.user.update({ ... });

// ✅ CORRECT: Emit event for User Module to handle
this.eventEmitter.emit('subscription.created', { userId, subscriptionId });
```

## Things AI Should Avoid

- Using `prisma db push` in production (use migrations only)
- Modifying already-applied migration files
- Writing raw SQL queries
- Direct cross-module database writes
- Forgetting to run `npx prisma generate` after schema changes
- Creating duplicate indexes or constraints
- Not testing migrations in development first
- Resetting production databases (`prisma migrate reset`)

## Verification

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate diff
npm run test
```
