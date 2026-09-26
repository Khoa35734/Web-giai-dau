import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { tournamentOrganizerRepository } from '../repositories/tournamentOrganizer.repository.ts';
import { tournamentRepository } from '../repositories/tournament.ts';
import type { OrganizerRole, OrganizerType } from '../types/index.ts';
import {
  ORGANIZER_ROLES,
  mapOrganizerToDTO,
  mapParticipantCandidateToDTO,
  mapUserCandidateToDTO,
} from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { paramId } from '../utils/param.ts';
import { created, fail, ok } from '../utils/response.ts';

const VALID_ROLES = ORGANIZER_ROLES;

/**
 * [SRS 4.2, AD-05] Lấy danh sách Ban Tổ Chức của một giải đấu.
 */
export const getOrganizersByTournament = asyncHandler(async (req, res: Response) => {
  const tournamentId = paramId(req);
  if (!tournamentId) {
    return fail(res, 'Thiếu tournament id', 400, 'BAD_REQUEST');
  }

  const organizers = await tournamentOrganizerRepository.getOrganizersByTournament(tournamentId);
  const dtos = organizers.map(mapOrganizerToDTO);
  return ok(res, dtos);
});

// Alias
export const listByTournament = getOrganizersByTournament;

/**
 * [SRS 4.2, AD-05, SV-13] Gán CTV thường trực (`organizer_type = 'permanent'`, `user_id`)
 * hoặc Sinh viên (`organizer_type = 'seasonal'`, `participant_id`).
 * Kiểm tra ràng buộc chk_organizer_target và quyền Admin / Lead Organizer.
 */
export const addOrganizer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tournamentId = paramId(req);
  const body = req.body || {};

  // Support both camelCase and snake_case request body inputs
  const organizer_type: OrganizerType | undefined = body.organizerType || body.organizer_type;
  const user_id: string | undefined = body.userId || body.user_id;
  const participant_id: string | undefined = body.participantId || body.participant_id;
  const role: OrganizerRole | undefined = body.role;
  const custom_title: string | undefined = body.customTitle || body.custom_title;

  if (!tournamentId) {
    return fail(res, 'Thiếu tournament id', 400, 'BAD_REQUEST');
  }

  const tournament = await tournamentRepository.findById(tournamentId);
  if (!tournament) {
    return fail(res, 'Không tìm thấy giải đấu', 404, 'RESOURCE_NOT_FOUND');
  }

  const user = req.user!;
  if (!organizer_type || !['permanent', 'seasonal'].includes(organizer_type)) {
    return fail(res, 'Loại thành viên BTC không hợp lệ ("permanent" hoặc "seasonal")', 400, 'BAD_REQUEST', [
      { field: 'organizerType', message: 'Must be "permanent" or "seasonal"' },
    ]);
  }

  if (!role || !VALID_ROLES.includes(role)) {
    return fail(res, `Vai trò không hợp lệ. Chọn: ${VALID_ROLES.join(', ')}`, 400, 'BAD_REQUEST', [
      { field: 'role', message: `Must be one of: ${VALID_ROLES.join(', ')}` },
    ]);
  }

  try {
    const rawCreated = await tournamentOrganizerRepository.addOrganizer({
      tournament_id: tournamentId,
      organizer_type,
      user_id,
      participant_id,
      role,
      custom_title,
      assigned_by: user.id,
    });
    const dto = mapOrganizerToDTO(rawCreated);
    return created(res, dto, 'Gán thành viên Ban Tổ Chức thành công');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi khi gán thành viên BTC';
    return fail(res, message, 400, 'BAD_REQUEST');
  }
});

/**
 * [SRS 4.2, AD-05] Cập nhật vai trò / chức danh thành viên BTC.
 */
export const updateOrganizer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tournamentId = paramId(req);
  const organizerId = paramId(req, 'organizerId');
  const body = req.body || {};

  const role: OrganizerRole | undefined = body.role;
  const custom_title: string | undefined = body.customTitle !== undefined ? body.customTitle : body.custom_title;

  const organizer = await tournamentOrganizerRepository.findById(organizerId);
  if (!organizer || organizer.tournament_id !== tournamentId) {
    return fail(res, 'Không tìm thấy thông tin thành viên BTC trong giải đấu này', 404, 'RESOURCE_NOT_FOUND');
  }

  if (role && !VALID_ROLES.includes(role)) {
    return fail(res, `Vai trò không hợp lệ. Chọn: ${VALID_ROLES.join(', ')}`, 400, 'BAD_REQUEST', [
      { field: 'role', message: `Must be one of: ${VALID_ROLES.join(', ')}` },
    ]);
  }

  const updatedRaw = await tournamentOrganizerRepository.updateOrganizer(organizerId, { role, custom_title });
  if (!updatedRaw) {
    return fail(res, 'Cập nhật thất bại, không tìm thấy bản ghi', 404, 'RESOURCE_NOT_FOUND');
  }

  const dto = mapOrganizerToDTO(updatedRaw);
  return ok(res, dto, 'Cập nhật thành viên Ban Tổ Chức thành công');
});

/**
 * [SRS 4.2, AD-05] Xóa thành viên khỏi Ban Tổ Chức.
 */
export const removeOrganizer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tournamentId = paramId(req);
  const organizerId = paramId(req, 'organizerId');

  const organizer = await tournamentOrganizerRepository.findById(organizerId);
  if (!organizer || organizer.tournament_id !== tournamentId) {
    return fail(res, 'Không tìm thấy thông tin thành viên BTC trong giải đấu này', 404, 'RESOURCE_NOT_FOUND');
  }

  await tournamentOrganizerRepository.removeOrganizer(organizerId, tournamentId);
  return ok(res, undefined, 'Đã xóa thành viên khỏi Ban Tổ Chức');
});

/**
 * [SRS 4.2] Kiểm tra vai trò quyền hạn điều hành của user với giải đấu.
 */
export const checkUserOrganizerRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tournamentId = paramId(req);
  const user = req.user!;

  if (user.role === 'admin') {
    return ok(res, {
      isAuthorized: true,
      isLeadOrAdmin: true,
      role: 'admin',
    });
  }

  const roleInfo = await tournamentOrganizerRepository.checkUserOrganizerRole(tournamentId, user.id);
  return ok(res, roleInfo);
});

// Alias
export const checkUserRole = checkUserOrganizerRole;

/**
 * [SRS 4.2] Tìm kiếm ứng viên CTV thường trực từ users.
 */
export const getCandidateUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const q = req.query.q as string | undefined;
  const candidates = await tournamentOrganizerRepository.searchUserCandidates(q);
  const dtos = candidates.map(mapUserCandidateToDTO);
  return ok(res, dtos);
});

/**
 * [SRS 4.2] Tìm kiếm ứng viên Sinh viên KYC approved từ participants.
 */
export const getCandidateParticipants = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const q = req.query.q as string | undefined;
  const candidates = await tournamentOrganizerRepository.searchParticipantCandidates(q);
  const dtos = candidates.map(mapParticipantCandidateToDTO);
  return ok(res, dtos);
});
