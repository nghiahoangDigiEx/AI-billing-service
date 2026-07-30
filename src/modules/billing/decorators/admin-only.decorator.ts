import { UseGuards, applyDecorators } from '@nestjs/common';
import { AdminOnlyGuard } from '../guards/admin-only.guard';

export function AdminOnly() {
  return applyDecorators(UseGuards(AdminOnlyGuard));
}
