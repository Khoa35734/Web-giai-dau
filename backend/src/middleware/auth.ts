import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { tournamentOrganizerRepository } from '../repositories/tournamentOrganizer.repository.ts';
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

/**
 * [SRS 5.1] Chấp nhận CẢ admin/CTV token VÀ participant token.
 * Dùng cho upload routes nơi cả hai nhóm đều cần upload file.
 * Gắn decoded vào req.user HOẶC req.participant tùy loại token.
 */
export function verifyAnyToken(
  req: AuthenticatedRequest & AuthenticatedParticipantRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization?.split(' ')[1];
  const queryToken = req.query.token as string | undefined;
  const token = authHeader || queryToken;

  if (!token) {
    res.status(401).json({ success: false, message: 'Token not found' });
    return;
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    if (decoded.kind === 'participant') {
      req.participant = decoded as JwtPayload & { kind: 'participant' };
    } else {
      req.user = decoded;
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

/**
 * [SRS 5.1] Tùy chọn xác thực token. Nếu có token hợp lệ → giải mã req.user / req.participant.
 * Nếu không có token hoặc token hết hạn → vẫn cho phép tiếp tục (dùng cho upload thẻ SV khi đăng ký).
 */
export function optionalVerifyAnyToken(
  req: AuthenticatedRequest & AuthenticatedParticipantRequest,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization?.split(' ')[1];
  const queryToken = req.query.token as string | undefined;
  const token = authHeader || queryToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
      if (decoded.kind === 'participant') {
        req.participant = decoded as JwtPayload & { kind: 'participant' };
      } else {
        req.user = decoded;
      }
    } catch {
      // Ignored for optional token
    }
  }
  next();
}

/**
 * [SRS 4.2] Kiểm tra quyền Admin hoặc Trưởng Ban Tổ Chức (Lead Organizer / Co-Organizer / Creator).
 * Dùng cho các routes điều phối nhân sự BTC giải đấu.
 */
export async function verifyAdminOrLeadOrganizer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập' });
    return;
  }

  // Admin có toàn quyền trên toàn hệ thống
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Lấy tournamentId từ param tournamentId hoặc id
  const rawId = req.params?.tournamentId || req.params?.id;
  const tournamentId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!tournamentId) {
    res.status(400).json({ success: false, message: 'Thiếu mã giải đấu (tournamentId)' });
    return;
  }

  try {
    const roleInfo = await tournamentOrganizerRepository.checkUserOrganizerRole(
      tournamentId,
      req.user.id,
    );

    if (roleInfo.isLeadOrAdmin) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: 'Chỉ Admin hoặc Trưởng Ban Tổ Chức giải đấu mới có quyền điều phối nhân sự BTC',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra quyền hạn: ' + (error as Error).message,
    });
  }
}


