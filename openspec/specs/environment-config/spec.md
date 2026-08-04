# environment-config

## Purpose
TBD

## Requirements

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

### Requirement: Environment Variable Loading
The system SHALL load environment variables from .env file using dotenv. The .env file SHALL be read at application startup and variables SHALL be available via ConfigService.

#### Scenario: .env file is loaded automatically
- **WHEN** the application starts
- **THEN** variables from .env file are loaded into process.env
- **AND** ConfigService can access these variables

#### Scenario: Missing .env file does not crash application
- **WHEN** .env file does not exist
- **THEN** the application starts with default or system environment variables
- **AND** no error is thrown (unless required variables are missing)

### Requirement: Environment Template File
The system SHALL provide a .env.example file that documents all required environment variables with placeholder values. The file SHALL serve as a template for developers to create their own .env file.

#### Scenario: .env.example file exists with all variables
- **WHEN** the project is initialized
- **THEN** .env.example exists in the project root
- **AND** contains all required environment variables with placeholder values
- **AND** includes comments explaining each variable

#### Scenario: Developer creates .env from template
- **WHEN** a developer copies .env.example to .env
- **THEN** the .env file contains all required variables
- **AND** the developer can fill in actual values

### Requirement: Required Environment Variables
The system SHALL define and document all required environment variables. Required variables SHALL include database connection, JWT secrets, OAuth credentials, and application port.

#### Scenario: DATABASE_URL is configured
- **WHEN** the application requires database access
- **THEN** DATABASE_URL environment variable is set
- **AND** contains PostgreSQL connection string for Neon

#### Scenario: JWT configuration is present
- **WHEN** authentication features are implemented
- **THEN** JWT_SECRET environment variable is set
- **AND** JWT_EXPIRES_IN environment variable is set (default: 15m)

#### Scenario: Refresh token configuration is present
- **WHEN** token refresh is implemented
- **THEN** REFRESH_TOKEN_SECRET environment variable is set
- **AND** REFRESH_TOKEN_EXPIRES_IN environment variable is set (default: 7d)

#### Scenario: Google OAuth configuration is present
- **WHEN** OAuth authentication is implemented
- **THEN** GOOGLE_CLIENT_ID environment variable is set
- **AND** GOOGLE_CLIENT_SECRET environment variable is set
- **AND** GOOGLE_CALLBACK_URL environment variable is set

#### Scenario: PORT configuration is present
- **WHEN** the application starts
- **THEN** PORT environment variable is set (default: 3000)
- **AND** application listens on the specified port

### Requirement: .env File Exclusion from Version Control
The system SHALL exclude .env file from version control to prevent secrets from being committed. The .gitignore file SHALL include .env entry.

#### Scenario: .env is in .gitignore
- **WHEN** .gitignore is checked
- **THEN** .env entry is present
- **AND** .env file is not tracked by git

#### Scenario: .env.example is tracked by git
- **WHEN** .gitignore is checked
- **THEN** .env.example is NOT in .gitignore
- **AND** .env.example is tracked by git
