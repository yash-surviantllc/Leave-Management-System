import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function getPagination(query: PaginationQuery): Pagination {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function getPaginationMeta(input: {
  total: number;
  pagination: Pagination;
}): Record<string, unknown> {
  return {
    total: input.total,
    page: input.pagination.page,
    pageSize: input.pagination.pageSize,
    totalPages: Math.ceil(input.total / input.pagination.pageSize),
    pagination: {
      total: input.total,
      page: input.pagination.page,
      pageSize: input.pagination.pageSize,
      totalPages: Math.ceil(input.total / input.pagination.pageSize)
    }
  };
}
