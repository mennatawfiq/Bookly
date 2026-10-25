import { z } from "zod";

export const OffsetPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type OffsetPaginationQuery = z.infer<typeof OffsetPaginationQuerySchema>;

export const PaginationSchema = z.object({
  page: z.int().min(1).meta({ example: 1 }),
  limit: z.int().min(1).max(100).meta({ example: 10 }),
  totalItems: z.int().min(0).meta({ example: 42 }),
  totalPages: z.int().min(0).meta({ example: 5 }),
  hasNextPage: z.boolean().meta({ example: true }),
  hasPreviousPage: z.boolean().meta({ example: false }),
});