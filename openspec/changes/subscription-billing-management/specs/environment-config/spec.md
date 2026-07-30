## ADDED Requirements

### Requirement: Stripe API Keys
The system SHALL require Stripe API keys to be configured via environment variables for billing operations.

#### Scenario: STRIPE_SECRET_KEY is configured
- **WHEN** the application requires Stripe API access
- **THEN** STRIPE_SECRET_KEY environment variable is set
- **AND** contains valid Stripe secret key (starts with sk_test_ or sk_live_)
- **AND** key is used for all Stripe API calls

#### Scenario: STRIPE_WEBHOOK_SECRET is configured
- **WHEN** the application processes Stripe webhooks
- **THEN** STRIPE_WEBHOOK_SECRET environment variable is set
- **AND** contains valid Stripe webhook signing secret (starts with whsec_)
- **AND** secret is used to verify webhook signatures

#### Scenario: Missing Stripe keys
- **WHEN** application starts without STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET
- **THEN** application logs error "Missing required Stripe configuration"
- **AND** application fails to start with clear error message
- **AND** no billing operations can be performed

### Requirement: Stripe Configuration in .env.example
The system SHALL document Stripe configuration variables in .env.example with placeholder values.

#### Scenario: .env.example includes Stripe variables
- **WHEN** .env.example file is read
- **THEN** file contains STRIPE_SECRET_KEY with placeholder value (e.g., sk_test_xxx)
- **AND** file contains STRIPE_WEBHOOK_SECRET with placeholder value (e.g., whsec_xxx)
- **AND** file includes comments explaining each variable
- **AND** file includes instructions for obtaining Stripe keys from Stripe Dashboard

#### Scenario: Developer configures Stripe
- **WHEN** developer copies .env.example to .env
- **THEN** developer can fill in actual Stripe test/live keys
- **AND** application can connect to Stripe API with provided keys

### Requirement: Stripe Keys Excluded from Version Control
The system SHALL ensure Stripe keys are never committed to version control.

#### Scenario: .env is in .gitignore
- **WHEN** .gitignore file is checked
- **THEN** .env entry is present (already exists from user-registration-login change)
- **AND** Stripe keys in .env are not tracked by git

#### Scenario: No hardcoded Stripe keys
- **WHEN** source code is searched for Stripe keys
- **THEN** no hardcoded sk_test_, sk_live_, or whsec_ values are found
- **AND** all Stripe keys are accessed via ConfigService and environment variables

### Requirement: Stripe Module Configuration
The system SHALL configure Stripe SDK with API key from environment variables.

#### Scenario: Stripe client initialization
- **WHEN** Billing module is initialized
- **THEN** Stripe client is created with apiKey from ConfigService.get('STRIPE_SECRET_KEY')
- **AND** Stripe client is injected into services that require Stripe API access
- **AND** Stripe client uses latest API version (specified in Stripe client options)

#### Scenario: Stripe client is singleton
- **WHEN** multiple services inject Stripe client
- **THEN** all services receive the same Stripe client instance
- **AND** Stripe client is configured once at module initialization

### Requirement: Billing Background Job Configuration
The system SHALL configure background job settings for pending Stripe setup retries.

#### Scenario: Background job interval configured
- **WHEN** application requires background job for pending Stripe setup
- **THEN** BILLING_RETRY_INTERVAL environment variable is set (default: 300000 ms = 5 minutes)
- **AND** background job runs at configured interval

#### Scenario: Max retries configured
- **WHEN** background job retries pending Stripe setup
- **THEN** BILLING_MAX_RETRIES environment variable is set (default: 5)
- **AND** job stops retrying after max retries and logs error

### Requirement: Free Plan Configuration
The system SHALL require Free plan Stripe Product and Price IDs to be configured for auto-subscription on user registration.

#### Scenario: STRIPE_FREE_PLAN_PRICE_ID is configured
- **WHEN** system auto-subscribes new users to Free plan
- **THEN** STRIPE_FREE_PLAN_PRICE_ID environment variable is set
- **AND** contains valid Stripe Price ID for Free plan (starts with price_)
- **AND** system uses this ID when creating Free subscriptions

#### Scenario: Missing Free plan configuration
- **WHEN** application starts without STRIPE_FREE_PLAN_PRICE_ID
- **THEN** application logs warning "Free plan price ID not configured"
- **AND** user registration still succeeds but with pendingStripeSetup=true
- **AND** background job cannot create Free subscriptions until configured

### Requirement: Webhook Endpoint URL Configuration
The system SHALL document webhook endpoint URL requirements for Stripe Dashboard configuration.

#### Scenario: Webhook endpoint documentation
- **WHEN** developer configures Stripe webhooks
- **THEN** README or deployment documentation specifies webhook endpoint URL
- **AND** URL format is: https://{domain}/webhooks/stripe
- **AND** documentation includes list of required webhook events to enable in Stripe Dashboard:
  - invoice.paid
  - invoice.payment_failed
  - customer.subscription.deleted
  - customer.subscription.updated

#### Scenario: Webhook endpoint is publicly accessible
- **WHEN** Stripe sends webhook to configured endpoint
- **THEN** endpoint is publicly accessible (no authentication required)
- **AND** endpoint relies on signature verification for security
- **AND** endpoint is available in production deployment
