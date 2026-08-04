## ADDED Requirements

### Requirement: Freeze Add-ons on Downgrade to Free
The system SHALL freeze all active add-on credit balances when a user downgrades from a paid plan to Free plan. Frozen add-ons preserve remaining credits but cannot be consumed.

#### Scenario: User downgrades to Free plan
- **WHEN** customer.subscription.deleted webhook is processed (Pro subscription cancelled)
- **AND** system creates new Free subscription
- **THEN** system updates all CreditBalance records where userId=user.id AND source=ADDON AND status=ACTIVE
- **AND** system sets status=FROZEN for each record
- **AND** system sets frozenAt=now() for each record (on CreditBalance record)
- **AND** system preserves remainingCredits value (no credits lost)
- **AND** system emits addon.frozen event with userId

#### Scenario: No active add-ons to freeze
- **WHEN** user downgrades to Free plan
- **AND** user has no ACTIVE CreditBalance records with source=ADDON
- **THEN** system performs no add-on updates
- **AND** system does NOT emit addon.frozen event

#### Scenario: Already frozen add-ons
- **WHEN** user downgrades to Free plan
- **AND** user has FROZEN CreditBalance records with source=ADDON (from previous downgrade)
- **THEN** system does NOT update already-frozen records
- **AND** frozenAt timestamp remains unchanged

### Requirement: Unfreeze Add-ons on Re-subscribe to Paid Plan
The system SHALL unfreeze all frozen add-on credit balances when a user re-subscribes from Free plan to a paid plan. Unfrozen add-ons become consumable again.

#### Scenario: User re-subscribes to paid plan
- **WHEN** invoice.paid webhook is processed for a subscription
- **AND** local subscription had status=PAST_DUE (indicating recovery)
- **THEN** system updates all CreditBalance records where userId=user.id AND source=ADDON AND status=FROZEN
- **AND** system sets status=ACTIVE for each record
- **AND** system sets unfrozenAt=now() for each record (on CreditBalance record)
- **AND** system preserves remainingCredits value
- **AND** system emits addon.unfrozen event with userId

#### Scenario: No frozen add-ons to unfreeze
- **WHEN** user re-subscribes to paid plan
- **AND** user has no FROZEN CreditBalance records with source=ADDON
- **THEN** system performs no add-on updates
- **AND** system does NOT emit addon.unfrozen event

#### Scenario: Multiple re-subscribe cycles
- **WHEN** user downgrades and re-subscribes multiple times
- **THEN** add-ons are frozen and unfrozen each time
- **AND** frozenAt and unfrozenAt timestamps track each cycle
- **AND** remainingCredits is preserved across all cycles

### Requirement: Frozen Add-ons Cannot Be Consumed
The system SHALL prevent credit consumption from frozen add-on credit balances. Only ACTIVE add-on credits can be used.

#### Scenario: Attempt to consume frozen add-on credits
- **WHEN** user with FROZEN add-on attempts to consume credits
- **AND** user is on Free plan (add-ons are frozen)
- **THEN** system excludes FROZEN CreditBalance records with source=ADDON from consumption query
- **AND** system only consumes from monthly credit balance
- **AND** if monthly balance insufficient: system returns 402 "Insufficient credits"

#### Scenario: Consumption query filters by status
- **WHEN** system queries add-ons for credit consumption
- **THEN** query on CreditBalance includes WHERE source=ADDON AND status=ACTIVE
- **AND** query excludes status=FROZEN and status=EXHAUSTED
- **AND** query orders by purchasedAt ASC (oldest first)

### Requirement: Add-on Freeze/Unfreeze Events
The system SHALL emit events when add-ons are frozen or unfrozen to enable cross-module communication.

#### Scenario: Addon frozen event
- **WHEN** add-ons are frozen during downgrade
- **THEN** system emits event with name 'addon.frozen'
- **AND** event payload contains: { userId, frozenCount }
- **AND** event is emitted via EventEmitter2

#### Scenario: Addon unfrozen event
- **WHEN** add-ons are unfrozen during re-subscribe
- **THEN** system emits event with name 'addon.unfrozen'
- **AND** event payload contains: { userId, unfrozenCount }
- **AND** event is emitted via EventEmitter2

#### Scenario: Event listeners receive events
- **WHEN** addon.frozen or addon.unfrozen event is emitted
- **THEN** registered event listeners receive the event payload
- **AND** listeners can perform side effects (logging, notifications, etc.)
- **AND** event processing is synchronous within the same process
