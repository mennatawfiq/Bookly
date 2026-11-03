import { Response } from 'express';
import { IErrorHandler } from '../errors.types';

export class UnknownErrorHandler implements IErrorHandler {
  canHandle(_error: unknown): boolean {
    return true;
  }

  handle(_error: unknown, res: Response): void {
    res.jsend.error('Internal server error.', 500);
  }
}
