import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";
import { asyncHandler } from "./asyncHandler";

export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

  const authorization = req.headers.authorization;

  if (!authorization) {
    throw new AppError(401, "Authentication required");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "Invalid authorization header");
  }

  let userId: string;

  try {
    const result = jwt.verify(token, env.JWT_SECRET);

    if (typeof result !== "object" || result === null || typeof result.sub !== "string") {
      throw new AppError(401, "Invalid token");
    }

    userId = result.sub;

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
    },
  });

  if (!user) {
    throw new AppError(401, "User not found");
  }

  req.user = { id: userId, role: user.role };

  next();
});

export const authorize = (...roles: string[]) => {

  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return next(new AppError(403, "You do not have permission to perform this action"));
    }

    next();
  }

}