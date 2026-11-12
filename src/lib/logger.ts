import { env } from '../config/env';
import pino from 'pino';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',

  base: { service: 'bookly' },

  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'newPassword',
      'confirmPassword',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.passwordHash',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.confirmPassword',

      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },

  ...(env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SUS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});
