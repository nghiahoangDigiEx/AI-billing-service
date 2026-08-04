export enum PaymentEvents {
  INVOICE_PAID = 'payment.invoice.paid',
  INVOICE_PAYMENT_FAILED = 'payment.invoice.payment_failed',
  SUBSCRIPTION_DELETED = 'payment.subscription.deleted',
  PAYMENT_INTENT_SUCCEEDED = 'payment.intent.succeeded',
}

export interface InvoicePaidEvent {
  providerEventId: string;
  subscriptionId: string;
  customerId: string;
  priceId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface InvoicePaymentFailedEvent {
  providerEventId: string;
  subscriptionId: string;
  customerId: string;
}

export interface SubscriptionDeletedEvent {
  providerEventId: string;
  subscriptionId: string;
}

export interface PaymentIntentSucceededEvent {
  providerEventId: string;
  paymentIntentId: string;
  metadata: Record<string, string>;
}
