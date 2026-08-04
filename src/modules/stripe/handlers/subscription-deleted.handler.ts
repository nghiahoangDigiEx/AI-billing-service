import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StripeEventHandler } from '../interfaces/stripe-event-handler.interface';
import { ParsedWebhookEvent } from '../../payment/interfaces/webhook-strategy.interface';
import { PaymentEvents } from '../../../events/payment.events';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionDeletedHandler implements StripeEventHandler {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  handle(event: ParsedWebhookEvent): void {
    const subscription = event.data as Stripe.Subscription;
    this.eventEmitter.emit(PaymentEvents.SUBSCRIPTION_DELETED, {
      providerEventId: event.id,
      subscriptionId: subscription.id,
    });
  }
}
