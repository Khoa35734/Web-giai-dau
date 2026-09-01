import type { Response } from 'express';
import type { AuthenticatedParticipantRequest, AuthenticatedRequest } from '../middleware/auth.ts';
import {
  getTournamentFormSchema,
  registrationRepository,
} from '../repositories/registration.ts';
import { tournamentRepository } from '../repositories/tournament.ts';
import type { RegistrationStatus } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { paramId } from '../utils/param.ts';
import { created, fail, ok } from '../utils/response.ts';

interface RegistrationBody {
  tournament_id?: string;
  form_data?: Record<string, unknown>;
  submitted_data?: Record<string, unknown>;
  team_name?: string;
  member_ids?: string[];
}

function normalizeSubmittedData(body: RegistrationBody): Record<string, unknown> {
  return body.submitted_data ?? body.form_data ?? {};
}

function validateRequiredFields(formSchema: Awaited<ReturnType<typeof getTournamentFormSchema>>, formData: Record<string, unknown>): string | null {
  for (const field of formSchema.filter((f) => f.required)) {
    const val = formData[field.id];
    if (!val || String(val).trim() === '') {
      return `Truong "${field.label}" la bat buoc`;
    }
  }
  return null;
}

/** Đăng ký tham gia giải đấu bằng participant token. */
export const create = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const { tournament_id } = req.body as RegistrationBody;
  const submittedData = normalizeSubmittedData(req.body as RegistrationBody);

  if (!tournament_id) {
    return fail(res, 'Thiếu tournament_id', 400);
  }

  if (!req.participant) {
    return fail(res, 'Thiếu thông tin người đăng ký', 401);
  }

  const tournament = await tournamentRepository.findById(tournament_id);
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404);
  }

  const formSchema = await getTournamentFormSchema(tournament_id);
  const validationError = validateRequiredFields(formSchema, submittedData);
  if (validationError) {
    return fail(res, validationError, 400);
  }

  const memberIds = Array.isArray(req.body.member_ids) ? req.body.member_ids : [];
  try {
    const registration = await registrationRepository.createTeamRegistration({
      tournament_id,
      captain_id: req.participant.id,
      team_name: req.body.team_name?.trim() || null,
      submitted_data: submittedData,
      member_ids: memberIds,
      is_auto_matched: false,
    });

    return created(res, registration, 'Dang ky thanh cong! Vui long cho xac nhan tu ban to chuc.');
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Không thể đăng ký giải đấu', 400);
  }
});

/** Tất cả đăng ký (admin) — hỗ trợ lọc theo giải & trạng thái. */
export const listAll = asyncHandler(async (req, res: Response) => {
  const { tournament_id, status } = req.query as { tournament_id?: string; status?: string };
  const rows = await registrationRepository.listAll({ tournament_id, status });
  return ok(res, rows);
});

/** Đăng ký của một giải (chủ giải hoặc admin). */
export const listByTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);

  const tournament = await tournamentRepository.findById(id);
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404);
  }

  const isAdmin = req.user!.role === 'admin';
  const isOwner = tournament.created_by === req.user!.id;
  if (!isAdmin && !isOwner) {
    return fail(res, 'Bạn không có quyền xem danh sách đăng ký', 403);
  }

  const rows = await registrationRepository.listByTournament(id);
  return res.json({
    success: true,
    data: rows,
    tournament: { id: tournament.id, name: tournament.name, form_schema: tournament.form_schema },
  });
});

/** [AD-13] Cập nhật trạng thái đăng ký (admin) — với transition validation + audit trail. */
export const updateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);
  const { status, rejection_reason } = req.body as { status?: RegistrationStatus; rejection_reason?: string };

  if (!['pending', 'approved', 'rejected'].includes(status ?? '')) {
    return fail(res, 'Trạng thái không hợp lệ', 400);
  }

  // Yêu cầu lý do khi từ chối
  if (status === 'rejected' && (!rejection_reason || !rejection_reason.trim())) {
    return fail(res, 'Vui lòng cung cấp lý do từ chối', 400);
  }

  const actorId = req.user?.id || 'admin';
  const ipAddress = req.ip || req.socket.remoteAddress;

  try {
    const registration = await registrationRepository.updateStatus(
      id,
      status!,
      actorId,
      rejection_reason?.trim(),
      ipAddress,
    );
    if (!registration) {
      return fail(res, 'Không tìm thấy đăng ký', 404);
    }
    return ok(res, registration, 'Cập nhật trạng thái thành công');
  } catch (error) {
    // Transition validation error từ repository
    const message = error instanceof Error ? error.message : 'Không thể cập nhật trạng thái';
    return fail(res, message, 400);
  }
});

/** Xóa đăng ký — admin hoặc chủ giải. */
export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);

  const registration = await registrationRepository.findWithOwner(id);
  if (!registration) {
    return fail(res, 'Không tìm thấy đăng ký', 404);
  }

  const isAdmin = req.user!.role === 'admin';
  const isOwner = registration.tournament_owner === req.user!.id;
  if (!isAdmin && !isOwner) {
    return fail(res, 'Bạn không có quyền xóa đăng ký này', 403);
  }

  await registrationRepository.remove(id);
  return ok(res, undefined, 'Xóa đăng ký thành công');
});

/** Đăng ký của các giải do user tạo (hoặc tất cả nếu admin). */
export const myRegistrations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tournament_id, status } = req.query as { tournament_id?: string; status?: string };
  const isAdmin = req.user!.role === 'admin';

  const rows = await registrationRepository.listMine(req.user!.id, isAdmin, { tournament_id, status });
  return ok(res, rows);
});

/** Danh sách giải đấu của user (để filter). */
export const myTournaments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user!.role === 'admin';
  const rows = await tournamentRepository.listByUser(req.user!.id, isAdmin);
  return ok(res, rows);
});
