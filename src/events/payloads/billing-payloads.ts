export interface InvoicePaidPayload {
  userId: string;
  creditsIncluded: number;
  periodStart: Date;
  periodEnd: Date;
  sourceRef: string;
  planSlug?: string;
}

export interface AddonPurchasedPayload {
  userId: string;
  credits: number;
  sourceRef: string;
}

export interface SubscriptionPaymentFailedPayload {
  userId: string;
  sourceRef: string;
}

export interface SubscriptionDeletedPayload {
  userId: string;
  freePlanCredits: number;
  periodStart: Date;
  periodEnd: Date;
  sourceRef: string;
}

export interface SubscriptionCreatedPayload {
  userId: string;
  stripeCustomerId: string;
}

export interface SubscriptionDowngradedPayload {
  userId: string;
  freePlanCredits: number;
  newSubscriptionId: string;
}

export interface SubscriptionRecoveredPayload {
  userId: string;
  sourceRef: string;
}

export interface SubscriptionRenewedPayload {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  sourceRef: string;
}
