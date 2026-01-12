import type { AuthenticatedUser } from '@rest-api/common';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
