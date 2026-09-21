import { Response } from "express";
import { UnauthorizedError } from "../appError";
import { IErrorHandler } from "../errors.types";

export class UnauthorizedErrorHandler implements IErrorHandler {

  canHandle(error: unknown): boolean {
    return error instanceof UnauthorizedError;
  }

  handle(error: unknown, res: Response): void {
    const unauthorizedError = error as UnauthorizedError;
    res.jsend.error(unauthorizedError.message, unauthorizedError.statusCode);
  }
};