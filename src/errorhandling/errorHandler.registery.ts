import { ErrorHandlerRegistry } from "./errors.types";
import { AppErrorHandler } from "./handlers/appError.handler";
import { PrismaErrorHandler } from "./handlers/prismaError.handler";
import { UnknownErrorHandler } from "./handlers/unknownError.handler";
import { ZodErrorHandler } from "./handlers/zodError.handler";
import { UnauthorizedErrorHandler } from "./handlers/unauthorizedError.handler";

export const errorHandlerRegistery = new ErrorHandlerRegistry([
  new ZodErrorHandler(),
  new PrismaErrorHandler(),
  new UnauthorizedErrorHandler(),
  new AppErrorHandler(),
  new UnknownErrorHandler(),
]);