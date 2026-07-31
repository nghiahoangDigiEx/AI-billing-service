import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';
import { Request } from 'express';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip formatting for Stripe webhooks since Stripe expects a standard HTTP response
    if (request.url.includes('/webhooks/stripe')) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        // If data is already in ApiResponse format or is undefined, return as is
        // Some responses might not have data, we just wrap them as { success: true }
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        return {
          success: true,
          data: data as T,
        };
      }),
    );
  }
}
