import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errorhandling/appError';
import prisma from '../lib/prisma';
import { asyncHandler } from './asyncHandler';
import { RequireOwnershipConfig } from '../types/auth';

export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!req.headers.authorization) {
    return next();
  }

  return authenticate(req, res, next);
};

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
      throw new AppError(401, 'Authentication required');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'Invalid authorization header');
    }

    let userId: string;

    try {
      const result = jwt.verify(token, env.JWT_SECRET);

      if (typeof result !== 'object' || result === null || typeof result.sub !== 'string') {
        throw new AppError(401, 'Invalid token');
      }

      userId = result.sub;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(401, 'Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        role: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'User not found');
    }

    req.user = { id: userId, role: user.role };

    next();
  },
);

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return next(new AppError(403, 'You do not have permission to perform this action'));
    }

    next();
  };
};

export const requireOwnership = <T extends Record<string, unknown>>(
  config: RequireOwnershipConfig<T>,
) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === 'ADMIN') {
      return next();
    }

    const resourceId = req.params[config.paramName];

    if (typeof resourceId !== 'string') {
      throw new AppError(400, `Invalid ${config.resourceName} id`);
    }

    const resource = await config.model.findUnique({
      where: { id: resourceId! },
    });

    if (!resource) {
      throw new AppError(404, `${config.resourceName} not found`);
    }

    const user = req.user;

    if (!user) {
      throw new AppError(401, 'Authentication required');
    }

    if (config.alsoAllow && (await config.alsoAllow(resource, user))) {
      return next();
    }

    if (resource[config.ownerField] === req.user?.id) {
      return next();
    }

    throw new AppError(404, `${config.resourceName} not found`);
  });
};
