---
name: nestjs-framework
description: Use when creating modules, controllers, services, guards, filters, interceptors, or structuring NestJS application code
---

# NestJS Framework

## Purpose

Covers NestJS v11 framework usage for building a modular monolith with layered architecture, dependency injection, and HTTP API endpoints.

## Why This Technology

**Confirmed Decision:** NestJS provides the structural foundation for an event-driven modular monolith with clear separation of concerns, built-in dependency injection, and extensibility points for guards, filters, and interceptors.

## Confirmed Decisions

### Architecture Style
- **Event-driven modular monolith** with layered internals
- **Dependency direction**: Controller → Service → Repository (Prisma) → Database
- **Three bounded modules**: User, Billing, Credit
- **Global PrismaService** provided via PrismaModule
- **Global ValidationPipe** applied in main.ts
- **Global ExceptionFilter** translates domain exceptions to HTTP responses

### Module Organization
```
src/modules/{module}/
├── dto/              # Request/response DTOs with validation
├── entities/         # Prisma model types (generated)
├── {module}.controller.ts
├── {module}.service.ts
├── {module}.module.ts
└── {module}.spec.ts  # Unit tests
```

### Folder Structure
```
src/
├── common/           # Shared utilities, guards, filters, interceptors
├── modules/          # Bounded modules (user, billing, credit)
├── prisma/           # Prisma schema and service
└── events/           # Event type definitions
```

### Naming Conventions
- Controllers: `{resource}.controller.ts`
- Services: `{resource}.service.ts`
- DTOs: `create-{resource}.dto.ts`, `update-{resource}.dto.ts`
- Events: past tense (e.g., `user.registered`, `subscription.created`)

## Recommended Conventions

### Controller Pattern
```typescript
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
```

### Service Pattern
```typescript
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

### Module Pattern
```typescript
@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

## Integration Boundaries

### Controllers
- Handle HTTP concerns only (parsing requests, guards, response formatting)
- **Never** contain business logic
- Delegate all work to services

### Services
- Contain all domain logic and orchestration
- Access database via PrismaService
- Emit events via EventEmitter2
- **Never** call other modules' services directly

### Cross-Module Communication
- Modules emit events, never import other modules' services
- Use EventEmitter2 for event-driven communication
- Event handlers are idempotent

## Things AI Should Avoid

- Putting business logic in controllers
- Direct service-to-service calls across modules
- Creating circular dependencies between modules
- Using raw SQL instead of Prisma
- Hardcoding configuration values (use ConfigModule)
- Creating new modules when extending existing ones is possible
- Using inheritance over composition and dependency injection

## Verification

```bash
npm run build
npm run lint
npm run typecheck
npm run test
```
