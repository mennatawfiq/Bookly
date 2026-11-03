import { Request, Response, NextFunction } from 'express';
import { errorHandlerRegistery } from '../errorhandling/errorHandler.registery';

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  errorHandlerRegistery.handle(err, res);
};
