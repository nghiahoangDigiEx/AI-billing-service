import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StripeEventHandler } from '@/modules/stripe/interfaces/stripe-event-handler.interface';
import { ParsedWebhookEvent } from '@/modules/payment/interfaces/webhook-strategy.interface';
import { PaymentEvents } from '@/events/payment.events';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionDeletedHandler implements StripeEventHandler {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async handle(event: ParsedWebhookEvent): Promise<void> {
    const subscription = event.data as Stripe.Subscription;
    await this.eventEmitter.emitAsync(PaymentEvents.SUBSCRIPTION_DELETED, {
      providerEventId: event.id,
      subscriptionId: subscription.id,
    });
  }
}
