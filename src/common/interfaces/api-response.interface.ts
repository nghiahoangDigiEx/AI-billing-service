import { ErrorCode } from '../enums';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ErrorCode;
  details?: any;
}
