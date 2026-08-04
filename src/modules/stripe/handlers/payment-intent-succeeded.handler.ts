import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StripeEventHandler } from '@/modules/stripe/interfaces/stripe-event-handler.interface';
import { ParsedWebhookEvent } from '@/modules/payment/interfaces/webhook-strategy.interface';
import { PaymentEvents } from '@/events/payment.events';
import Stripe from 'stripe';

@Injectable()
export class PaymentIntentSucceededHandler implements StripeEventHandler {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  handle(event: ParsedWebhookEvent): void {
    const paymentIntent = event.data as Stripe.PaymentIntent;
    this.eventEmitter.emit(PaymentEvents.PAYMENT_INTENT_SUCCEEDED, {
      providerEventId: event.id,
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
    });
  }
}
