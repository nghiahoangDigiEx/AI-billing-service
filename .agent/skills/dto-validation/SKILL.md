---
name: dto-validation
description: Use when creating request/response DTOs, implementing input validation, or configuring API documentation with Swagger decorators
---

# DTO Validation

## Purpose

Covers class-validator and class-transformer usage for input validation, DTO design patterns, and @nestjs/swagger integration for automatic API documentation.

## Why This Technology

**Confirmed Decision:** class-validator provides declarative validation decorators that integrate with NestJS's global ValidationPipe. class-transformer handles serialization/deserialization. @nestjs/swagger decorators generate OpenAPI documentation automatically from DTO definitions.

## Confirmed Decisions

### Validation Strategy
- **Global ValidationPipe**: Applied in main.ts for all endpoints
- **class-validator decorators**: All DTOs use validation decorators
- **@nestjs/swagger decorators**: All DTOs use Swagger decorators for API documentation
- **Input validation**: All external input validated with class-validator

### DTO Location
- DTOs stored in `src/modules/{module}/dto/` directory
- Naming convention: `create-{resource}.dto.ts`, `update-{resource}.dto.ts`

### Security Requirements
- Validate all external input before processing
- Sanitize error messages — never expose internal details to clients
- Standardized error response format via global ExceptionFilter

## Recommended Conventions

### DTO Structure
```typescript
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;
}
```

### Update DTO with PartialType
```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

### Response DTO
```typescript
export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  createdAt: Date;
}
```

### Nested Validation
```typescript
export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  planId: string;

  @ApiProperty({ type: () => PaymentMethodDto })
  @ValidateNested()
  @Type(() => PaymentMethodDto)
  paymentMethod: PaymentMethodDto;
}

export class PaymentMethodDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  cardHolderName: string;
}
```

### Custom Validation
```typescript
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsPositiveAmount(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPositiveAmount',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return typeof value === 'number' && value > 0;
        },
      },
    });
  };
}
```

## Integration Boundaries

### Controller Usage
```typescript
@Controller('users')
export class UsersController {
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }
}
```

### Validation Pipe Configuration
```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  
  await app.listen(3000);
}
```

## Things AI Should Avoid

- Skipping validation decorators on DTO properties
- Using plain interfaces instead of classes for DTOs
- Forgetting @Type() decorator for nested objects
- Exposing internal error details in validation responses
- Creating DTOs without Swagger decorators
- Using validation groups unnecessarily
- Validating in services instead of at the controller boundary
- Not using PartialType for update DTOs

## Verification

```bash
npm run test
npm run build
# Check Swagger UI at http://localhost:3000/api
```
