import { Response } from "express";

export interface IErrorHandler {
  canHandle(error: unknown): boolean;
  handle(error: unknown, res: Response): void;
}

export class ErrorHandlerRegistry {
  private handlers: IErrorHandler[];

  constructor(handlers: IErrorHandler[]) {
    this.handlers = handlers;
  }

  handle(error: unknown, res: Response) {
    const handler = this.handlers.find((handler) => handler.canHandle(error));

    if (handler) {
      handler.handle(error, res);
    }
  }
};