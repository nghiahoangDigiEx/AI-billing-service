## Why

The modules in `src/modules/` (especially `billing`, which has grown significantly) currently store controllers, services, and tests in their root folders. This makes the codebase difficult to navigate, maintain, and scale. Refactoring all modules (`billing`, `auth`, `user`) into a consistent layer-based structure will improve code organization and readability while keeping test files co-located with their respective sources according to standard NestJS conventions (Option 2A).

## What Changes

- For every module in `src/modules/` (`billing`, `auth`, `user`):
  - Reorganize all controllers into a `controllers/` subdirectory.
  - Reorganize all services and schedulers into a `services/` subdirectory.
  - Move the corresponding `.spec.ts` files alongside their source files (co-location).
- Update imports in module files (`*.module.ts`) and other files to reflect the new paths across the whole project.

## Capabilities

### New Capabilities

*(None - this is a pure structural refactoring with no new capabilities introduced)*

### Modified Capabilities

*(None - this is a structural refactoring with no requirement changes)*

## Impact

- **Affected code:** All files inside `src/modules/` (`billing`, `auth`, `user`) and any external imports referencing these files.
- **APIs:** No changes to the public API contracts or route endpoints.
- **Dependencies:** No new dependencies.
- **Systems:** No impact on database or external systems.
