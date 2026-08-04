## ADDED Requirements

### Requirement: AddonPackage Entity
The system SHALL maintain an AddonPackage entity representing one-time credit pack add-ons. Each add-on package SHALL map to a Stripe Product and Price, and define the credit amount and price.

#### Scenario: AddonPackage record structure
- **WHEN** an add-on package is created in the database
- **THEN** the AddonPackage table contains fields: id, stripeProductId, stripePriceId, name, credits, amount (in cents), currency, status (ACTIVE, INACTIVE), createdAt, updatedAt
- **AND** stripeProductId references the corresponding Stripe Product ID
- **AND** stripePriceId references the corresponding Stripe Price ID (one-time, not recurring)
- **AND** credits is the number of credits included in the pack

#### Scenario: AddonPackage status values
- **WHEN** an add-on package status is queried
- **THEN** status is one of: ACTIVE (available for purchase), INACTIVE (archived, not available for new purchases)
- **AND** existing AddonPurchase records remain valid regardless of package status

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

#### Scenario: Admin role required
- **WHEN** non-admin user calls POST /admin/addons
- **THEN** system returns 403 Forbidden
- **AND** no Stripe API calls are made

### Requirement: Admin Update Add-on Package
The system SHALL provide an admin-only endpoint to update add-on package metadata (name). The endpoint SHALL update the Stripe Product and local database record.

#### Scenario: Successful add-on update
- **WHEN** admin calls PATCH /admin/addons/:id with updated name
- **THEN** system calls Stripe API to update Product name
- **AND** system updates local AddonPackage record
- **AND** response returns 200 with updated AddonPackage record

#### Scenario: Add-on not found
- **WHEN** admin calls PATCH /admin/addons/:id with non-existent add-on ID
- **THEN** system returns 404 Not Found
- **AND** no Stripe API calls are made

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

### Requirement: Add-on Purchase
The system SHALL provide an endpoint for users to purchase one-time credit pack add-ons. Purchase is restricted to users with active paid subscriptions.

#### Scenario: Successful add-on purchase
- **WHEN** user with ACTIVE Pro subscription calls POST /addons/:id/purchase
- **THEN** system validates user has active paid subscription (not Free)
- **AND** system calls Stripe API to create PaymentIntent with metadata={userId, addonPackageId}
- **AND** system returns 202 Accepted with message "Payment initiated, webhook will confirm"
- **AND** system does NOT insert AddonPurchase or CreditBalance records yet (waits for payment_intent.succeeded webhook)

#### Scenario: User on Free plan
- **WHEN** user with ACTIVE Free subscription calls POST /addons/:id/purchase
- **THEN** system returns 403 Forbidden with error message "Add-on purchase requires active paid subscription"
- **AND** no Stripe API calls are made
- **AND** no AddonPurchase record is created

#### Scenario: User with PAST_DUE subscription
- **WHEN** user with PAST_DUE subscription calls POST /addons/:id/purchase
- **THEN** system returns 403 Forbidden with error message "Cannot purchase add-ons while subscription is past due"
- **AND** no Stripe API calls are made

#### Scenario: Add-on not found or inactive
- **WHEN** user calls POST /addons/:id/purchase with non-existent or INACTIVE add-on ID
- **THEN** system returns 404 Not Found or 400 Bad Request
- **AND** no Stripe API calls are made

### Requirement: AddonPurchase Entity
The system SHALL maintain an AddonPurchase entity representing a user's purchase of a credit pack add-on. Each purchase SHALL track the Stripe PaymentIntent and purchase metadata. Credits are stored in CreditBalance table.

#### Scenario: AddonPurchase record structure
- **WHEN** an add-on is purchased
- **THEN** the AddonPurchase table contains fields: id, userId, addonPackageId, stripePaymentIntentId, createdAt
- **AND** userId is a foreign key to User
- **AND** addonPackageId is a foreign key to AddonPackage
- **AND** stripePaymentIntentId references the Stripe PaymentIntent ID for the purchase
- **AND** credits are stored in CreditBalance table (source=ADDON, sourceRef=addonPurchaseId)

### Requirement: User View Add-on Purchases
The system SHALL provide an endpoint for users to view their add-on purchase history and current credit balances.

#### Scenario: View active add-ons
- **WHEN** user calls GET /addons/purchases
- **THEN** system queries CreditBalance table where userId=user.id AND source=ADDON AND status IN (ACTIVE, FROZEN)
- **AND** response returns 200 with array of add-on credit balances
- **AND** each record includes: add-on name (from AddonPackage), totalCredits, remainingCredits, status, purchasedAt

#### Scenario: View add-on history
- **WHEN** user calls GET /addons/purchases/history
- **THEN** system queries all CreditBalance records where source=ADDON for user (including EXHAUSTED)
- **AND** response returns 200 with array ordered by purchasedAt DESC
