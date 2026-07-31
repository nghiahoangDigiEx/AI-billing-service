import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../../../common/enums/error-code.enum';

import { User, Role } from '@prisma/client';

interface AuthenticatedRequest {
  user?: User;
}

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'User not authenticated',
        ErrorCode.FORBIDDEN,
      );
    }

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Admin access required',
        ErrorCode.FORBIDDEN,
      );
    }

    return true;
  }
}
