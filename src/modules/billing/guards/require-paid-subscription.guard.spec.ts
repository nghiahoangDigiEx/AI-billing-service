import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequirePaidSubscriptionGuard } from '@/modules/billing/guards/require-paid-subscription.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import { PLAN_SLUGS } from '@/modules/billing/constants/billing.constants';

describe('RequirePaidSubscriptionGuard', () => {
  let guard: RequirePaidSubscriptionGuard;
  let reflector: Reflector;
  let prismaService: Partial<PrismaService>;
  let mockFindFirst: jest.Mock;

  beforeEach(() => {
    reflector = new Reflector();
    mockFindFirst = jest.fn();
    prismaService = {
      subscription: {
        findFirst: mockFindFirst,
      } as unknown as typeof prismaService.subscription,
    };
    guard = new RequirePaidSubscriptionGuard(
      reflector,
      prismaService as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw ForbiddenException if user is not present', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'User not authenticated',
    );
  });

  it('should throw ForbiddenException if no active subscription is found', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-1' },
        }),
      }),
    } as ExecutionContext;

    mockFindFirst.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Paid subscription required',
    );
  });

  it('should throw ForbiddenException if active subscription is on free plan', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-1' },
        }),
      }),
    } as ExecutionContext;

    mockFindFirst.mockResolvedValue({
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
      plan: { slug: PLAN_SLUGS.FREE },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Paid subscription required',
    );
  });

  it('should return true if active subscription is on paid plan', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-1' },
        }),
      }),
    } as ExecutionContext;

    mockFindFirst.mockResolvedValue({
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
      plan: { slug: PLAN_SLUGS.PRO },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
