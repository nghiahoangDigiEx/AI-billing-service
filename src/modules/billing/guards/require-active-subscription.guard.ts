import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { ErrorCode } from '../../../common/enums/error-code.enum';

import { User, SubscriptionStatus } from '@prisma/client';

interface AuthenticatedRequest {
  user?: User;
}

@Injectable()
export class RequireActiveSubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'User not authenticated',
        ErrorCode.FORBIDDEN,
      );
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new ForbiddenException(
        'Active subscription required',
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
      );
    }

    return true;
  }
}
