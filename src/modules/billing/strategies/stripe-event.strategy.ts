import Stripe from 'stripe';

export interface StripeEventStrategy {
  handle(event: Stripe.Event): Promise<void>;
}
