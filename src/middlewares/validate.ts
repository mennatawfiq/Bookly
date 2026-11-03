import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

export const validate = (schema: ZodType, source: 'body' | 'params' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(result.error);
    }

    req[source] = result.data;
    next();
  };
};
