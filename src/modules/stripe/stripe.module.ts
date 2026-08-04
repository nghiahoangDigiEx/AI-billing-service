import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { StripeAdapter } from './adapters/stripe.adapter';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { PaymentProviderFactory } from '../payment/factories/payment-provider.factory';
import { WebhookStrategyFactory } from '../payment/factories/webhook-strategy.factory';
import { PaymentProvider } from '../payment/enums/payment-provider.enum';
import { StripeWebhookStrategy } from './strategies/stripe-webhook.strategy';
import { StripeEventHandlerFactory } from './factories/stripe-event-handler.factory';
import { InvoicePaidHandler } from './handlers/invoice-paid.handler';
import { InvoicePaymentFailedHandler } from './handlers/invoice-payment-failed.handler';
import { SubscriptionDeletedHandler } from './handlers/subscription-deleted.handler';
import { PaymentIntentSucceededHandler } from './handlers/payment-intent-succeeded.handler';

@Module({
  imports: [ConfigModule, PrismaModule, PaymentModule],
  controllers: [StripeWebhookController],
  providers: [
    StripeAdapter,
    StripeWebhookService,
    StripeWebhookStrategy,
    StripeEventHandlerFactory,
    InvoicePaidHandler,
    InvoicePaymentFailedHandler,
    SubscriptionDeletedHandler,
    PaymentIntentSucceededHandler,
  ],
  exports: [StripeAdapter],
})
export class StripeModule implements OnModuleInit {
  constructor(
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly webhookStrategyFactory: WebhookStrategyFactory,
    private readonly stripeAdapter: StripeAdapter,
    private readonly stripeWebhookStrategy: StripeWebhookStrategy,
    private readonly stripeEventHandlerFactory: StripeEventHandlerFactory,
    private readonly invoicePaidHandler: InvoicePaidHandler,
    private readonly invoicePaymentFailedHandler: InvoicePaymentFailedHandler,
    private readonly subscriptionDeletedHandler: SubscriptionDeletedHandler,
    private readonly paymentIntentSucceededHandler: PaymentIntentSucceededHandler,
  ) {}

  onModuleInit() {
    this.paymentProviderFactory.registerAdapter(
      PaymentProvider.STRIPE,
      this.stripeAdapter,
    );
    this.webhookStrategyFactory.registerStrategy(
      PaymentProvider.STRIPE,
      this.stripeWebhookStrategy,
    );
    this.stripeEventHandlerFactory.registerHandler(
      'invoice.paid',
      this.invoicePaidHandler,
    );
    this.stripeEventHandlerFactory.registerHandler(
      'invoice.payment_failed',
      this.invoicePaymentFailedHandler,
    );
    this.stripeEventHandlerFactory.registerHandler(
      'customer.subscription.deleted',
      this.subscriptionDeletedHandler,
    );
    this.stripeEventHandlerFactory.registerHandler(
      'payment_intent.succeeded',
      this.paymentIntentSucceededHandler,
    );
  }
}
