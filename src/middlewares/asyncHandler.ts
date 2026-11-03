import { Request, Response, NextFunction } from 'express';

// catches error to avoid repetitive try/catch block in each controller
// more formally, catches rejected promises from controllers
export const asyncHandler = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
};
