import { Injectable, Logger } from '@nestjs/common';
import { StripeEventStrategy } from './stripe-event.strategy';
import { InvoicePaidStrategy } from './invoice-paid.strategy';
import { InvoicePaymentFailedStrategy } from './invoice-payment-failed.strategy';
import { SubscriptionDeletedStrategy } from './subscription-deleted.strategy';
import { PaymentIntentSucceededStrategy } from './payment-intent-succeeded.strategy';

@Injectable()
export class WebhookStrategyFactory {
  private readonly logger = new Logger(WebhookStrategyFactory.name);

  constructor(
    private readonly invoicePaidStrategy: InvoicePaidStrategy,
    private readonly invoicePaymentFailedStrategy: InvoicePaymentFailedStrategy,
    private readonly subscriptionDeletedStrategy: SubscriptionDeletedStrategy,
    private readonly paymentIntentSucceededStrategy: PaymentIntentSucceededStrategy,
  ) {}

  getStrategy(eventType: string): StripeEventStrategy | null {
    switch (eventType) {
      case 'invoice.paid':
        return this.invoicePaidStrategy;
      case 'invoice.payment_failed':
        return this.invoicePaymentFailedStrategy;
      case 'customer.subscription.deleted':
        return this.subscriptionDeletedStrategy;
      case 'payment_intent.succeeded':
        return this.paymentIntentSucceededStrategy;
      default:
        this.logger.log(`No strategy found for event type: ${eventType}`);
        return null;
    }
  }
}
