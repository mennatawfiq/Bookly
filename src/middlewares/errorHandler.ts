import { Request, Response, NextFunction } from "express";

export class AppError extends Error {

  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
};

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal server error"
  });

};