import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import type { JwtPayload } from '../types/index.ts';

/** Request đã được xác thực — có kèm thông tin user (giải mã từ JWT). */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/** Request đã được xác thực cho participant. */
export interface AuthenticatedParticipantRequest extends Request {
  participant?: JwtPayload & { kind: 'participant' };
}

/** Xác thực JWT Bearer token. */
export function verifyToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, message: 'Token not found' });
    return;
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    if (decoded.kind === 'participant') {
      res.status(403).json({ success: false, message: 'Token participant không hợp lệ cho route này' });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

/** Xác thực JWT Bearer token cho participant. */
export function verifyParticipantToken(
  req: AuthenticatedParticipantRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, message: 'Token not found' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    if (decoded.kind !== 'participant') {
      res.status(403).json({ success: false, message: 'Token user không hợp lệ cho route này' });
      return;
    }
    req.participant = decoded as JwtPayload & { kind: 'participant' };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

/** Chỉ CTV mới được qua. */
export function verifyCTV(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ctv') {
    res.status(403).json({ success: false, message: 'Chỉ CTV mới có quyền truy cập' });
    return;
  }
  next();
}

/** Chỉ Admin mới được qua. */
export function verifyAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền truy cập' });
    return;
  }
  next();
}
