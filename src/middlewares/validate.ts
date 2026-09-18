import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
import { AppError } from "../errorhandling/appError";

export const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(result.error);
    }

    req.body = result.data;
    next();
  }
}