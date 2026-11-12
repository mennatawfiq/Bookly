import * as Sentry from '@sentry/node';
import { env } from '../config/env';

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,

  // Keep automatic Express error capture disabled.
  integrations: [
    Sentry.expressIntegration({
      shouldHandleError: () => false,
    }),
  ],

  // Avoid collecting unnecessary or sensitive request data.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpBodies: [],
    databaseQueryData: false,
    queues: false,
    genAI: {
      inputs: false,
      outputs: false,
    },
    graphQL: {
      document: false,
      variables: false,
    },
  },
});