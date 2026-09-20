import { ZodError } from "zod";
import { IErrorHandler } from "../errors.types";
import { Response } from "express";


export class ZodErrorHandler implements IErrorHandler {

  canHandle(error: unknown): boolean {
    return error instanceof ZodError;
  }

  handle(error: unknown, res: Response): void {
    const zodError = error as ZodError;

    res.jsend.fail(
      {
        message: "Validation failed.",
        errors: zodError.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      },
      400
    );
  }

};