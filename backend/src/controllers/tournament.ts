import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { tournamentRepository } from '../repositories/tournament.ts';
import type { ParticipationType, FormSchema, TournamentStatus } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { paramId } from '../utils/param.ts';
import { created, fail, ok } from '../utils/response.ts';
import { generateTournamentCode } from '../utils/tournamentCode.ts';

/** Payload tạo / cập nhật giải đấu (từ client). */
interface TournamentBody {
  name?: string;
  game_name?: string;
  game_logo_url?: string;
  banner_url?: string;
  participation_type?: ParticipationType;
  max_participants?: number;
  min_team_size?: number | null;
  max_team_size?: number | null;
  prize_pool?: number;
  registration_open_at?: string;
  registration_close_at?: string;
  start_at?: string;
  end_at?: string;
  description?: string;
  use_external_link?: boolean;
  external_registration_url?: string;
  form_schema?: unknown;
  status?: TournamentStatus;
}

/** Danh sách giải đấu (public) — hỗ trợ tìm kiếm + lọc trạng thái. */
export const list = asyncHandler(async (req, res: Response) => {
  const { search, status } = req.query as { search?: string; status?: string };
  const rows = await tournamentRepository.list({ search, status });
  return ok(res, rows);
});

/** Chi tiết một giải đấu (public). */
export const getById = asyncHandler(async (req, res: Response) => {
  const tournament = await tournamentRepository.findById(paramId(req));
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404);
  }
  return ok(res, tournament);
});

/** Tạo giải đấu — admin được duyệt ngay, CTV phải chờ duyệt. */
export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as TournamentBody;

  if (!body.name || !body.game_name || !body.participation_type || !body.max_participants || !body.banner_url) {
    return fail(res, 'Tên, tên trò chơi, loại tham gia, số người tối đa, và banner là bắt buộc', 400);
  }

  if (body.participation_type === 'team') {
    if (!body.min_team_size || !body.max_team_size) {
      return fail(res, 'Kích thước tối thiểu và tối đa của đội là bắt buộc', 400);
    }
    if (body.min_team_size > body.max_team_size) {
      return fail(res, 'Kích thước tối thiểu phải nhỏ hơn hoặc bằng kích thước tối đa', 400);
    }
  }

  const code = await generateTournamentCode(body.game_name, body.start_at ?? new Date().toISOString());

  const isAdmin = req.user!.role === 'admin';
  const status: TournamentStatus = isAdmin ? 'approved' : 'pending';

  const tournament = await tournamentRepository.create({
    code,
    name: body.name,
    game_name: body.game_name,
    game_logo_url: body.game_logo_url,
    banner_url: body.banner_url,
    participation_type: body.participation_type,
    max_participants: body.max_participants,
    min_team_size: body.min_team_size ?? null,
    max_team_size: body.max_team_size ?? null,
    prize_pool: body.prize_pool ?? 0,
    registration_open_at: body.registration_open_at,
    registration_close_at: body.registration_close_at,
    start_at: body.start_at,
    end_at: body.end_at,
    description: body.description,
    use_external_link: body.use_external_link,
    external_registration_url: body.external_registration_url,
    form_schema: body.form_schema ?? [],
    created_by: req.user!.id,
    approved_by: isAdmin ? req.user!.id : null,
    status,
    approved_at: isAdmin ? new Date() : null,
  });

  return created(
    res,
    tournament,
    status === 'approved' ? 'Giải đấu được tạo thành công' : 'Giải đấu được gửi để duyệt. Chờ admin duyệt.',
  );
});

/** Cập nhật giải đấu — admin duyệt/từ chối, creator sửa thông tin. */
export const update = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);
  const body = req.body as TournamentBody;

  const tournament = await tournamentRepository.findById(id);
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404);
  }

  const isAdmin = req.user!.role === 'admin';
  const isCreator = tournament.created_by === req.user!.id;

  // Admin mới được duyệt/từ chối
  if (body.status && body.status !== tournament.status) {
    if (!isAdmin) {
      return fail(res, 'Chỉ admin mới có thể duyệt giải đấu', 403);
    }
    if (!['pending', 'approved', 'rejected'].includes(body.status)) {
      return fail(res, 'Trạng thái không hợp lệ', 400);
    }
  }

  if (!isCreator && !isAdmin) {
    return fail(res, 'Bạn không có quyền chỉnh sửa giải đấu này', 403);
  }

  if (body.participation_type === 'team' && (body.min_team_size || body.max_team_size)) {
    if (body.min_team_size! > body.max_team_size!) {
      return fail(res, 'Kích thước tối thiểu phải nhỏ hơn hoặc bằng kích thước tối đa', 400);
    }
  }

  const isApproval = isAdmin && body.status;

  const updated = await tournamentRepository.update(id, {
    name: body.name ?? tournament.name,
    game_name: body.game_name ?? tournament.game_name,
    game_logo_url: body.game_logo_url ?? tournament.game_logo_url,
    banner_url: body.banner_url ?? tournament.banner_url,
    participation_type: body.participation_type ?? tournament.participation_type,
    max_participants: body.max_participants ?? tournament.max_participants,
    min_team_size: body.min_team_size !== undefined ? body.min_team_size : tournament.min_team_size,
    max_team_size: body.max_team_size !== undefined ? body.max_team_size : tournament.max_team_size,
    prize_pool: body.prize_pool !== undefined ? body.prize_pool : tournament.prize_pool,
    registration_open_at: body.registration_open_at ?? tournament.registration_open_at,
    registration_close_at: body.registration_close_at ?? tournament.registration_close_at,
    start_at: body.start_at ?? tournament.start_at,
    end_at: body.end_at ?? tournament.end_at,
    description: body.description ?? tournament.description,
    use_external_link: body.use_external_link ?? tournament.use_external_link,
    external_registration_url: body.external_registration_url ?? tournament.external_registration_url,
    form_schema: body.form_schema !== undefined ? (body.form_schema as FormSchema) : tournament.form_schema,
    status: body.status ?? tournament.status,
    approved_by: isApproval ? req.user!.id : tournament.approved_by,
    approved_at: isApproval ? new Date().toISOString() : tournament.approved_at,
  });

  return ok(res, updated, 'Giải đấu được cập nhật thành công');
});

/** Danh sách giải đấu chờ duyệt (admin). */
export const getPending = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const rows = await tournamentRepository.listPending();
  return ok(res, rows);
});

/** Danh sách giải đấu chờ duyệt của chính CTV. */
export const getMyPending = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rows = await tournamentRepository.listMyPending(req.user!.id);
  return ok(res, rows);
});

/** Xóa giải đấu — admin xóa mọi giải, creator chỉ xóa giải đang pending. */
export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);

  const tournament = await tournamentRepository.findById(id);
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404);
  }

  const isAdmin = req.user!.role === 'admin';
  const isCreator = tournament.created_by === req.user!.id;
  const isPending = tournament.status === 'pending';

  if (!isAdmin && !(isCreator && isPending)) {
    return fail(res, 'Bạn không có quyền xóa giải đấu này', 403);
  }

  await tournamentRepository.remove(id);
  return ok(res, undefined, 'Giải đấu được xóa thành công');
});
