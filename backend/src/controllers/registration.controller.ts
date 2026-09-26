import type { Response } from 'express';
import type { AuthenticatedParticipantRequest, AuthenticatedRequest } from '../middleware/auth.ts';
import {
  getTournamentFormSchema,
  registrationRepository,
} from '../repositories/registration.repository.ts';
import { tournamentRepository } from '../repositories/tournament.ts';
import type { RegistrationStatus } from '../types/index.ts';
import { mapRegistrationToDTO, mapTeamJoinRequestToDTO } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { paramId } from '../utils/param.ts';
import { created, fail, ok } from '../utils/response.ts';
import { generateParticipantsExcel } from '../services/exportService.ts';

interface RegistrationBody {
  tournament_id?: string;
  tournamentId?: string;
  form_data?: Record<string, unknown>;
  submitted_data?: Record<string, unknown>;
  submittedData?: Record<string, unknown>;
  team_name?: string;
  teamName?: string;
  team_avatar_url?: string;
  teamAvatarUrl?: string;
  ingame_id?: string;
  ingameId?: string;
  role_in_team?: string;
  roleInTeam?: string;
  members?: Array<{
    participant_id?: string;
    participantId?: string;
    ingame_id?: string;
    ingameId?: string;
    role_in_team?: string;
    roleInTeam?: string;
  }>;
  member_ids?: string[];
  is_recruiting?: boolean;
  isRecruiting?: boolean;
  recruitment_notes?: string;
  recruitmentNotes?: string;
}

function normalizeSubmittedData(body: RegistrationBody): Record<string, unknown> {
  return body.submitted_data ?? body.submittedData ?? body.form_data ?? {};
}

function validateRequiredFields(
  formSchema: Awaited<ReturnType<typeof getTournamentFormSchema>>,
  formData: Record<string, unknown>,
): { field: string; message: string } | null {
  for (const field of formSchema.filter((f) => f.required)) {
    const val = formData[field.id];
    if (val === undefined || val === null || String(val).trim() === '') {
      return {
        field: field.id,
        message: `Trường "${field.label}" là bắt buộc`,
      };
    }
  }
  return null;
}

/**
 * [TASK_BE_202, SRS 3.1 SV-05] Đăng ký tham gia giải đấu (cá nhân hoặc đội) bằng participant token.
 * Bắt buộc chuẩn hóa Ingame ID cho đội trưởng và từng thành viên.
 * Validate dữ liệu động theo form_schema.
 * Hỗ trợ cờ tuyển quân is_recruiting và recruitment_notes.
 */
export const create = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const body = req.body as RegistrationBody;
  const tournamentId = body.tournament_id ?? body.tournamentId;
  const ingameId = (body.ingame_id ?? body.ingameId)?.trim();
  const roleInTeam = body.role_in_team ?? body.roleInTeam;
  const teamName = body.team_name ?? body.teamName;
  const teamAvatarUrl = body.team_avatar_url ?? body.teamAvatarUrl;
  const isRecruiting = body.is_recruiting ?? body.isRecruiting;
  const recruitmentNotes = body.recruitment_notes ?? body.recruitmentNotes;
  const submittedData = normalizeSubmittedData(body);

  if (!tournamentId) {
    return fail(res, 'Thiếu tournament_id / tournamentId', 400, 'MISSING_TOURNAMENT_ID');
  }

  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
  }

  if (!ingameId) {
    return fail(res, 'Vui lòng nhập Ingame ID (Riot ID / Tên kiện tướng trong game)', 400, 'MISSING_INGAME_ID');
  }

  const tournament = await tournamentRepository.findById(tournamentId);
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404, 'TOURNAMENT_NOT_FOUND');
  }

  const formSchema = await getTournamentFormSchema(tournamentId);
  const validationError = validateRequiredFields(formSchema, submittedData);
  if (validationError) {
    return fail(
      res,
      validationError.message,
      422,
      'FORM_VALIDATION_ERROR',
      [validationError],
    );
  }

  // Chuẩn hóa members payload với bắt buộc Ingame ID cho từng thành viên
  let normalizedMembers: Array<{ participant_id: string; ingame_id: string; role_in_team?: string }> = [];
  if (Array.isArray(body.members)) {
    for (const m of body.members) {
      const pId = m.participant_id ?? m.participantId;
      const mIngame = (m.ingame_id ?? m.ingameId)?.trim();
      if (!pId) {
        return fail(res, 'Thông tin thành viên trong đội thiếu participant_id', 400, 'MISSING_PARTICIPANT_ID');
      }
      if (!mIngame) {
        return fail(res, `Thành viên (${pId}) bị thiếu Ingame ID`, 400, 'MISSING_MEMBER_INGAME_ID');
      }
      normalizedMembers.push({
        participant_id: pId,
        ingame_id: mIngame,
        role_in_team: m.role_in_team ?? m.roleInTeam ?? 'Member',
      });
    }
  } else if (Array.isArray(body.member_ids)) {
    normalizedMembers = body.member_ids.map((id) => ({
      participant_id: id,
      ingame_id: 'Unknown',
      role_in_team: 'Member',
    }));
  }

  try {
    const registration = await registrationRepository.createRegistration({
      tournament_id: tournamentId,
      captain_id: req.participant.id,
      ingame_id: ingameId,
      team_name: teamName?.trim() || null,
      team_avatar_url: teamAvatarUrl?.trim() || null,
      role_in_team: roleInTeam?.trim() || null,
      submitted_data: submittedData,
      members: normalizedMembers,
      is_recruiting: Boolean(isRecruiting),
      recruitment_notes: recruitmentNotes?.trim() || null,
    });

    const dto = mapRegistrationToDTO(registration);
    return created(res, dto, 'Đăng ký thành công! Vui lòng chờ xác nhận từ ban tổ chức.');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Không thể đăng ký giải đấu';
    return fail(res, msg, 400, 'REGISTRATION_FAILED');
  }
});

/**
 * [TASK_BE_202, SRS 3.1 SV-07] Hủy đơn đăng ký (trước khi giải đóng đăng ký).
 */
export const cancel = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const id = paramId(req);
  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
  }

  try {
    const cancelled = await registrationRepository.cancelRegistration(id, req.participant.id);
    const dto = mapRegistrationToDTO(cancelled);
    return ok(res, dto, 'Đã hủy đơn đăng ký thành công');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Không thể hủy đơn đăng ký';
    return fail(res, msg, 400, 'CANCEL_REGISTRATION_FAILED');
  }
});

/**
 * [TASK_BE_202, SRS 3.1 SV-06, SRS 4.3] Danh sách các đội đang tuyển quân trên Chợ Tìm Đồng Đội (Public).
 */
export const listRecruitingTeams = asyncHandler(async (req, res: Response) => {
  const tournamentId = paramId(req);
  if (!tournamentId) {
    return fail(res, 'Thiếu tournament id', 400, 'MISSING_TOURNAMENT_ID');
  }

  const teams = await registrationRepository.listRecruitingTeams(tournamentId);
  const dtos = teams.map((t) => mapRegistrationToDTO(t));
  return ok(res, dtos);
});

/**
 * [TASK_BE_202, SRS 3.1 SV-06] Nộp yêu cầu xin vào đội đang thiếu người (Chợ đồng đội).
 */
export const createJoinRequest = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const registrationId = paramId(req);
  const { ingame_id, ingameId, message } = req.body as { ingame_id?: string; ingameId?: string; message?: string };
  const targetIngameId = (ingame_id ?? ingameId)?.trim();

  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
  }

  if (!targetIngameId) {
    return fail(res, 'Vui lòng nhập Ingame ID của bạn trong game', 400, 'MISSING_INGAME_ID');
  }

  try {
    const joinReq = await registrationRepository.createJoinRequest({
      registration_id: registrationId,
      participant_id: req.participant.id,
      ingame_id: targetIngameId,
      message: message?.trim() || null,
    });
    return created(res, mapTeamJoinRequestToDTO(joinReq), 'Đã gửi yêu cầu gia nhập đội thành công! Chờ đội trưởng phê duyệt.');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Không thể gửi yêu cầu gia nhập';
    return fail(res, msg, 400, 'JOIN_REQUEST_FAILED');
  }
});

/**
 * [TASK_BE_202, SRS 3.1 SV-06] Lấy danh sách yêu cầu gia nhập đội (đội trưởng xem).
 * [SECURITY FIX] Thêm kiểm tra Captain ownership để phòng chống lỗ hổng IDOR.
 */
export const listJoinRequests = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
  }

  const registrationId = paramId(req);
  if (!registrationId) {
    return fail(res, 'Vui lòng cung cấp mã đội đăng ký', 400, 'MISSING_REGISTRATION_ID');
  }

  const registration = await registrationRepository.findWithOwner(registrationId);
  if (!registration) {
    return fail(res, 'Không tìm thấy thông tin đội đăng ký', 404, 'RESOURCE_NOT_FOUND');
  }

  if (registration.captain_id !== req.participant.id) {
    return fail(res, 'Chỉ đội trưởng mới có quyền xem danh sách yêu cầu gia nhập đội này', 403, 'FORBIDDEN_ACCESS');
  }

  const requests = await registrationRepository.listJoinRequests(registrationId);
  return ok(res, requests.map(mapTeamJoinRequestToDTO));
});

/**
 * [TASK_BE_202, SRS 3.1 SV-06] Sinh viên xem danh sách các request mình đã gửi đi.
 */
export const getMyJoinRequests = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập', 401, 'UNAUTHORIZED_ACCESS');
  }
  const requests = await registrationRepository.listMyJoinRequests(req.participant.id);
  return ok(res, requests.map(mapTeamJoinRequestToDTO));
});

/**
 * [TASK_BE_202, SRS 3.1 SV-06, SRS 4.3] Đội trưởng Duyệt (Accept) hoặc Từ chối (Reject) yêu cầu xin vào đội.
 */
export const processJoinRequest = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const requestId = paramId(req, 'requestId');
  const { action, reason } = req.body as { action?: 'accepted' | 'rejected'; reason?: string };

  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập đội trưởng', 401, 'UNAUTHORIZED_ACCESS');
  }

  if (!action || !['accepted', 'rejected'].includes(action)) {
    return fail(res, 'Hành động không hợp lệ (chỉ chấp nhận "accepted" hoặc "rejected")', 400, 'INVALID_ACTION');
  }

  try {
    const result = await registrationRepository.processJoinRequest(
      requestId,
      action,
      req.participant.id,
      reason,
    );
    const msg = action === 'accepted' ? 'Đã duyệt thành viên vào đội thành công!' : 'Đã từ chối yêu cầu gia nhập';
    return ok(res, mapTeamJoinRequestToDTO(result), msg);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Không thể xử lý yêu cầu';
    return fail(res, msg, 400, 'PROCESS_JOIN_REQUEST_FAILED');
  }
});

/**
 * [TASK_BE_202] Bật/tắt trạng thái tuyển quân và cập nhật ghi chú của đội.
 */
export const updateRecruitingStatus = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const registrationId = paramId(req);
  const body = req.body as { is_recruiting?: boolean; isRecruiting?: boolean; recruitment_notes?: string; recruitmentNotes?: string };
  const isRecruiting = body.is_recruiting ?? body.isRecruiting;
  const recruitmentNotes = body.recruitment_notes ?? body.recruitmentNotes;

  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập đội trưởng', 401, 'UNAUTHORIZED_ACCESS');
  }

  try {
    const updated = await registrationRepository.updateRecruitingStatus(
      registrationId,
      req.participant.id,
      Boolean(isRecruiting),
      recruitmentNotes,
    );
    const dto = mapRegistrationToDTO(updated);
    return ok(res, dto, 'Cập nhật trạng thái tuyển quân thành công');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Không thể cập nhật trạng thái tuyển quân';
    return fail(res, msg, 400, 'UPDATE_RECRUITING_FAILED');
  }
});

/**
 * [TASK_BE_202] Lấy thông tin đăng ký của sinh viên hiện tại trong giải đấu.
 */
export const getMyTournamentRegistration = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const tournamentId = paramId(req);
  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập sinh viên', 401, 'UNAUTHORIZED_ACCESS');
  }

  const reg = await registrationRepository.findParticipantRegistrationInTournament(tournamentId, req.participant.id);
  if (!reg) {
    return ok(res, null);
  }
  const dto = mapRegistrationToDTO(reg);
  return ok(res, dto);
});

/**
 * [TASK_BE_202, SRS 3.1 SV-04, SV-05]
 * Lấy danh sách toàn bộ các giải đấu mà sinh viên hiện tại đã đăng ký.
 */
export const getMyParticipations = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
  }

  const rows = await registrationRepository.listMyParticipations(req.participant.id);
  const dtos = rows.map((r) => mapRegistrationToDTO(r));
  return ok(res, dtos);
});

/**
 * [TASK_BE_202, SRS 3.1 SV-04] Cập nhật thông tin đăng ký (GD1 & GD2).
 */
export const updateInfo = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const id = paramId(req);
  if (!req.participant) {
    return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
  }

  const body = req.body as {
    ingame_id?: string;
    ingameId?: string;
    team_name?: string;
    teamName?: string;
    team_avatar_url?: string;
    teamAvatarUrl?: string;
    submitted_data?: Record<string, unknown>;
    submittedData?: Record<string, unknown>;
  };

  const ingameId = body.ingame_id ?? body.ingameId;
  const teamName = body.team_name ?? body.teamName;
  const teamAvatarUrl = body.team_avatar_url ?? body.teamAvatarUrl;
  const submittedData = body.submitted_data ?? body.submittedData;

  try {
    const updated = await registrationRepository.updateRegistrationInfo(id, req.participant.id, {
      ingame_id: ingameId,
      team_name: teamName,
      team_avatar_url: teamAvatarUrl,
      submitted_data: submittedData,
    });
    const dto = mapRegistrationToDTO(updated);
    return ok(res, dto, 'Cập nhật thông tin đăng ký thành công');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Không thể cập nhật thông tin đăng ký';
    return fail(res, msg, 400, 'UPDATE_INFO_FAILED');
  }
});

/** Tất cả đăng ký (admin) — hỗ trợ lọc theo giải & trạng thái. */
export const listAll = asyncHandler(async (req, res: Response) => {
  const { tournament_id, tournamentId, status } = req.query as { tournament_id?: string; tournamentId?: string; status?: string };
  const rows = await registrationRepository.listAll({ tournament_id: tournament_id ?? tournamentId, status });
  const dtos = rows.map((r) => mapRegistrationToDTO(r));
  return ok(res, dtos);
});

/** Đăng ký của một giải (chủ giải hoặc admin). */
export const listByTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);

  const tournament = await tournamentRepository.findById(id);
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404, 'TOURNAMENT_NOT_FOUND');
  }

  const isAdmin = req.user!.role === 'admin';
  const isOwner = tournament.created_by === req.user!.id;
  if (!isAdmin && !isOwner) {
    return fail(res, 'Bạn không có quyền xem danh sách đăng ký', 403, 'FORBIDDEN_ACCESS');
  }

  const rows = await registrationRepository.listByTournament(id);
  const dtos = rows.map((r) => mapRegistrationToDTO(r));
  return ok(res, dtos, 'Danh sách đơn đăng ký');
});

/** [AD-13] Cập nhật trạng thái đăng ký (admin) — với transition validation + audit trail. */
export const updateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);
  const { status, rejection_reason, rejectionReason } = req.body as { status?: RegistrationStatus; rejection_reason?: string; rejectionReason?: string };
  const targetReason = rejection_reason ?? rejectionReason;

  if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status ?? '')) {
    return fail(res, 'Trạng thái không hợp lệ', 400, 'INVALID_REGISTRATION_STATUS');
  }

  if (status === 'rejected' && (!targetReason || !targetReason.trim())) {
    return fail(res, 'Vui lòng cung cấp lý do từ chối', 400, 'MISSING_REJECTION_REASON');
  }

  const actorId = req.user?.id || 'admin';
  const ipAddress = req.ip || req.socket.remoteAddress;

  try {
    const registration = await registrationRepository.updateStatus(
      id,
      status!,
      actorId,
      targetReason?.trim(),
      ipAddress,
    );
    if (!registration) {
      return fail(res, 'Không tìm thấy đăng ký', 404, 'RESOURCE_NOT_FOUND');
    }
    const dto = mapRegistrationToDTO(registration);
    return ok(res, dto, 'Cập nhật trạng thái thành công');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật trạng thái';
    return fail(res, message, 400, 'UPDATE_STATUS_FAILED');
  }
});

/** Xóa đăng ký — admin hoặc chủ giải. */
export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);

  const registration = await registrationRepository.findWithOwner(id);
  if (!registration) {
    return fail(res, 'Không tìm thấy đăng ký', 404, 'RESOURCE_NOT_FOUND');
  }

  const isAdmin = req.user!.role === 'admin';
  const isOwner = registration.tournament_owner === req.user!.id;
  if (!isAdmin && !isOwner) {
    return fail(res, 'Bạn không có quyền xóa đăng ký này', 403, 'FORBIDDEN_ACCESS');
  }

  await registrationRepository.remove(id);
  return ok(res, undefined, 'Xóa đăng ký thành công');
});

/** Đăng ký của các giải do user tạo (hoặc tất cả nếu admin). */
export const myRegistrations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tournament_id, tournamentId, status } = req.query as { tournament_id?: string; tournamentId?: string; status?: string };
  const isAdmin = req.user!.role === 'admin';

  const rows = await registrationRepository.listMine(req.user!.id, isAdmin, { tournament_id: tournament_id ?? tournamentId, status });
  const dtos = rows.map((r) => mapRegistrationToDTO(r));
  return ok(res, dtos);
});

/** Danh sách giải đấu của user (để filter). */
export const myTournaments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user!.role === 'admin';
  const rows = await tournamentRepository.listByUser(req.user!.id, isAdmin);
  return ok(res, rows);
});

/**
 * [TASK_BE_903] Lấy danh sách thành viên/đội tham gia giải đấu và trạng thái điểm danh ngày thi đấu.
 */
export const getTournamentParticipants = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);
  if (!id) {
    return fail(res, 'Thiếu tournament ID', 400);
  }

  const data = await registrationRepository.getTournamentParticipantsWithCheckin(id);
  return ok(res, data, 'Lấy danh sách thành viên giải đấu thành công');
});

/**
 * [TASK_BE_903] Admin/CTV bấm nút "Xác nhận tham gia" (Điểm danh tay ngày đánh giải) cho 1 thành viên.
 */
export const confirmParticipantParticipation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tournamentId, registrationId, participantId, action, notes } = req.body as {
    tournamentId: string;
    registrationId: string;
    participantId: string;
    action: 'confirm' | 'cancel';
    notes?: string;
  };

  if (!tournamentId || !participantId || !action) {
    return fail(res, 'Thiếu thông tin tournamentId, participantId hoặc action', 400);
  }

  const reviewerId = req.user?.id || null;

  const result = await registrationRepository.confirmMemberCheckin({
    tournamentId,
    registrationId,
    participantId,
    action,
    reviewerId,
    notes,
  });

  const msg = action === 'confirm' ? '✅ Xác nhận tham gia ngày thi đấu thành công!' : '❌ Hủy xác nhận tham gia thành công!';
  return ok(res, result, msg);
});

/**
 * [TASK_BE_903] Xuất file Excel (.xlsx) danh sách thành viên/đội tham gia giải đấu kèm trạng thái điểm danh.
 */
export const exportTournamentParticipantsExcel = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);
  if (!id) {
    return fail(res, 'Thiếu tournament ID', 400);
  }

  const data = await registrationRepository.getTournamentParticipantsWithCheckin(id);
  const excelBuffer = await generateParticipantsExcel(data);

  const sanitizedCode = (data.tournamentCode || 'DUT-ESPORTS').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Danh_Sach_Tham_Gia_${sanitizedCode}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(excelBuffer);
});

