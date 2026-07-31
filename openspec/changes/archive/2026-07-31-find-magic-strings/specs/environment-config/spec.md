## MODIFIED Requirements

### Requirement: ConfigModule Integration
The system SHALL integrate @nestjs/config module with global configuration management. ConfigModule SHALL be imported in AppModule with isGlobal: true flag to make configuration available application-wide. Furthermore, all environment variables MUST be retrieved using type-safe constants rather than hardcoded string keys.

#### Scenario: ConfigModule is initialized at application startup
- **WHEN** the application starts
- **THEN** ConfigModule.forRoot() is loaded in AppModule
- **AND** configuration is available via ConfigService throughout the application

#### Scenario: ConfigModule is globally available
- **WHEN** a feature module needs configuration values
- **THEN** the module can inject ConfigService without importing ConfigModule
- **AND** the service provides access to all environment variables via `CONFIG_KEYS` constants.
