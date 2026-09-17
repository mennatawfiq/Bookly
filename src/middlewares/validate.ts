import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
import { AppError } from "./errorHandler";

export const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(new AppError(400, result.error.issues.map((issue) => issue.message).join(',')));
    }

    req.body = result.data;
    next();
  }
}