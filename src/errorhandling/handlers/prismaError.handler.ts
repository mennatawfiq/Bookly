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
        res.jsend.fail({ message: "A record with this value already exists." }, 409);
        return;

      case "P2025":
        res.jsend.fail({ message: "The requested record was not found." }, 404);
        return;

      case "P2003":
        res.jsend.fail({ message: "The operation violates a related record constraint." }, 400);
        return;

      default:
        res.jsend.error("Database error.", 500);
        return;
    }
  }
};