import { Response } from "express";
import { IErrorHandler } from "../errors.types";

export class UnknownErrorHandler implements IErrorHandler {

  canHandle(error: unknown): boolean {
    return true;
  }

  handle(error: unknown, res: Response): void {
    res.status(500).json({
      message: "Internal server error."
    });
  }
};