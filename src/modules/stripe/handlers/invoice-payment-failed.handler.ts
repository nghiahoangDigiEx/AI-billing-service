import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StripeEventHandler } from '@/modules/stripe/interfaces/stripe-event-handler.interface';
import { ParsedWebhookEvent } from '@/modules/payment/interfaces/webhook-strategy.interface';
import { PaymentEvents } from '@/events/payment.events';
import Stripe from 'stripe';

@Injectable()
export class InvoicePaymentFailedHandler implements StripeEventHandler {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async handle(event: ParsedWebhookEvent): Promise<void> {
    const invoiceFailed = event.data as Stripe.Invoice & {
      subscription?: string;
    };
    await this.eventEmitter.emitAsync(PaymentEvents.INVOICE_PAYMENT_FAILED, {
      providerEventId: event.id,
      subscriptionId: invoiceFailed.subscription as string,
      customerId: invoiceFailed.customer as string,
    });
  }
}
