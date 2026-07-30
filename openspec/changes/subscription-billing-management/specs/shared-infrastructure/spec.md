## MODIFIED Requirements

### Requirement: Event Constants Module
The system SHALL define event constants in src/events/event.constants.ts with typed string constants for cross-module communication. Constants SHALL use past-tense naming convention.

#### Scenario: Event constants file exists
- **WHEN** the project is initialized
- **THEN** src/events/event.constants.ts exists
- **AND** exports event name constants as string values

#### Scenario: Event constants use dot notation
- **WHEN** event constants are defined
- **THEN** format follows `<module>.<action>` pattern (e.g., 'user.registered')
- **AND** actions use past tense (e.g., 'registered', 'updated', 'deleted')

#### Scenario: Billing event constants are defined
- **WHEN** billing module is implemented
- **THEN** event.constants.ts exports billing-related event constants:
  - SUBSCRIPTION_CREATED = 'subscription.created'
  - SUBSCRIPTION_CANCELLED = 'subscription.cancelled'
  - SUBSCRIPTION_DOWNGRADED = 'subscription.downgraded'
  - SUBSCRIPTION_RENEWED = 'subscription.renewed'
  - SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment_failed'
  - SUBSCRIPTION_RECOVERED = 'subscription.recovered'
  - ADDON_PURCHASED = 'addon.purchased'
  - ADDON_FROZEN = 'addon.frozen'
  - ADDON_UNFROZEN = 'addon.unfrozen'
- **AND** all billing event constants follow the module.action pattern

### Requirement: ErrorCode Enum
The system SHALL define an ErrorCode enum in src/common/enums/error-code.enum.ts with typed error codes for consistent error handling across the application.

#### Scenario: ErrorCode enum exists with common error codes
- **WHEN** the project is initialized
- **THEN** src/common/enums/error-code.enum.ts exists
- **AND** exports ErrorCode enum with values like INTERNAL_ERROR, VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN
- **AND** error codes use UPPER_SNAKE_CASE naming convention

#### Scenario: ErrorCode is used in exception handling
- **WHEN** an exception is caught by GlobalExceptionFilter
- **THEN** the error response includes a typed ErrorCode value
- **AND** the error code corresponds to the exception type

#### Scenario: Billing-specific error codes are defined
- **WHEN** billing module is implemented
- **THEN** ErrorCode enum includes billing-specific error codes:
  - SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND'
  - PLAN_NOT_FOUND = 'PLAN_NOT_FOUND'
  - PLAN_PRICE_NOT_FOUND = 'PLAN_PRICE_NOT_FOUND'
  - ADDON_NOT_FOUND = 'ADDON_NOT_FOUND'
  - INVALID_SUBSCRIPTION_STATUS = 'INVALID_SUBSCRIPTION_STATUS'
  - ADDON_PURCHASE_RESTRICTED = 'ADDON_PURCHASE_RESTRICTED'
  - INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS'
  - STRIPE_API_ERROR = 'STRIPE_API_ERROR'
  - WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID'
  - DUPLICATE_PLAN_SLUG = 'DUPLICATE_PLAN_SLUG'
  - DUPLICATE_BILLING_INTERVAL = 'DUPLICATE_BILLING_INTERVAL'
  - CANNOT_DEACTIVATE_LAST_PRICE = 'CANNOT_DEACTIVATE_LAST_PRICE'
- **AND** all billing error codes follow UPPER_SNAKE_CASE naming convention

## ADDED Requirements

### Requirement: Subscription Status Guards
The system SHALL provide guards to restrict endpoint access based on subscription status.

#### Scenario: RequireActiveSubscription guard
- **WHEN** endpoint is decorated with @RequireActiveSubscription()
- **THEN** guard checks if user has subscription with status=ACTIVE
- **AND** if user has no ACTIVE subscription: guard returns 403 Forbidden with ErrorCode.SUBSCRIPTION_NOT_ACTIVE
- **AND** if user has ACTIVE subscription: guard allows request to proceed

#### Scenario: RequirePaidSubscription guard
- **WHEN** endpoint is decorated with @RequirePaidSubscription()
- **THEN** guard checks if user has ACTIVE subscription with plan.slug != 'free'
- **AND** if user has ACTIVE Free subscription: guard returns 403 Forbidden with ErrorCode.PAID_SUBSCRIPTION_REQUIRED
- **AND** if user has ACTIVE paid subscription (Pro, etc.): guard allows request to proceed
- **AND** if user has no ACTIVE subscription: guard returns 403 Forbidden

#### Scenario: Guards are reusable
- **WHEN** multiple endpoints require subscription checks
- **THEN** guards can be applied to any controller method via decorator
- **AND** guards inject PrismaService to query subscription status
- **AND** guards use current user ID from JWT token

### Requirement: Admin Role Guard
The system SHALL provide a guard to restrict endpoint access to admin users only.

#### Scenario: AdminOnly guard
- **WHEN** endpoint is decorated with @AdminOnly()
- **THEN** guard checks if user.role == ADMIN
- **AND** if user.role != ADMIN: guard returns 403 Forbidden with ErrorCode.FORBIDDEN
- **AND** if user.role == ADMIN: guard allows request to proceed

#### Scenario: Admin guard is reusable
- **WHEN** multiple admin endpoints require role checks
- **THEN** guard can be applied to any controller method via decorator
- **AND** guard uses current user from JWT token (already validated by AuthGuard)

### Requirement: Billing Module Structure
The system SHALL organize billing functionality in src/modules/billing/ directory following NestJS module patterns.

#### Scenario: Billing module directory structure
- **WHEN** billing module is implemented
- **THEN** src/modules/billing/ directory contains:
  - dto/ (request/response DTOs)
  - entities/ (Prisma model types)
  - guards/ (subscription status guards)
  - billing.controller.ts (admin and user endpoints)
  - billing.service.ts (business logic)
  - billing.module.ts (module definition)
  - billing.spec.ts (unit tests)
  - stripe.service.ts (Stripe API wrapper)
  - webhook.controller.ts (webhook endpoint)
  - webhook.service.ts (webhook processing)

#### Scenario: Billing module is registered
- **WHEN** application starts
- **THEN** BillingModule is imported in AppModule
- **AND** billing controllers and services are available via dependency injection

### Requirement: Stripe Service Wrapper
The system SHALL provide a StripeService that wraps Stripe SDK calls with error handling and logging.

#### Scenario: StripeService injects Stripe client
- **WHEN** BillingService or WebhookService needs Stripe API access
- **THEN** services inject StripeService (not raw Stripe client)
- **AND** StripeService provides typed methods for Stripe operations:
  - createCustomer(email)
  - createSubscription(customerId, priceId)
  - cancelSubscription(subscriptionId)
  - createProduct(name)
  - createPrice(productId, amount, currency, interval)
  - createInvoiceItem(customerId, priceId)
  - verifyWebhookSignature(payload, signature)

#### Scenario: StripeService handles errors
- **WHEN** Stripe API call fails
- **THEN** StripeService catches Stripe error
- **AND** StripeService logs error with context (operation, parameters)
- **AND** StripeService throws domain exception with ErrorCode.STRIPE_API_ERROR
- **AND** StripeService does NOT expose raw Stripe error details to caller

### Requirement: Billing DTOs with Validation
The system SHALL provide DTOs for all billing endpoints with class-validator decorators.

#### Scenario: CreatePlanDto validation
- **WHEN** admin calls POST /admin/plans
- **THEN** CreatePlanDto validates:
  - name: string, required, min 2 chars, max 100 chars
  - slug: string, required, matches pattern ^[a-z0-9-]+$
  - creditsIncluded: number, required, positive integer
  - billingInterval: enum (MONTH, YEAR), required
  - amount: number, required, positive integer (cents)
  - currency: string, required, default 'usd'

#### Scenario: UpgradeSubscriptionDto validation
- **WHEN** user calls POST /subscriptions/upgrade
- **THEN** UpgradeSubscriptionDto validates:
  - planPriceId: string, required, UUID format

#### Scenario: PurchaseAddonDto validation
- **WHEN** user calls POST /addons/:id/purchase
- **THEN** no DTO required (addon ID in URL path)
- **AND** system validates addon ID is valid UUID format

### Requirement: Billing API Response DTOs
The system SHALL provide response DTOs for billing endpoints with consistent structure.

#### Scenario: PlanResponseDto structure
- **WHEN** billing endpoint returns plan data
- **THEN** PlanResponseDto includes:
  - id: string
  - name: string
  - slug: string
  - creditsIncluded: number
  - status: PlanStatus
  - prices: PlanPriceResponseDto[]

#### Scenario: SubscriptionResponseDto structure
- **WHEN** billing endpoint returns subscription data
- **THEN** SubscriptionResponseDto includes:
  - id: string
  - plan: PlanResponseDto
  - planPrice: PlanPriceResponseDto
  - status: SubscriptionStatus
  - currentPeriodStart: datetime
  - currentPeriodEnd: datetime

#### Scenario: AddonPackageResponseDto structure
- **WHEN** billing endpoint returns add-on data
- **THEN** AddonPackageResponseDto includes:
  - id: string
  - name: string
  - credits: number
  - amount: number
  - currency: string
  - status: AddonPackageStatus
