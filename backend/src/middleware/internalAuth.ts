import { type NextFunction, type Request, type Response } from 'express';
import config from '../config';

/**
 * Guards internal service-to-service endpoints (e.g. the Discord bot calling the
 * backend). Requires the `x-internal-secret` header to match a configured,
 * non-empty INTERNAL_API_SECRET. Fails closed when the secret is unset.
 */
export const internalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const secret = req.header('x-internal-secret');

  if (config.internalApiSecret === '' || secret !== config.internalApiSecret) {
    return res.status(401).json({ message: 'Invalid internal authorization.' });
  }

  next();
};
