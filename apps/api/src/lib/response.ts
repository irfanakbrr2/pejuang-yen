import type { Context } from 'hono';
import type { ApiResponse, PaginatedResponse } from '@growwithai/shared';

export function success<T>(c: Context, data: T, status: number = 200) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json<ApiResponse<T>>({ success: true, data }, status as any);
}

export function error(c: Context, message: string, status: number = 400, errorType?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json<ApiResponse>({ success: false, error: message, errorType } as any, status as any);
}

export function paginated<T>(
  c: Context,
  data: T[],
  pagination: { page: number; limit: number; total: number }
) {
  return c.json<PaginatedResponse<T>>({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}
