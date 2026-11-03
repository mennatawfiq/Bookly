import type { AuthenticatedUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser; // user is optional because there are requests that don't require userId like /login
    }
  }
}
