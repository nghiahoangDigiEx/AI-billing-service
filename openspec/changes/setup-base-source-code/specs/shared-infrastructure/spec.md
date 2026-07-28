## ADDED Requirements

### Requirement: Global Exception Filter
The system SHALL provide a GlobalExceptionFilter that implements ExceptionFilter and is applied globally. The filter SHALL catch all unhandled exceptions and return a standardized JSON error response.

#### Scenario: Unhandled exception returns standardized response
- **WHEN** an unhandled exception is thrown in any controller or service
- **THEN** the response body is `{ "statusCode": <number>, "message": <string>, "error": <string> }`
- **AND** the statusCode matches the HTTP exception code (or 500 for unknown)
- **AND** the message is sanitized (no stack traces or internal details)

#### Scenario: HttpException preserves status code
- **WHEN** a NestJS HttpException is thrown (e.g., NotFoundException(404))
- **THEN** the response statusCode matches the exception status
- **AND** the message is taken from the exception

#### Scenario: Unknown exception returns 500
- **WHEN** a non-HttpException error is thrown
- **THEN** the response statusCode is 500
- **AND** the message is "Internal server error"
- **AND** the full error is logged server-side

### Requirement: Event Constants Module
The system SHALL define event constants in src/events/event.constants.ts with typed string constants for cross-module communication. Constants SHALL use past-tense naming convention.

#### Scenario: Event constants file exists
- **WHEN** the project is initialized
- **THEN** src/events/event.constants.ts exists
- **AND** exports event name constants as string values

#### Scenario: Event constants use dot notation
- **WHEN** event constants are defined
- **THEN** format follows `<module>.<action>` pattern (e.g., 'user.registered')
- **AND** actions use past tense (e.g., 'registered', 'updated', 'deleted')

### Requirement: EventEmitter2 Integration
The system SHALL integrate EventEmitter2 for in-process event-driven communication. EventEmitterModule SHALL be imported in AppModule with global availability.

#### Scenario: EventEmitter2 is available application-wide
- **WHEN** the application starts
- **THEN** EventEmitterModule is loaded in AppModule
- **AND** services can inject EventEmitter2 via dependency injection

#### Scenario: Events can be emitted and consumed
- **WHEN** a service emits an event via EventEmitter2
- **THEN** registered listeners receive the event payload
- **AND** the event is processed synchronously within the same process

### Requirement: Global Validation Pipe
The system SHALL configure a global ValidationPipe in main.ts with whitelist, forbidNonWhitelisted, and transform options enabled.

#### Scenario: Validation pipe is applied globally
- **WHEN** the application starts
- **THEN** ValidationPipe is registered via app.useGlobalPipes()
- **AND** all incoming request bodies are validated against DTO decorators

#### Scenario: Unknown properties are stripped
- **WHEN** a request body contains properties not defined in the DTO
- **THEN** those properties are removed before reaching the controller
- **AND** the controller receives only whitelisted properties

#### Scenario: Forbidden properties return 400
- **WHEN** forbidNonWhitelisted is true and unknown properties are present
- **THEN** a 400 Bad Request response is returned
- **AND** validation errors detail which properties are not allowed

#### Scenario: Type transformation is applied
- **WHEN** a request parameter type differs from the DTO property type
- **THEN** the value is automatically transformed to the correct type
- **AND** the controller receives correctly typed values

### Requirement: Swagger API Documentation
The system SHALL integrate @nestjs/swagger with SwaggerModule configured in main.ts. The Swagger UI SHALL be accessible at the /api endpoint.

#### Scenario: Swagger UI is available
- **WHEN** the application is running
- **THEN** Swagger UI is accessible at /api
- **AND** the documentation includes all registered controllers and endpoints

#### Scenario: Swagger document has metadata
- **WHEN** Swagger document is generated
- **THEN** title is set to "Billing Service API"
- **AND** description is set
- **AND** version is set to "1.0"

### Requirement: Source Directory Structure
The system SHALL maintain the following directory structure under src/: common/, events/, modules/, prisma/. Directories SHALL be created during setup even if initially empty.

#### Scenario: Directory structure exists after setup
- **WHEN** the base source code is set up
- **THEN** src/common/ directory exists
- **AND** src/events/ directory exists
- **AND** src/modules/ directory exists
- **AND** src/prisma/ directory exists

#### Scenario: Common subdirectories exist
- **WHEN** the base source code is set up
- **THEN** src/common/filters/ directory exists
- **AND** src/common/decorators/ directory exists
- **AND** src/common/guards/ directory exists

### Requirement: Default Scaffold Removal
The system SHALL remove default NestJS scaffold files that are not part of the application architecture. Files app.controller.ts, app.controller.spec.ts, and app.service.ts SHALL be deleted.

#### Scenario: Default scaffold files are removed
- **WHEN** the base source code is set up
- **THEN** src/app.controller.ts does not exist
- **AND** src/app.controller.spec.ts does not exist
- **AND** src/app.service.ts does not exist

#### Scenario: AppModule does not reference removed files
- **WHEN** AppModule is loaded
- **THEN** no imports reference deleted scaffold files
- **AND** the application starts without errors
