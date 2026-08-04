## ADDED Requirements

### Requirement: WebhookEvent Entity
The system SHALL maintain a WebhookEvent entity to track processed Stripe webhooks and enforce idempotency. Each webhook event SHALL be recorded with its Stripe event ID before processing.

#### Scenario: WebhookEvent record structure
- **WHEN** a Stripe webhook is received
- **THEN** the WebhookEvent table contains fields: id, stripeEventId (unique), eventType, payload, processedAt, createdAt
- **AND** stripeEventId has a unique constraint to prevent duplicate processing
- **AND** processedAt is set after successful event handling

#### Scenario: Idempotency check
- **WHEN** Stripe webhook is received with stripeEventId
- **THEN** system queries WebhookEvent table for existing stripeEventId
- **AND** if record exists and status=PROCESSED: system returns 200 OK immediately without reprocessing
- **AND** if record exists and status=PENDING: system returns 409 Conflict (avoids concurrent processing)
- **AND** if record exists and status=FAILED: system allows reprocessing
- **AND** if record does not exist: system inserts WebhookEvent record with status=PENDING and proceeds to process event

#### Scenario: Successful webhook processing
- **WHEN** system successfully processes a webhook event
- **THEN** system updates WebhookEvent record to status=PROCESSED and sets processedAt timestamp

#### Scenario: Failed webhook processing
- **WHEN** an unhandled exception or Stripe API error occurs during processing
- **THEN** system catches error
- **AND** system updates WebhookEvent record to status=FAILED and sets errorMessage
- **AND** system returns 500 Internal Server Error to trigger Stripe retry

### Requirement: Webhook Signature Verification
The system SHALL verify Stripe webhook signatures before processing any events. Invalid signatures SHALL be rejected.

#### Scenario: Valid webhook signature
- **WHEN** Stripe webhook request includes valid signature header
- **THEN** system verifies signature using Stripe webhook secret
- **AND** system processes the event
- **AND** system returns 200 OK

#### Scenario: Invalid webhook signature
- **WHEN** Stripe webhook request includes invalid or missing signature
- **THEN** system returns 400 Bad Request
- **AND** system does NOT process the event
- **AND** system logs warning about invalid signature

### Requirement: Handle invoice.paid Webhook
The system SHALL process invoice.paid webhooks to reset user credits based on their active subscription plan, and handle subscription recovery from PAST_DUE status.

#### Scenario: Invoice paid for active subscription
- **WHEN** Stripe fires invoice.paid webhook for a subscription
- **THEN** system verifies webhook signature
- **AND** system checks idempotency (WebhookEvent stripeEventId)
- **AND** system finds local subscription by stripeSubscriptionId
- **AND** system queries plan's monthly credit allotment (from Plan table)
- **AND** system marks previous MONTHLY CreditBalance records as EXHAUSTED
- **AND** system creates new CreditBalance record with source=MONTHLY, totalCredits=plan allotment
- **AND** system emits subscription.renewed event with userId and creditsIncluded
- **AND** system updates WebhookEvent record to status=PROCESSED with processedAt timestamp
- **AND** system returns 200 OK

#### Scenario: Invoice paid recovers PAST_DUE subscription
- **WHEN** Stripe fires invoice.paid webhook for a subscription
- **AND** local subscription has status=PAST_DUE
- **THEN** system updates subscription status to ACTIVE
- **AND** system unfreezes all FROZEN CreditBalance records where source=ADDON for user
- **AND** system emits subscription.recovered event with userId
- **AND** system emits addon.unfrozen event with userId (if add-ons were unfrozen)
- **AND** system continues with normal invoice.paid processing (credit reset)

#### Scenario: Invoice paid for Free plan
- **WHEN** Stripe fires invoice.paid webhook for Free plan subscription ($0 invoice)
- **THEN** system processes webhook same as paid plan
- **AND** system creates new CreditBalance record with source=MONTHLY, totalCredits=Free plan allotment
- **AND** system emits subscription.renewed event

#### Scenario: Subscription not found locally
- **WHEN** Stripe fires invoice.paid webhook but local subscription not found
- **THEN** system logs error "Subscription not found for stripeSubscriptionId"
- **AND** system returns 200 OK (acknowledges webhook to prevent retries)
- **AND** system does NOT crash or return error

#### Scenario: Invoice has no subscription (one-time charge)
- **WHEN** Stripe fires invoice.paid webhook
- **AND** invoice has no subscription field (one-time charge)
- **THEN** system logs "One-time invoice, ignoring (handled by payment_intent.succeeded)"
- **AND** system returns 200 OK
- **AND** system does NOT process as subscription renewal

### Requirement: Handle invoice.payment_failed Webhook
The system SHALL process invoice.payment_failed webhooks to mark subscriptions as PAST_DUE and lock credits.

#### Scenario: Payment failed for active subscription
- **WHEN** Stripe fires invoice.payment_failed webhook
- **THEN** system verifies webhook signature
- **AND** system checks idempotency
- **AND** system finds local subscription by stripeSubscriptionId
- **AND** system updates subscription status to PAST_DUE
- **AND** system emits subscription.payment_failed event with userId
- **AND** system updates WebhookEvent record to status=PROCESSED
- **AND** system returns 200 OK

#### Scenario: Multiple payment failures
- **WHEN** Stripe retries payment and fires multiple invoice.payment_failed webhooks
- **THEN** system processes each webhook (idempotency by stripeEventId)
- **AND** subscription remains PAST_DUE (no additional state change)
- **AND** system logs each failure attempt

### Requirement: Handle customer.subscription.deleted Webhook
The system SHALL process customer.subscription.deleted webhooks to cancel subscriptions and trigger downgrade to Free plan.

#### Scenario: Subscription deleted (downgrade to Free)
- **WHEN** Stripe fires customer.subscription.deleted webhook (after 3 payment retries failed)
- **THEN** system verifies webhook signature
- **AND** system checks idempotency
- **AND** system finds local subscription by stripeSubscriptionId
- **AND** system creates new Free subscription in Stripe FIRST
- **AND** system executes DB transaction:
  - Updates Pro subscription status to CANCELLED
  - Inserts new Free subscription with status=ACTIVE
  - Updates all ACTIVE CreditBalance records where source=ADDON to FROZEN for user
  - Creates new MONTHLY CreditBalance record with Free plan allotment (from Plan table)
- **AND** system emits subscription.downgraded event with userId, fromPlan=pro, toPlan=free
- **AND** system emits addon.frozen event with userId
- **AND** system updates WebhookEvent record to status=PROCESSED
- **AND** system returns 200 OK

#### Scenario: Free subscription creation fails
- **WHEN** system attempts to create Free subscription in Stripe but API fails
- **THEN** system returns 500 Internal Server Error to Stripe
- **AND** system does NOT execute DB transaction
- **AND** Stripe retries the webhook event
- **AND** system logs error "Failed to create Free subscription during downgrade"

#### Scenario: DB transaction fails after Stripe success
- **WHEN** Free subscription created in Stripe but DB transaction fails
- **THEN** system logs critical error "Orphaned Free subscription in Stripe for user"
- **AND** system returns 500 to Stripe (triggers retry)
- **AND** reconciliation job will detect and fix orphaned subscription later

### Requirement: Handle payment_intent.succeeded Webhook
The system SHALL process payment_intent.succeeded webhooks to create add-on purchase records and credit balances for one-time add-on purchases.

#### Scenario: Payment intent succeeded for add-on purchase
- **WHEN** Stripe fires payment_intent.succeeded webhook
- **AND** PaymentIntent metadata contains addonPackageId and userId
- **THEN** system verifies webhook signature
- **AND** system checks idempotency (WebhookEvent stripeEventId)
- **AND** system queries AddonPackage by addonPackageId from metadata
- **AND** system inserts AddonPurchase record with userId, addonPackageId, stripePaymentIntentId
- **AND** system inserts CreditBalance record with source=ADDON, sourceRef=addonPurchaseId, totalCredits=addonPackage.credits, remainingCredits=addonPackage.credits, status=ACTIVE, purchasedAt=now()
- **AND** system emits addon.purchased event with userId, addonPurchaseId, credits
- **AND** system updates WebhookEvent record to status=PROCESSED with processedAt timestamp
- **AND** system returns 200 OK

#### Scenario: Payment intent without add-on metadata
- **WHEN** Stripe fires payment_intent.succeeded webhook
- **AND** PaymentIntent metadata does not contain addonPackageId
- **THEN** system logs "Payment intent without add-on metadata, ignoring"
- **AND** system returns 200 OK
- **AND** system does NOT create AddonPurchase or CreditBalance records

#### Scenario: AddonPackage not found
- **WHEN** Stripe fires payment_intent.succeeded webhook with addonPackageId
- **AND** AddonPackage with that ID does not exist
- **THEN** system logs error "AddonPackage not found for addonPackageId"
- **AND** system returns 200 OK (acknowledges webhook to prevent retries)
- **AND** system does NOT create AddonPurchase or CreditBalance records

### Requirement: Webhook Endpoint
The system SHALL expose a webhook endpoint at POST /webhooks/stripe to receive all Stripe events.

#### Scenario: Webhook endpoint receives event
- **WHEN** Stripe sends POST request to /webhooks/stripe
- **THEN** system extracts raw body and signature header
- **AND** system verifies signature
- **AND** system parses event type from payload
- **AND** system routes to appropriate handler based on event type
- **AND** system returns 200 OK on success

#### Scenario: Unsupported event type
- **WHEN** Stripe sends webhook with event type not handled by system
- **THEN** system logs "Ignoring unsupported event type: {eventType}"
- **AND** system returns 200 OK (acknowledges receipt)
- **AND** system does NOT insert WebhookEvent record

#### Scenario: Webhook endpoint is public
- **WHEN** Stripe sends webhook request
- **THEN** endpoint does NOT require authentication
- **AND** endpoint relies on signature verification for security
