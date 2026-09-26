import type { Response } from 'express';
import type { AuthenticatedParticipantRequest } from '../middleware/auth.ts';
import { registrationRepository } from '../repositories/registration.repository.ts';
import { mapTeamJoinRequestToDTO } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { paramId } from '../utils/param.ts';
import { created, fail, ok } from '../utils/response.ts';

interface CreateJoinRequestBody {
  registrationId?: string;
  registration_id?: string;
  ingameId?: string;
  ingame_id?: string;
  message?: string;
}

interface ProcessJoinRequestBody {
  action?: 'accepted' | 'rejected';
  reason?: string;
}

/**
 * [SRS 3.1 SV-06, TASK_BE_203] Nộp yêu cầu gia nhập đội đang tuyển quân (Chợ tuyển quân).
 */
export const createJoinRequest = asyncHandler(
  async (req: AuthenticatedParticipantRequest, res: Response) => {
    if (!req.participant) {
      return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
    }

    const body = req.body as CreateJoinRequestBody;
    const registrationId = paramId(req, 'registrationId') || body.registrationId || body.registration_id;
    const targetIngameId = (body.ingameId || body.ingame_id)?.trim();
    const message = body.message?.trim() || null;

    if (!registrationId) {
      return fail(res, 'Vui lòng cung cấp mã đội đăng ký (registrationId)', 400, 'MISSING_REGISTRATION_ID');
    }

    if (!targetIngameId) {
      return fail(res, 'Vui lòng nhập Ingame ID của bạn trong game', 400, 'MISSING_INGAME_ID');
    }

    try {
      const joinReqRaw = await registrationRepository.createJoinRequest({
        registration_id: registrationId,
        participant_id: req.participant.id,
        ingame_id: targetIngameId,
        message,
      });

      const dto = mapTeamJoinRequestToDTO(joinReqRaw);
      return created(res, dto, 'Đã gửi yêu cầu gia nhập đội thành công! Vui lòng chờ đội trưởng phê duyệt.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể gửi yêu cầu gia nhập';
      return fail(res, msg, 400, 'JOIN_REQUEST_FAILED');
    }
  },
);

/**
 * [SRS 3.1 SV-06, TASK_BE_203] Lấy danh sách yêu cầu gia nhập của một đội (Cho đội trưởng xem).
 * [SECURITY FIX] Thêm kiểm tra Captain ownership để phòng chống lỗ hổng IDOR.
 */
export const listJoinRequestsForTeam = asyncHandler(
  async (req: AuthenticatedParticipantRequest, res: Response) => {
    if (!req.participant) {
      return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
    }

    const registrationId = paramId(req, 'registrationId') || paramId(req, 'id');
    if (!registrationId) {
      return fail(res, 'Vui lòng cung cấp mã đội đăng ký (registrationId)', 400, 'MISSING_REGISTRATION_ID');
    }

    const registration = await registrationRepository.findWithOwner(registrationId);
    if (!registration) {
      return fail(res, 'Không tìm thấy thông tin đội đăng ký', 404, 'REGISTRATION_NOT_FOUND');
    }

    if (registration.captain_id !== req.participant.id) {
      return fail(res, 'Chỉ đội trưởng mới có quyền xem danh sách yêu cầu gia nhập đội này', 403, 'FORBIDDEN_ACCESS');
    }

    const rawList = await registrationRepository.listJoinRequests(registrationId);
    const dtoList = rawList.map(mapTeamJoinRequestToDTO);
    return ok(res, dtoList, 'Lấy danh sách yêu cầu gia nhập đội thành công');
  },
);

/**
 * [SRS 3.1 SV-06, TASK_BE_203] Sinh viên xem danh sách các yêu cầu xin vào đội mà chính mình đã gửi.
 */
export const getMyJoinRequests = asyncHandler(
  async (req: AuthenticatedParticipantRequest, res: Response) => {
    if (!req.participant) {
      return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
    }

    const rawList = await registrationRepository.listMyJoinRequests(req.participant.id);
    const dtoList = rawList.map(mapTeamJoinRequestToDTO);
    return ok(res, dtoList, 'Lấy danh sách yêu cầu gia nhập cá nhân thành công');
  },
);

/**
 * [SRS 3.1 SV-06, SRS 4.3, TASK_BE_203] Đội trưởng Duyệt (accepted) hoặc Từ chối (rejected) yêu cầu xin vào đội.
 */
export const processJoinRequest = asyncHandler(
  async (req: AuthenticatedParticipantRequest, res: Response) => {
    if (!req.participant) {
      return fail(res, 'Yêu cầu đăng nhập tài khoản đội trưởng', 401, 'UNAUTHORIZED_ACCESS');
    }

    const requestId = paramId(req, 'requestId') || paramId(req, 'id');
    const { action, reason } = req.body as ProcessJoinRequestBody;

    if (!requestId) {
      return fail(res, 'Vui lòng cung cấp mã yêu cầu (requestId)', 400, 'MISSING_REQUEST_ID');
    }

    if (!action || !['accepted', 'rejected'].includes(action)) {
      return fail(res, 'Hành động không hợp lệ (chỉ chấp nhận "accepted" hoặc "rejected")', 400, 'INVALID_ACTION');
    }

    try {
      const rawResult = await registrationRepository.processJoinRequest(
        requestId,
        action,
        req.participant.id,
        reason,
      );

      const dto = mapTeamJoinRequestToDTO(rawResult);
      const msg = action === 'accepted' ? 'Đã duyệt thành viên vào đội thành công!' : 'Đã từ chối yêu cầu gia nhập';
      return ok(res, dto, msg);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể xử lý yêu cầu gia nhập';
      return fail(res, msg, 400, 'PROCESS_JOIN_REQUEST_FAILED');
    }
  },
);

/**
 * [SRS 3.1 SV-06, TASK_BE_203] Sinh viên tự rút / hủy yêu cầu gia nhập đội đã gửi.
 */
export const cancelJoinRequest = asyncHandler(
  async (req: AuthenticatedParticipantRequest, res: Response) => {
    if (!req.participant) {
      return fail(res, 'Yêu cầu đăng nhập tài khoản sinh viên', 401, 'UNAUTHORIZED_ACCESS');
    }

    const requestId = paramId(req, 'requestId') || paramId(req, 'id');
    if (!requestId) {
      return fail(res, 'Vui lòng cung cấp mã yêu cầu (requestId)', 400, 'MISSING_REQUEST_ID');
    }

    try {
      const rawResult = await registrationRepository.cancelJoinRequest(requestId, req.participant.id);
      const dto = mapTeamJoinRequestToDTO(rawResult);
      return ok(res, dto, 'Đã hủy yêu cầu gia nhập thành công');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể hủy yêu cầu gia nhập';
      return fail(res, msg, 400, 'CANCEL_JOIN_REQUEST_FAILED');
    }
  },
);
