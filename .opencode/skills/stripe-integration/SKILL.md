---
name: stripe-integration
description: Use when implementing payment flows, handling webhooks, managing subscriptions, or integrating with Stripe API
---

# Stripe Integration

## Purpose

Covers Stripe SDK usage for payment processing, subscription management, webhook handling, and the adapter pattern for payment provider extensibility.

## Why This Technology

**Confirmed Decision:** Stripe is the primary payment provider for handling subscriptions, invoicing, and payment methods. The architecture uses an adapter pattern (PaymentProviderAdapter) to isolate Stripe-specific logic and enable future payment provider extensibility.

## Confirmed Decisions

### Architecture Pattern
- **PaymentProviderAdapter interface**: Abstracts payment provider operations
- **WebhookStrategy interface**: Abstracts webhook event parsing
- **StripeAdapter**: Implements PaymentProviderAdapter for Stripe
- **StripeWebhookStrategy**: Implements WebhookStrategy for Stripe
- **PaymentProviderFactory**: Resolves correct adapter based on `subscription.provider`
- **Per-subscription provider selection**: Supports STRIPE, PAYPAL, etc.

### Source of Truth
- **Stripe is authoritative**: Local database mirrors Stripe state
- **On discrepancy**: Stripe wins
- **Webhooks reconcile**: Local state updated via webhook events

### Idempotency
- **WebhookEvent table**: Enforces unique `stripeEventId` constraint
- **No duplicate processing**: Each Stripe event processed exactly once
- **Idempotent handlers**: Webhook and event processing handle duplicate delivery

### Integration Points
- Stripe API isolated via PaymentProviderAdapter
- Business logic never calls Stripe SDK directly
- Webhook signature verification before processing
- All Stripe credentials via environment variables (ConfigModule)

## Recommended Conventions

### Adapter Pattern
```typescript
interface PaymentProviderAdapter {
  createSubscription(customerId: string, priceId: string): Promise<Subscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  updatePaymentMethod(subscriptionId: string, paymentMethodId: string): Promise<void>;
}

@Injectable()
export class StripeAdapter implements PaymentProviderAdapter {
  constructor(private readonly stripe: Stripe) {}

  async createSubscription(customerId: string, priceId: string) {
    return this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }]
    });
  }
}
```

### Webhook Strategy Pattern
```typescript
interface WebhookStrategy {
  parseEvent(payload: Buffer, signature: string): ParsedWebhookEvent;
  extractEventType(event: ParsedWebhookEvent): string;
}

@Injectable()
export class StripeWebhookStrategy implements WebhookStrategy {
  constructor(
    private readonly stripe: Stripe,
    private readonly config: ConfigService
  ) {}

  parseEvent(payload: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.get('STRIPE_WEBHOOK_SECRET')
    );
  }
}
```

### Factory Pattern
```typescript
@Injectable()
export class PaymentProviderFactory {
  constructor(
    private readonly stripeAdapter: StripeAdapter,
    // private readonly paypalAdapter: PaypalAdapter,
  ) {}

  getAdapter(provider: PaymentProvider): PaymentProviderAdapter {
    switch (provider) {
      case PaymentProvider.STRIPE:
        return this.stripeAdapter;
      // case PaymentProvider.PAYPAL:
      //   return this.paypalAdapter;
      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  }
}
```

### Webhook Handler
```typescript
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly webhookStrategy: WebhookStrategy,
    private readonly billingService: BillingService
  ) {}

  @Post('stripe')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() payload: Buffer
  ) {
    const event = this.webhookStrategy.parseEvent(payload, signature);
    
    // Check if already processed (idempotency)
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id }
    });
    
    if (existing) {
      return { received: true };
    }
    
    await this.billingService.processWebhookEvent(event);
    return { received: true };
  }
}
```

## Integration Boundaries

### Business Logic Isolation
```typescript
// ❌ WRONG: Direct Stripe SDK call in service
async createSubscription(userId: string, planId: string) {
  return this.stripe.subscriptions.create({ ... });
}

// ✅ CORRECT: Use adapter
async createSubscription(userId: string, planId: string) {
  const adapter = this.providerFactory.getAdapter(PaymentProvider.STRIPE);
  return adapter.createSubscription(customerId, priceId);
}
```

### Webhook Processing
- Verify signature before processing
- Check idempotency (WebhookEvent table)
- Process event atomically
- Record event in WebhookEvent table
- Emit domain events for cross-module communication

## Things AI Should Avoid

- Calling Stripe SDK directly in business logic
- Skipping webhook signature verification
- Processing webhook events without idempotency checks
- Hardcoding Stripe keys or webhook secrets
- Assuming local database state matches Stripe (always reconcile)
- Creating multiple subscriptions per user (one active subscription rule)
- Not handling Stripe API errors gracefully
- Forgetting to test with Stripe CLI in development

## Verification

```bash
npm run test
npm run test:e2e
stripe listen --forward-to http://localhost:3000/webhooks/stripe
```
