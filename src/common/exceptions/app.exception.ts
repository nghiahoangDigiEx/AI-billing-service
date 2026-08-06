import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@/common/enums';

export class AppException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message?: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message || errorCode, status);
  }
}
