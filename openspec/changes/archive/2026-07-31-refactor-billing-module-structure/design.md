## Context

Modules in `src/modules/` (such as `billing`, `auth`, `user`) currently contain flat files in their root folders. This makes navigation difficult, particularly for larger modules like `billing`. We need to restructure all modules to maintain a consistent architecture without changing any business logic.

## Goals / Non-Goals

**Goals:**
- Move controllers across all modules into `controllers/` subdirectories
- Move services and schedulers across all modules into `services/` subdirectories
- Keep `.spec.ts` files adjacent to their implementations
- Ensure the application builds and tests pass

**Non-Goals:**
- Splitting the modules into sub-modules
- Changing any underlying business logic
- Creating a separate `tests/` directory (opting for co-location instead)

## Decisions

- **Layer-based Structure:** Decided to use a layer-based structure (`controllers/`, `services/`) consistently across all modules because the user explicitly preferred Option 2A (Layer-based with co-located tests).
- **Test Co-location:** Decided to keep `.spec.ts` files adjacent to the source files as this is the standard NestJS convention and makes unit testing navigation simpler.
- **Consistent Application:** Applying this refactoring to all modules (`auth`, `user`) despite them being smaller, to ensure codebase consistency.

## Risks / Trade-offs

- **Risk:** Missing relative import updates could cause build failures.
  - **Mitigation:** Run `npm run typecheck` and `npm run build` after moving files to catch import errors.
- **Trade-off:** A layer-based structure means files related to the same domain (e.g., webhook controller and webhook service) are now in different directories. This is an acceptable trade-off for the current scale and aligns with user preference.
