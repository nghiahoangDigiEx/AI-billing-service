import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StripeEventHandler } from '@/modules/stripe/interfaces/stripe-event-handler.interface';
import { ParsedWebhookEvent } from '@/modules/payment/interfaces/webhook-strategy.interface';
import { PaymentEvents } from '@/events/payment.events';
import Stripe from 'stripe';

@Injectable()
export class InvoicePaidHandler implements StripeEventHandler {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  handle(event: ParsedWebhookEvent): void {
    const invoicePaid = event.data as Stripe.Invoice & {
      subscription?: string;
    };
    const lineItem = invoicePaid.lines.data[0] as Stripe.InvoiceLineItem & {
      price?: Stripe.Price | string | null;
    };
    const priceId =
      typeof lineItem?.price === 'string'
        ? lineItem.price
        : lineItem?.price?.id;

    this.eventEmitter.emit(PaymentEvents.INVOICE_PAID, {
      providerEventId: event.id,
      subscriptionId: invoicePaid.subscription as string,
      customerId:
        typeof invoicePaid.customer === 'string'
          ? invoicePaid.customer
          : invoicePaid.customer?.id,
      priceId: priceId as string,
      periodStart: new Date((lineItem?.period?.start || 0) * 1000),
      periodEnd: new Date((lineItem?.period?.end || 0) * 1000),
    });
  }
}
