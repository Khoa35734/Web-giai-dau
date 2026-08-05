import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Bọc async route handler — mọi Promise bị reject đều được chuyển
 * xuống error middleware thay vì crash server.
 */
export const asyncHandler =
  <R extends Request = Request>(
    fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as R, res, next)).catch(next);
  };
