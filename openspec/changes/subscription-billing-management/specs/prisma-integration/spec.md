## ADDED Requirements

### Requirement: Billing Domain Models
The system SHALL extend the Prisma schema with billing domain models including Plan, PlanPrice, Subscription, AddonPackage, AddonPurchase, CreditBalance, and WebhookEvent tables.

#### Scenario: Plan model in schema
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains Plan model with fields: id (uuid, primary key), stripeProductId (string, unique), name (string), slug (string, unique), creditsIncluded (int), status (enum: ACTIVE, INACTIVE), createdAt (datetime), updatedAt (datetime)
- **AND** Plan has one-to-many relation to PlanPrice
- **AND** Plan has one-to-many relation to Subscription

#### Scenario: PlanPrice model in schema
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains PlanPrice model with fields: id (uuid, primary key), stripePriceId (string, unique), planId (foreign key to Plan), billingInterval (enum: MONTH, YEAR), amount (int, in cents), currency (string, default 'usd'), status (enum: ACTIVE, INACTIVE), createdAt (datetime), updatedAt (datetime)
- **AND** PlanPrice has many-to-one relation to Plan
- **AND** PlanPrice has one-to-many relation to Subscription

#### Scenario: Subscription model in schema
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains Subscription model with fields: id (uuid, primary key), userId (foreign key to User), planId (foreign key to Plan), planPriceId (foreign key to PlanPrice), stripeSubscriptionId (string, unique), status (enum: ACTIVE, PAST_DUE, CANCELLED, TRIALING), currentPeriodStart (datetime), currentPeriodEnd (datetime), createdAt (datetime), updatedAt (datetime)
- **AND** Subscription has many-to-one relation to User
- **AND** Subscription has many-to-one relation to Plan
- **AND** Subscription has many-to-one relation to PlanPrice
- **AND** Subscription has index on userId and status for efficient queries

#### Scenario: AddonPackage model in schema
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains AddonPackage model with fields: id (uuid, primary key), stripeProductId (string, unique), stripePriceId (string, unique), name (string), credits (int), amount (int, in cents), currency (string, default 'usd'), status (enum: ACTIVE, INACTIVE), createdAt (datetime), updatedAt (datetime)
- **AND** AddonPackage has one-to-many relation to AddonPurchase

#### Scenario: AddonPurchase model in schema
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains AddonPurchase model with fields: id (uuid, primary key), userId (foreign key to User), addonPackageId (foreign key to AddonPackage), stripePaymentIntentId (string, unique), createdAt (datetime)
- **AND** AddonPurchase has many-to-one relation to User
- **AND** AddonPurchase has many-to-one relation to AddonPackage
- **AND** AddonPurchase has index on userId for efficient queries

#### Scenario: CreditBalance model in schema
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains CreditBalance model with fields: id (uuid, primary key), userId (foreign key to User), source (enum: MONTHLY, ADDON), sourceRef (string, subscriptionId or addonPurchaseId), totalCredits (int), remainingCredits (int), status (enum: ACTIVE, FROZEN, EXHAUSTED), periodStart (datetime, nullable), periodEnd (datetime, nullable), purchasedAt (datetime, nullable), createdAt (datetime), updatedAt (datetime)
- **AND** CreditBalance has many-to-one relation to User
- **AND** CreditBalance has CHECK constraint ensuring remainingCredits >= 0
- **AND** CreditBalance has index on userId and status for efficient queries

#### Scenario: WebhookEvent model in schema
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains WebhookEvent model with fields: id (uuid, primary key), stripeEventId (string, unique), eventType (string), payload (json), status (enum: PENDING, PROCESSED, FAILED), errorMessage (string, nullable), processedAt (datetime, nullable), createdAt (datetime)
- **AND** WebhookEvent has unique constraint on stripeEventId for idempotency
- **AND** WebhookEvent has index on stripeEventId for fast lookups

### Requirement: User Model Extension
The system SHALL extend the existing User model with Stripe customer ID and pending setup flag.

#### Scenario: User model includes Stripe fields
- **WHEN** prisma/schema.prisma is read
- **THEN** User model contains stripeCustomerId (string, optional, unique)
- **AND** User model contains pendingStripeSetup (boolean, default false)
- **AND** User model has one-to-many relation to Subscription
- **AND** User model has one-to-many relation to AddonPurchase

#### Scenario: Stripe customer ID is optional
- **WHEN** user is created with pendingStripeSetup=true
- **THEN** stripeCustomerId is null
- **AND** user can exist without Stripe customer until background job completes setup

### Requirement: Billing Enums
The system SHALL define enums for billing-related status values in the Prisma schema.

#### Scenario: SubscriptionStatus enum
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains enum SubscriptionStatus with values: ACTIVE, PAST_DUE, CANCELLED, TRIALING

#### Scenario: PlanStatus enum
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains enum PlanStatus with values: ACTIVE, INACTIVE

#### Scenario: BillingInterval enum
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains enum BillingInterval with values: MONTH, YEAR

#### Scenario: AddonPurchaseStatus enum
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains enum AddonPurchaseStatus with values: ACTIVE, FROZEN, EXHAUSTED

#### Scenario: CreditSource enum
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains enum CreditSource with values: MONTHLY, ADDON

#### Scenario: CreditStatus enum
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains enum CreditStatus with values: ACTIVE, FROZEN, EXHAUSTED

#### Scenario: WebhookEventStatus enum
- **WHEN** prisma/schema.prisma is read
- **THEN** schema contains enum WebhookEventStatus with values: PENDING, PROCESSED, FAILED

### Requirement: Billing Migration
The system SHALL create a Prisma migration that adds all billing domain models to the database.

#### Scenario: Migration creates billing tables
- **WHEN** npx prisma migrate dev --name add_billing_models is executed
- **THEN** migration file is created in prisma/migrations/
- **AND** migration contains CREATE TABLE statements for Plan, PlanPrice, Subscription, AddonPackage, AddonPurchase, CreditBalance, WebhookEvent
- **AND** migration contains ALTER TABLE statement to add stripeCustomerId and pendingStripeSetup to User table
- **AND** migration contains CREATE INDEX statements for foreign keys and status fields
- **AND** migration is applied to the database successfully

#### Scenario: Migration is idempotent
- **WHEN** migration is applied to database
- **THEN** all tables are created with correct schema
- **AND** all indexes are created
- **AND** all foreign key constraints are established
- **AND** existing User records are not affected (new fields are optional or have defaults)
