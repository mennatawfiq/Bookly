import { ZodType } from 'zod';

export const jsonResponse = (description: string, schema: ZodType) => ({
  description,
  content: {
    'application/json': { schema },
  },
});
