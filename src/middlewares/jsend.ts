import { Request, Response, NextFunction } from 'express';

export type JSendSuccess<T> = {
  status: 'success';
  data: T;
};

export type JSendFail<T> = {
  status: 'fail';
  data: T;
};

export type JSendError = {
  status: 'error';
  message: string;
};

export type JSend = {
  success: <T>(data: T, statusCode?: number) => Response;
  fail: <T>(data: T, statusCode?: number) => Response;
  error: (message: string, statusCode?: number) => Response;
};

declare global {
  namespace Express {
    interface Response {
      jsend: JSend;
    }
  }
}

export const jsend = (req: Request, res: Response, next: NextFunction) => {
  res.jsend = {
    success: <T>(data: T, statusCode = 200) => {
      return res.status(statusCode).json({
        status: 'success',
        data,
      });
    },
    fail: <T>(data: T, statusCode = 400) => {
      return res.status(statusCode).json({
        status: 'fail',
        data,
      });
    },
    error: (message: string, statusCode = 500) => {
      return res.status(statusCode).json({
        status: 'error',
        message,
      });
    },
  };

  next();
};
