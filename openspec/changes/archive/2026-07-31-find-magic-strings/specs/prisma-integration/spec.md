## MODIFIED Requirements

### Requirement: Prisma ORM Integration
The system SHALL integrate Prisma ORM as the database layer for PostgreSQL (Neon). PrismaClient SHALL be wrapped in a PrismaService that implements OnModuleInit for automatic connection establishment. Furthermore, business logic MUST NOT use raw string literals (e.g. `'ACTIVE'`, `'INACTIVE'`) to represent database ENUM types; instead, the generated enum objects exported by `@prisma/client` (e.g. `PlanStatus.ACTIVE`) SHALL be explicitly used to ensure compile-time safety and refactoring resilience.

#### Scenario: Application starts with database connection
- **WHEN** the application starts
- **THEN** PrismaService connects to the PostgreSQL database using DATABASE_URL
- **AND** the connection is established before any module initialization completes

#### Scenario: Prisma client is generated
- **WHEN** `npx prisma generate` is executed
- **THEN** Prisma client files are generated in node_modules/@prisma/client
- **AND** the client is available for import throughout the application

#### Scenario: Service queries use generated Enums
- **WHEN** business logic issues a query filtering by an enum state
- **THEN** it explicitly uses the `@prisma/client` enum value rather than a string literal
