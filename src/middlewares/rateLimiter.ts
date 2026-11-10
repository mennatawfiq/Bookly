import rateLimit from 'express-rate-limit';
import { AppError } from '../errorhandling/appError';
import { env } from '../config/env';

// Middleware to limit the number of requests from a single IP address within a specified time window.
export const createRateLimiter = (
  minutes = 15,
  limit = 100,
  message = 'Too many requests.',
  skipSuccessfulRequests = false,
) => {
  return rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,

    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,

    handler: (req, res, next) => {
      next(new AppError(429, message));
    },
  });
};

export const loginLimiter = createRateLimiter(
  15,
  env.LOGIN_RATE_LIMIT,
  'Too many login attempts. Please try again later.',
  true,
);
export const registerLimiter = createRateLimiter(
  60,
  env.REGISTER_RATE_LIMIT,
  'Too many registration attempts. Please try again later.',
);
