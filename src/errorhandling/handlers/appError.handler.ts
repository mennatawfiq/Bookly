import { AppError } from '../appError';
import { IErrorHandler } from '../errors.types';
import { Response } from 'express';

export class AppErrorHandler implements IErrorHandler {
  canHandle(error: unknown): boolean {
    return error instanceof AppError;
  }

  handle(error: unknown, res: Response): void {
    const appError = error as AppError;

    if (appError.status === 'fail') {
      res.jsend.fail({ message: appError.message }, appError.statusCode);
      return;
    }

    res.jsend.error(appError.message, appError.statusCode);
  }
}
