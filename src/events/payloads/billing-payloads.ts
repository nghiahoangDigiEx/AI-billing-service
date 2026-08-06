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
