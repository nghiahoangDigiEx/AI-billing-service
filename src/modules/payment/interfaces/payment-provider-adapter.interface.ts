import { SubscriptionInterval } from '../enums/subscription-interval.enum';

export interface PaymentProviderAdapter {
  createCustomer(email: string, name?: string): Promise<{ id: string }>;
  createSubscription(
    customerId: string,
    priceId: string,
  ): Promise<{ id: string }>;
  cancelSubscription(subscriptionId: string): Promise<{ id: string }>;
  createProduct(name: string): Promise<{ id: string }>;
  createPrice(
    productId: string,
    amount: number,
    currency: string,
    interval?: SubscriptionInterval,
  ): Promise<{ id: string }>;
  updateProduct(productId: string, name: string): Promise<{ id: string }>;
  archiveProduct(productId: string): Promise<{ id: string }>;
  createPaymentIntent(
    amount: number,
    currency: string,
    customerId: string,
    metadata: Record<string, string>,
  ): Promise<{ id: string; clientSecret: string | null }>;
}
