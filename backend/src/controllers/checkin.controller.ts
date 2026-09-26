import type { Request, Response } from 'express';
import { checkinRepository } from '../repositories/checkin.repository.ts';
import { registrationRepository } from '../repositories/registration.ts';
import { tournamentRepository } from '../repositories/tournament.ts';
import type { AuthenticatedParticipantRequest } from '../middleware/auth.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { fail, ok } from '../utils/response.ts';

/**
 * [SRS 3.1 SV-10, 4.5] Thí sinh thực hiện Check-in ngày thi đấu (Camera QR / GPS).
 */
export const checkin = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401);
  }

  const {
    tournament_id,
    registration_id,
    checkin_method,
    proof_url,
    latitude,
    longitude,
    location_accuracy,
    device_info,
    notes,
  } = req.body;

  if (!tournament_id) {
    return fail(res, 'Thiếu thông tin tournament_id', 400);
  }

  // 1. Kiểm tra giải đấu tồn tại
  const tournament = await tournamentRepository.findById(tournament_id);
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404);
  }

  // 2. Tìm đơn đăng ký của thí sinh
  let regId = registration_id;
  if (!regId) {
    const reg = await registrationRepository.findParticipantRegistrationInTournament(
      tournament_id,
      req.participant.id,
    );
    if (!reg) {
      return fail(res, 'Bạn chưa đăng ký tham gia giải đấu này', 400);
    }
    regId = reg.id;
  }

  // 3. Thực hiện lưu Check-in
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;

  const record = await checkinRepository.recordCheckin({
    tournament_id,
    registration_id: regId,
    participant_id: req.participant.id,
    checkin_method: checkin_method || 'qr_scan',
    proof_url,
    latitude: typeof latitude === 'number' ? latitude : null,
    longitude: typeof longitude === 'number' ? longitude : null,
    location_accuracy: typeof location_accuracy === 'number' ? location_accuracy : null,
    ip_address: ipAddress,
    device_info:
      typeof device_info === 'object' && device_info !== null
        ? JSON.stringify(device_info)
        : device_info || req.headers['user-agent'] || null,
    notes,
  });

  return ok(res, record, '✅ Điểm danh (Check-in) ngày thi đấu thành công!');
});

/**
 * Lấy trạng thái check-in của thí sinh trong một giải đấu.
 */
export const getMyCheckinStatus = asyncHandler(
  async (req: AuthenticatedParticipantRequest, res: Response) => {
    if (!req.participant) {
      return fail(res, 'Yêu cầu đăng nhập sinh viên', 401);
    }

    const { tournament_id } = req.query as { tournament_id?: string };
    if (!tournament_id) {
      return fail(res, 'Thiếu tournament_id', 400);
    }

    const record = await checkinRepository.findByTournamentAndParticipant(
      tournament_id,
      req.participant.id,
    );

    return ok(res, {
      has_checked_in: !!record && record.status === 'approved',
      checkin: record,
    });
  },
);

/**
 * [AD-09] Danh sách check-in của một giải (dành cho Admin / Trọng tài).
 */
export const listByTournament = asyncHandler(async (req: Request, res: Response) => {
  const { tournament_id } = req.query as { tournament_id?: string };
  if (!tournament_id) {
    return fail(res, 'Thiếu tournament_id', 400);
  }

  const rows = await checkinRepository.listByTournament(tournament_id);
  return ok(res, rows);
});
