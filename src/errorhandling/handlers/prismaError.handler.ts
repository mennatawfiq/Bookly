import { Response } from "express";
import { Prisma } from "../../../prisma/generated/client";
import { IErrorHandler } from "../errors.types";

export class PrismaErrorHandler implements IErrorHandler {

  canHandle(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError;
  }

  handle(error: unknown, res: Response): void {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;

    switch (prismaError.code) {
      case "P2002":
        res.status(409).json({
          message: "A record with this value already exists."
        });
        return;

      case "P2025":
        res.status(404).json({
          message: "The requested record was not found."
        });
        return;

      case "P2003":
        res.status(400).json({
          message: "The operation violates a related record constraint."
        });
        return;

      default:
        res.status(500).json({
          message: "Database error."
        });
        return;
    }
  }
};