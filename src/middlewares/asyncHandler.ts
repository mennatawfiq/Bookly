import { Request, Response, NextFunction } from "express";

// async handler: catches error to avoid repetitive try/catch block in each controller
export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
};