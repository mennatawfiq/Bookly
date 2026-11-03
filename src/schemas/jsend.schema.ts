import { z } from 'zod';

export const jsendSuccess = <T extends z.ZodType>(data: T) =>
  z.object({
    status: z.literal('success'),
    data,
  });

export const jsendFail = <T extends z.ZodType>(data: T) =>
  z.object({
    status: z.literal('fail'),
    data,
  });

export const jsendError = z.object({
  status: z.literal('error'),
  message: z.string(),
});

export const failMessage = z.object({ message: z.string() });

export const validationFail = z.object({
  message: z.string(),
  errors: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
    }),
  ),
});
