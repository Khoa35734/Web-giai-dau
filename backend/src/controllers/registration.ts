import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
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
}

/** Đăng ký tham gia giải đấu (public) — validate theo form_schema của giải. */
export const create = asyncHandler(async (req, res: Response) => {
  const { tournament_id, form_data } = req.body as RegistrationBody;

  if (!tournament_id || !form_data) {
    return fail(res, 'Thiếu tournament_id hoặc form_data', 400);
  }

  // Validate các trường bắt buộc theo form_schema của giải
  const formSchema = await getTournamentFormSchema(tournament_id);
  for (const field of formSchema.filter((f) => f.required)) {
    const val = form_data[field.id];
    if (!val || String(val).trim() === '') {
      return fail(res, `Truong "${field.label}" la bat buoc`, 400);
    }
  }

  const registration = await registrationRepository.create(tournament_id, form_data);
  return created(res, registration, 'Dang ky thanh cong! Vui long cho xac nhan tu ban to chuc.');
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

/** Cập nhật trạng thái đăng ký (admin). */
export const updateStatus = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const { status } = req.body as { status?: RegistrationStatus };

  if (!['pending', 'approved', 'rejected'].includes(status ?? '')) {
    return fail(res, 'Trạng thái không hợp lệ', 400);
  }

  const registration = await registrationRepository.updateStatus(id, status!);
  if (!registration) {
    return fail(res, 'Không tìm thấy đăng ký', 404);
  }

  return ok(res, registration, 'Cập nhật trạng thái thành công');
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
