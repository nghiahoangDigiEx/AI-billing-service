import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CONFIG_KEYS } from '../../../common/constants/config.constants';
import { PaymentProviderAdapter } from '../../payment/interfaces/payment-provider-adapter.interface';
import { SubscriptionInterval } from '../../payment/enums/subscription-interval.enum';

@Injectable()
export class StripeAdapter implements PaymentProviderAdapter {
  private readonly logger = new Logger(StripeAdapter.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>(
      CONFIG_KEYS.STRIPE_SECRET_KEY,
    );
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(secretKey, {
      // @ts-expect-error valid api version
      apiVersion: '2024-12-18.acacia',
    });
  }

  async createCustomer(email: string, name?: string): Promise<{ id: string }> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
      });
      this.logger.log(`Created Stripe customer: ${customer.id} for ${email}`);
      return { id: customer.id };
    } catch (error) {
      this.logger.error(`Failed to create Stripe customer for ${email}`, error);
      throw error;
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
  ): Promise<{ id: string }> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
      });
      this.logger.log(
        `Created subscription: ${subscription.id} for customer ${customerId}`,
      );
      return { id: subscription.id };
    } catch (error) {
      this.logger.error(
        `Failed to create subscription for customer ${customerId}`,
        error,
      );
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<{ id: string }> {
    try {
      const subscription =
        await this.stripe.subscriptions.cancel(subscriptionId);
      this.logger.log(`Cancelled subscription: ${subscriptionId}`);
      return { id: subscription.id };
    } catch (error) {
      this.logger.error(
        `Failed to cancel subscription ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  async createProduct(name: string): Promise<{ id: string }> {
    try {
      const product = await this.stripe.products.create({ name });
      this.logger.log(`Created Stripe product: ${product.id} - ${name}`);
      return { id: product.id };
    } catch (error) {
      this.logger.error(`Failed to create Stripe product: ${name}`, error);
      throw error;
    }
  }

  async createPrice(
    productId: string,
    amount: number,
    currency: string,
    interval?: SubscriptionInterval,
  ): Promise<{ id: string }> {
    try {
      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: amount,
        currency,
        ...(interval ? { recurring: { interval } } : {}),
      });
      this.logger.log(
        `Created Stripe price: ${price.id} for product ${productId}`,
      );
      return { id: price.id };
    } catch (error) {
      this.logger.error(
        `Failed to create price for product ${productId}`,
        error,
      );
      throw error;
    }
  }

  async archiveProduct(productId: string): Promise<{ id: string }> {
    try {
      const product = await this.stripe.products.update(productId, {
        active: false,
      });
      this.logger.log(`Archived Stripe product: ${productId}`);
      return { id: product.id };
    } catch (error) {
      this.logger.error(`Failed to archive product ${productId}`, error);
      throw error;
    }
  }

  async updateProduct(
    productId: string,
    name: string,
  ): Promise<{ id: string }> {
    try {
      const product = await this.stripe.products.update(productId, { name });
      this.logger.log(`Updated Stripe product: ${productId}`);
      return { id: product.id };
    } catch (error) {
      this.logger.error(`Failed to update product ${productId}`, error);
      throw error;
    }
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customer: string,
    metadata: Record<string, string>,
  ): Promise<{ id: string; clientSecret: string | null }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer,
        metadata,
      });
      this.logger.log(`Created payment intent: ${paymentIntent.id}`);
      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      this.logger.error(`Failed to create payment intent`, error);
      throw error;
    }
  }
}
