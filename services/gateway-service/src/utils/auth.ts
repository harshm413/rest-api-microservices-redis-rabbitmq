import { HttpError, type AuthenticatedUser } from '@rest-api/common';

import type { Request } from 'express';

export const getAuthenticatedUser = (req: Request): AuthenticatedUser => {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  return req.user;
};
