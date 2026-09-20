import { AppError } from "../appError";
import { IErrorHandler } from "../errors.types";
import { Response } from "express";

export class AppErrorHandler implements IErrorHandler {

  canHandle(error: unknown): boolean {
    return error instanceof AppError;
  }

  handle(error: unknown, res: Response): void {
    const appError = error as AppError;

    res.status(appError.statusCode).json({
      message: appError.message
    });

  }
};