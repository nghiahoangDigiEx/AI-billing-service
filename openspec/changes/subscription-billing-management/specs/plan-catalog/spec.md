## ADDED Requirements

### Requirement: Plan Entity
The system SHALL maintain a Plan entity representing subscription tiers (Free, Pro, future plans). Each plan SHALL map to a Stripe Product and contain metadata including name, slug identifier, and status.

#### Scenario: Plan record structure
- **WHEN** a plan is created in the database
- **THEN** the Plan table contains fields: id, stripeProductId, name, slug (unique), creditsIncluded, status (ACTIVE, INACTIVE), createdAt, updatedAt
- **AND** slug is a URL-friendly identifier (e.g., 'free', 'pro')
- **AND** stripeProductId references the corresponding Stripe Product ID
- **AND** monthly credit allotment is stored in Plan table (creditsIncluded)

#### Scenario: Plan status values
- **WHEN** a plan status is queried
- **THEN** status is one of: ACTIVE (available for subscription), INACTIVE (archived, not available for new subscriptions)
- **AND** existing subscriptions to INACTIVE plans remain valid until cancelled

### Requirement: PlanPrice Entity
The system SHALL maintain a PlanPrice entity representing pricing options for a plan (monthly, annual). Each PlanPrice SHALL map to a Stripe Price and belong to exactly one Plan.

#### Scenario: PlanPrice record structure
- **WHEN** a plan price is created in the database
- **THEN** the PlanPrice table contains fields: id, stripePriceId, planId, billingInterval (month, year), amount (in cents), currency, status (ACTIVE, INACTIVE), createdAt, updatedAt
- **AND** stripePriceId references the corresponding Stripe Price ID
- **AND** planId is a foreign key to Plan

#### Scenario: Multiple prices per plan
- **WHEN** a plan has multiple pricing options
- **THEN** the plan can have both monthly and annual prices active simultaneously
- **AND** each price has a distinct billingInterval value

#### Scenario: PlanPrice status values
- **WHEN** a plan price status is queried
- **THEN** status is one of: ACTIVE (available for new subscriptions), INACTIVE (archived, existing subscriptions continue)
- **AND** Stripe Prices are immutable; deactivating a local PlanPrice does not delete the Stripe Price

### Requirement: Admin Create Plan
The system SHALL provide an admin-only endpoint to create a new plan. The endpoint SHALL create a Stripe Product, create an initial Stripe Price, and mirror both in the local database.

#### Scenario: Successful plan creation
- **WHEN** admin calls POST /admin/plans with valid name, slug, creditsIncluded, billingInterval, amount, currency
- **THEN** system calls Stripe API to create Product with name
- **AND** system calls Stripe API to create Price with billingInterval, amount, currency, linked to Product
- **AND** system inserts Plan record with stripeProductId, creditsIncluded
- **AND** system inserts PlanPrice record with stripePriceId, planId
- **AND** response returns 201 with created Plan and PlanPrice records

#### Scenario: Duplicate slug rejected
- **WHEN** admin calls POST /admin/plans with slug that already exists
- **THEN** system returns 409 Conflict with error message "Plan slug already exists"
- **AND** no Stripe API calls are made
- **AND** no database records are created

#### Scenario: Stripe API failure
- **WHEN** admin calls POST /admin/plans and Stripe API returns error
- **THEN** system returns 502 Bad Gateway with Stripe error message
- **AND** no local database records are created
- **AND** no partial state exists (Stripe Product created but not Price, or vice versa)

#### Scenario: Admin role required
- **WHEN** non-admin user calls POST /admin/plans
- **THEN** system returns 403 Forbidden
- **AND** no Stripe API calls are made
- **AND** no database records are created

### Requirement: Admin Update Plan
The system SHALL provide an admin-only endpoint to update plan metadata (name, creditsIncluded). The endpoint SHALL update the Stripe Product and local database record.

#### Scenario: Successful plan update
- **WHEN** admin calls PATCH /admin/plans/:id with updated name and/or creditsIncluded
- **THEN** system calls Stripe API to update Product name (if changed)
- **AND** system updates local Plan record
- **AND** response returns 200 with updated Plan record

#### Scenario: Plan not found
- **WHEN** admin calls PATCH /admin/plans/:id with non-existent plan ID
- **THEN** system returns 404 Not Found
- **AND** no Stripe API calls are made

### Requirement: Admin Add Plan Price
The system SHALL provide an admin-only endpoint to add a new pricing option to an existing plan. The endpoint SHALL create a Stripe Price and mirror it in the local database.

#### Scenario: Successful price addition
- **WHEN** admin calls POST /admin/plans/:id/prices with billingInterval, amount, currency
- **THEN** system calls Stripe API to create Price linked to plan's Stripe Product
- **AND** system inserts PlanPrice record with stripePriceId, planId
- **AND** response returns 201 with created PlanPrice record

#### Scenario: Duplicate billing interval rejected
- **WHEN** admin calls POST /admin/plans/:id/prices with billingInterval that already has ACTIVE price
- **THEN** system returns 409 Conflict with error message "Active price for this billing interval already exists"
- **AND** no Stripe API calls are made

### Requirement: Admin Deactivate Plan Price
The system SHALL provide an admin-only endpoint to deactivate a plan price. The endpoint SHALL mark the local PlanPrice as INACTIVE. The Stripe Price remains unchanged (Stripe Prices are immutable).

#### Scenario: Successful price deactivation
- **WHEN** admin calls DELETE /admin/plans/:id/prices/:priceId
- **THEN** system updates local PlanPrice status to INACTIVE
- **AND** system does NOT call Stripe API (Stripe Prices cannot be deleted)
- **AND** response returns 200 with updated PlanPrice record
- **AND** existing subscriptions using this price continue until cancelled

#### Scenario: Cannot deactivate last active price
- **WHEN** admin calls DELETE on the last ACTIVE price for a plan
- **THEN** system returns 400 Bad Request with error message "Cannot deactivate the last active price for a plan"
- **AND** PlanPrice status remains ACTIVE

### Requirement: Admin Create Add-on Package
The system SHALL provide an admin-only endpoint to create a one-time credit pack add-on. The endpoint SHALL create a Stripe Product, create a Stripe Price (one-time), and mirror both in the local database.

#### Scenario: Successful add-on creation
- **WHEN** admin calls POST /admin/addons with name, credits, amount, currency
- **THEN** system calls Stripe API to create Product with name
- **AND** system calls Stripe API to create Price with amount, currency, recurring=null (one-time)
- **AND** system inserts AddonPackage record with stripeProductId, stripePriceId, name, credits, amount, currency, status=ACTIVE
- **AND** response returns 201 with created AddonPackage record

#### Scenario: Stripe API failure
- **WHEN** admin calls POST /admin/addons and Stripe API returns error
- **THEN** system returns 502 Bad Gateway with Stripe error message
- **AND** no local database records are created

### Requirement: Admin Update Add-on Package
The system SHALL provide an admin-only endpoint to update add-on package metadata (name). The endpoint SHALL update the Stripe Product and local database record.

#### Scenario: Successful add-on update
- **WHEN** admin calls PATCH /admin/addons/:id with updated name
- **THEN** system calls Stripe API to update Product name
- **AND** system updates local AddonPackage record
- **AND** response returns 200 with updated AddonPackage record

### Requirement: Admin Deactivate Add-on Package
The system SHALL provide an admin-only endpoint to deactivate an add-on package. The endpoint SHALL mark the local AddonPackage as INACTIVE and archive the Stripe Product.

#### Scenario: Successful add-on deactivation
- **WHEN** admin calls DELETE /admin/addons/:id
- **THEN** system calls Stripe API to archive Product (active=false)
- **AND** system updates local AddonPackage status to INACTIVE
- **AND** response returns 200 with updated AddonPackage record
- **AND** existing AddonPurchase records remain valid (ACTIVE or FROZEN based on user subscription status)

#### Scenario: Add-on not found
- **WHEN** admin calls DELETE /admin/addons/:id with non-existent add-on ID
- **THEN** system returns 404 Not Found
- **AND** no Stripe API calls are made

### Requirement: Public List Active Plans
The system SHALL provide a public endpoint to list all active plans with their active pricing options. The endpoint SHALL return plan metadata and associated prices.

#### Scenario: Successful plan listing
- **WHEN** any user calls GET /plans
- **THEN** system queries Plan table where status=ACTIVE
- **AND** system includes associated PlanPrice records where status=ACTIVE
- **AND** response returns 200 with array of plans, each containing prices array
- **AND** response includes: plan id, name, slug, prices (id, billingInterval, amount, currency)

#### Scenario: No active plans
- **WHEN** any user calls GET /plans and no active plans exist
- **THEN** response returns 200 with empty array

### Requirement: Public List Active Add-ons
The system SHALL provide a public endpoint to list all active add-on packages. The endpoint SHALL return add-on metadata.

#### Scenario: Successful add-on listing
- **WHEN** any user calls GET /addons
- **THEN** system queries AddonPackage table where status=ACTIVE
- **AND** response returns 200 with array of add-ons
- **AND** response includes: add-on id, name, credits, amount, currency

#### Scenario: No active add-ons
- **WHEN** any user calls GET /addons and no active add-ons exist
- **THEN** response returns 200 with empty array
