---
name: testing-strategy
description: Use when writing unit tests, integration tests, E2E tests, mocking Stripe or Prisma, or verifying billing flows
---

# Testing Strategy

## Purpose

Covers Jest and @nestjs/testing usage for unit tests, integration tests, and E2E tests. Includes mocking patterns for Prisma, Stripe, and event-driven flows.

## Why This Technology

**Confirmed Decision:** Jest with @nestjs/testing provides a layered testing strategy — unit tests with mocks for isolation, integration tests with a test database and mocked Stripe responses, and E2E tests for full HTTP request/response cycles.

## Confirmed Decisions

### Testing Layers
- **Unit tests** (`*.spec.ts`): Mock Prisma, mock Stripe, test services in isolation
- **Integration tests**: Test database, mock Stripe API responses, test full request flows
- **E2E tests** (`*.e2e-spec.ts`): Full HTTP request/response cycles via Supertest

### Required Coverage
- All service methods
- All critical billing flows (subscription lifecycle, payment failure, credit reset)
- All webhook event handlers
- All guards and interceptors

### Integration Testing
- Use separate test database
- Mock Stripe API with predictable responses
- Test webhook processing with fixture payloads
- Verify event flow between modules

### CI Gate
```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npx prisma validate
```

No `console.log` or `debugger` statements allowed.

## Recommended Conventions

### Unit Test: Service with Mocked Prisma
```typescript
describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);
  });

  it('should find user by id', async () => {
    const user = { id: '1', email: 'a@b.com' };
    prisma.user.findUnique.mockResolvedValue(user);

    expect(await service.findOne('1')).toEqual(user);
  });
});
```

### Unit Test: Mocked Stripe Adapter
```typescript
describe('BillingService', () => {
  let service: BillingService;
  let stripeAdapter: jest.Mocked<PaymentProviderAdapter>;

  beforeEach(async () => {
    stripeAdapter = {
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: PaymentProviderFactory, useValue: { getAdapter: () => stripeAdapter } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(BillingService);
  });
});
```

### E2E Test Pattern
```typescript
describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/users (POST)', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'test@example.com', password: 'secure123' })
      .expect(201);
  });
});
```

### Webhook Fixture Testing
```typescript
it('should process invoice.paid webhook', async () => {
  const fixture = {
    id: 'evt_test_123',
    type: 'invoice.paid',
    data: { object: { subscription: 'sub_123' } }
  };

  await service.processWebhookEvent(fixture);

  expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: { stripeEventId: 'evt_test_123' } })
  );
});
```

### Test File Location
- Unit tests: alongside source files as `{resource}.spec.ts`
- E2E tests: `test/` directory as `{feature}.e2e-spec.ts`
- Test config: `test/jest-e2e.json`

## Things AI Should Avoid

- Testing controllers directly in unit tests (test services instead)
- Calling real Stripe API in tests (always mock)
- Using the production database for integration tests
- Skipping event emission assertions in billing tests
- Using `any` type for mocks when typed mocks are available
- Leaving `console.log` or `debugger` in test files
- Forgetting to close the app in E2E `afterEach`

## Verification

```bash
npm run test
npm run test:e2e
npm run test:cov
```
