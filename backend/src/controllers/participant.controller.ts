import type { Response } from 'express';
import bcryptjs from 'bcryptjs';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { participantRepository } from '../repositories/participant.ts';
import type { ParticipantAccountType, ParticipantStatus } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { paramId } from '../utils/param.ts';
import { created, fail, ok } from '../utils/response.ts';

interface ParticipantBody {
  account_type?: ParticipantAccountType;
  username?: string;
  password?: string;
  full_name?: string;
  student_id?: string;
  email?: string;
  phone_number?: string;
  university_name?: string;
  class_name?: string;
  faculty_name?: string;
  student_card_url?: string;
  selfie_with_student_card_url?: string;
  status?: ParticipantStatus;
}

/** [AD-01] Danh sách participant (admin) — phân trang, tìm kiếm, lọc theo status, account_type, faculty. */
export const listParticipants = asyncHandler(async (req, res: Response) => {
  const { search, account_type, status, faculty, faculty_name, page = '1', limit = '10' } = req.query as Record<string, string>;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, parseInt(limit, 10) || 10);

  const { rows, pagination } = await participantRepository.list(
    {
      search,
      account_type,
      status,
      faculty_name: faculty || faculty_name,
    },
    currentPage,
    pageSize,
  );
  return res.json({ success: true, data: rows, pagination });
});

/** [AD-01] Chi tiết participant (admin) kèm 2 ảnh KYC. */
export const getParticipant = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const participant = await participantRepository.findSafeById(id);
  if (!participant) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }
  return ok(res, participant);
});

/** [AD-02] Duyệt hồ sơ sinh viên (Approve KYC). */
export const approveParticipant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);
  const adminId = req.user?.id || 'admin';
  const ipAddress = req.ip || req.socket.remoteAddress;

  const current = await participantRepository.findById(id);
  if (!current) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }

  const updated = await participantRepository.approve(id, adminId, ipAddress);
  return ok(res, updated, `Đã phê duyệt thành công hồ sơ sinh viên ${current.full_name}`);
});

/** [AD-02] Từ chối hồ sơ sinh viên (Reject KYC kèm lý do). */
export const rejectParticipant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);
  const adminId = req.user?.id || 'admin';
  const ipAddress = req.ip || req.socket.remoteAddress;
  const { rejection_reason } = req.body as { rejection_reason?: string };

  if (!rejection_reason || !rejection_reason.trim()) {
    return fail(res, 'Vui lòng cung cấp lý do từ chối cụ thể', 400);
  }

  const current = await participantRepository.findById(id);
  if (!current) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }

  const updated = await participantRepository.reject(id, adminId, rejection_reason.trim(), ipAddress);
  return ok(res, updated, `Đã từ chối hồ sơ sinh viên ${current.full_name}`);
});

/** [AD-02] Khóa / Mở khóa / Đổi trạng thái tài khoản sinh viên. */
export const updateParticipantStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = paramId(req);
  const adminId = req.user?.id || 'admin';
  const ipAddress = req.ip || req.socket.remoteAddress;
  const { status, is_active, rejection_reason } = req.body as {
    status?: ParticipantStatus;
    is_active?: boolean;
    rejection_reason?: string;
  };

  let targetStatus: ParticipantStatus;
  if (status) {
    targetStatus = status;
  } else if (is_active !== undefined) {
    targetStatus = is_active ? 'approved' : 'rejected';
  } else {
    return fail(res, 'Trạng thái (status) là bắt buộc', 400);
  }

  const current = await participantRepository.findById(id);
  if (!current) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }

  const updated = await participantRepository.updateStatus(id, adminId, targetStatus, rejection_reason, ipAddress);
  return ok(res, updated, `Đã cập nhật trạng thái tài khoản sinh viên thành: ${targetStatus}`);
});

/** [AD-02 Bridge] Endpoint tổng hợp review cho legacy/frontend calls. */
export const reviewParticipant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { participant_id, action, rejection_reason } = req.body as {
    participant_id?: string;
    action?: 'approve' | 'reject';
    rejection_reason?: string;
  };

  const id = participant_id || paramId(req);
  if (!id) {
    return fail(res, 'ID sinh viên là bắt buộc', 400);
  }

  const adminId = req.user?.id || 'admin';
  const ipAddress = req.ip || req.socket.remoteAddress;

  const current = await participantRepository.findById(id);
  if (!current) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }

  if (action === 'approve') {
    const updated = await participantRepository.approve(id, adminId, ipAddress);
    return ok(res, updated, `Đã phê duyệt hồ sơ sinh viên ${current.full_name}`);
  } else if (action === 'reject') {
    if (!rejection_reason || !rejection_reason.trim()) {
      return fail(res, 'Vui lòng cung cấp lý do từ chối cụ thể', 400);
    }
    const updated = await participantRepository.reject(id, adminId, rejection_reason.trim(), ipAddress);
    return ok(res, updated, `Đã từ chối hồ sơ sinh viên ${current.full_name}`);
  } else {
    return fail(res, 'Hành động không hợp lệ (approve hoặc reject)', 400);
  }
});

/** Tạo participant mới thủ công (Admin). */
export const createParticipant = asyncHandler(async (req, res: Response) => {
  const {
    account_type = 'internal',
    username,
    password,
    full_name,
    student_id,
    email,
    phone_number,
    university_name,
    class_name,
    faculty_name,
    student_card_url,
    selfie_with_student_card_url,
    status = 'approved',
  } = req.body as ParticipantBody;

  if (!username && !student_id && !email) {
    return fail(res, 'MSSV, Tên đăng nhập hoặc Email là bắt buộc', 400);
  }
  if (!full_name) {
    return fail(res, 'Họ và tên là bắt buộc', 400);
  }

  const cleanUsername = (username || student_id || email || '').trim();
  // [SRS 3.1] Canonical lowercase cho free/external accounts
  const isExternalType = !['internal', 'dut', 'dut_student'].includes(account_type);
  const normalizedUsername = isExternalType ? cleanUsername.toLowerCase() : cleanUsername;
  if (await participantRepository.usernameExists(normalizedUsername)) {
    return fail(res, 'Tên đăng nhập / MSSV đã tồn tại trong hệ thống', 400);
  }

  if (email && (await participantRepository.emailExists(email.trim()))) {
    return fail(res, 'Email này đã được sử dụng', 400);
  }

  const password_hash = await bcryptjs.hash(password || '123456', 10);
  const participant = await participantRepository.create({
    id: student_id ? student_id.trim() : undefined,
    account_type,
    username: normalizedUsername,
    password_hash,
    full_name: full_name.trim(),
    student_id: student_id ? student_id.trim() : cleanUsername,
    email: email ? email.trim() : null,
    phone_number: phone_number ? phone_number.trim() : null,
    university_name: university_name ? university_name.trim() : 'Trường Đại học Bách khoa - ĐHĐN (DUT)',
    class_name: class_name ? class_name.trim() : null,
    faculty_name: faculty_name ? faculty_name.trim() : null,
    student_card_url: student_card_url ?? null,
    selfie_with_student_card_url: selfie_with_student_card_url ?? null,
    status,
  });

  return created(res, participant, 'Tài khoản sinh viên được tạo thành công');
});

/** Cập nhật participant (Admin). */
export const updateParticipant = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const {
    account_type,
    username,
    password,
    full_name,
    student_id,
    email,
    phone_number,
    university_name,
    class_name,
    faculty_name,
    student_card_url,
    selfie_with_student_card_url,
    status,
  } = req.body as ParticipantBody;

  const participant = await participantRepository.findById(id);
  if (!participant) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }

  if (username && username.trim() !== participant.username) {
    // [SRS 3.1] Lowercase cho free/external accounts
    const effectiveType = account_type ?? participant.account_type;
    const isExternalUpdate = !['internal', 'dut', 'dut_student'].includes(effectiveType);
    const normalizedUsername = isExternalUpdate ? username.trim().toLowerCase() : username.trim();
    if (await participantRepository.usernameExists(normalizedUsername, id)) {
      return fail(res, 'Tên đăng nhập đã được sử dụng', 400);
    }
  }

  if (email && email.trim() !== participant.email) {
    if (await participantRepository.emailExists(email.trim(), id)) {
      return fail(res, 'Email đã được sử dụng', 400);
    }
  }

  let password_hash: string | undefined;
  if (password) {
    if (password.length < 6) {
      return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
    }
    password_hash = await bcryptjs.hash(password, 10);
  }

  // [SRS 3.1] Lowercase username cho free/external
  const effectiveType = account_type ?? participant.account_type;
  const isExternalFinal = !['internal', 'dut', 'dut_student'].includes(effectiveType);
  const finalUsername = username
    ? (isExternalFinal ? username.trim().toLowerCase() : username.trim())
    : participant.username;

  const updated = await participantRepository.update(id, {
    account_type: account_type ?? participant.account_type,
    username: finalUsername,
    full_name: full_name ? full_name.trim() : participant.full_name,
    student_id: student_id ? student_id.trim() : participant.student_id,
    email: email ? email.trim() : participant.email,
    phone_number: phone_number !== undefined ? (phone_number?.trim() || null) : participant.phone_number,
    university_name: university_name !== undefined ? (university_name?.trim() || null) : participant.university_name,
    class_name: class_name !== undefined ? (class_name?.trim() || null) : participant.class_name,
    faculty_name: faculty_name !== undefined ? (faculty_name?.trim() || null) : participant.faculty_name,
    student_card_url: student_card_url !== undefined ? student_card_url : participant.student_card_url,
    selfie_with_student_card_url: selfie_with_student_card_url !== undefined ? selfie_with_student_card_url : participant.selfie_with_student_card_url,
    status: status ?? participant.status,
    password_hash,
  });

  return ok(res, updated, 'Cập nhật hồ sơ sinh viên thành công');
});

/** Xóa participant (Admin). */
export const deleteParticipant = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const participant = await participantRepository.findById(id);
  if (!participant) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }

  await participantRepository.remove(id);
  return ok(res, undefined, 'Hồ sơ sinh viên đã được xóa thành công');
});
