import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { errorHandlerRegistery } from '../errorhandling/errorHandler.registery';

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  errorHandlerRegistery.handle(err, res);

  if (res.statusCode >= 500) {
    Sentry.captureException(err);
  }
};
