/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@prisma/client';

jest.setTimeout(30000);

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    // Cleanup before tests
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('/auth/register (POST)', () => {
    it('creates new user and returns user data', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'e2e@example.com',
          password: 'password123',
          name: 'E2E Test',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('email', 'e2e@example.com');
          expect(res.body.data).not.toHaveProperty('password');
        });
    });

    it('rejects duplicate email with 409 status', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'e2e@example.com', password: 'password123' })
        .expect(409);
    });

    it('validates email format and password length', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid-email', password: 'short' })
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    it('with valid credentials returns tokens', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e@example.com', password: 'password123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('refreshToken');
        });
    });

    it('with invalid credentials returns 401 status', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e@example.com', password: 'wrongpassword' })
        .expect(401);
    });
  });

  // Additional tests for refresh, protected endpoints, admin endpoints...
  it('Protected endpoint without JWT returns 401 status', () => {
    return request(app.getHttpServer()).get('/users/me').expect(401);
  });
});
