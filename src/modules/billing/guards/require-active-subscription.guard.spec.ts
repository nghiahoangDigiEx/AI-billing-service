import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequireActiveSubscriptionGuard } from '@/modules/billing/guards/require-active-subscription.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

describe('RequireActiveSubscriptionGuard', () => {
  let guard: RequireActiveSubscriptionGuard;
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
    guard = new RequireActiveSubscriptionGuard(
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

    (prismaService.subscription!.findFirst as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Active subscription required',
    );
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
      },
    });
  });

  it('should return true if active subscription is found', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-1' },
        }),
      }),
    } as ExecutionContext;

    (prismaService.subscription!.findFirst as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
