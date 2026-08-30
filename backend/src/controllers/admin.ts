import type { Response } from 'express';
import bcryptjs from 'bcryptjs';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { userRepository } from '../repositories/user.ts';
import { participantRepository } from '../repositories/participant.ts';
import { statsRepository } from '../repositories/stats.ts';
import type { SafeUser, UserRole, ParticipantAccountType } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { paramId } from '../utils/param.ts';
import { created, fail, ok } from '../utils/response.ts';
import { generateFreeParticipantId, validateDutStudentId } from '../utils/dutIdentity.ts';

interface ParticipantBody {
  account_type?: ParticipantAccountType;
  username?: string;
  password?: string;
  full_name?: string;
  class_name?: string;
  faculty_name?: string;
}

interface UserBody {
  username?: string;
  password?: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

interface SafeUserRow extends SafeUser {
  role: UserRole;
}

interface AdminDashboardData {
  user: SafeUserRow;
  stats: Awaited<ReturnType<typeof statsRepository.get>>;
}

const VALID_ROLES: UserRole[] = ['admin', 'ctv'];

/** Thống kê dashboard (admin). */
export const stats = asyncHandler(async (_req, res: Response) => {
  const data = await statsRepository.get();
  return res.json({ success: true, data });
});

/** Dữ liệu khởi tạo dashboard (admin) sau khi đăng nhập. */
export const dashboard = asyncHandler(async (req: import('../middleware/auth.ts').AuthenticatedRequest, res: Response) => {
  const [user, stats] = await Promise.all([
    userRepository.findSafeById(req.user!.id),
    statsRepository.get(),
  ]);

  if (!user) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }

  return ok(res, { user, stats } satisfies AdminDashboardData, 'Dashboard sẵn sàng');
});

// ===========================
// CTV MANAGEMENT
// ===========================

/** Danh sách CTV (admin) — phân trang, tìm kiếm, lọc trạng thái. */
export const listCtvs = asyncHandler(async (req, res: Response) => {
  const { search, status, page = '1', limit = '10' } = req.query as Record<string, string>;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, parseInt(limit, 10) || 10);

  const { rows, pagination } = await userRepository.listCtvs({ search, status }, currentPage, pageSize);
  return res.json({ success: true, data: rows, pagination });
});

/** Chi tiết CTV (admin). */
export const getCtv = asyncHandler(async (req, res: Response) => {
  const ctv = await userRepository.findCtvById(paramId(req));
  if (!ctv) {
    return fail(res, 'Không tìm thấy tài khoản CTV', 404);
  }
  return ok(res, ctv);
});

/** Tạo tài khoản CTV (admin). */
export const createCtv = asyncHandler(async (req, res: Response) => {
  const { username, password, full_name } = req.body as UserBody;

  if (!username || !password || !full_name) {
    return fail(res, 'Tên đăng nhập, mật khẩu và tên đầy đủ là bắt buộc', 400);
  }
  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }
  if (await userRepository.usernameExists(username)) {
    return fail(res, 'Tên đăng nhập đã tồn tại', 400);
  }

  const password_hash = await bcryptjs.hash(password, 10);
  const ctv = await userRepository.create({ username, password_hash, full_name, role: 'ctv', is_active: true });

  return created(res, ctv, 'Tài khoản CTV được tạo thành công');
});

/** Cập nhật CTV (admin). */
export const updateCtv = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const { username, full_name, password, is_active } = req.body as UserBody;

  const ctv = await userRepository.findCtvById(id);
  if (!ctv) {
    return fail(res, 'Không tìm thấy tài khoản CTV', 404);
  }

  if (username && username !== ctv.username) {
    if (await userRepository.usernameExists(username, id)) {
      return fail(res, 'Tên đăng nhập đã được sử dụng', 400);
    }
  }

  let password_hash: string | undefined;
  if (password) {
    if (password.length < 6) {
      return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
    }
    password_hash = await bcryptjs.hash(password, 10);
  }

  const updated = await userRepository.update(id, {
    username: username ?? ctv.username ?? null,
    full_name: full_name ?? ctv.full_name,
    password_hash,
    is_active: is_active ?? ctv.is_active,
  });

  return ok(res, updated as SafeUserRow, 'Tài khoản CTV được cập nhật thành công');
});

/** Bật/tắt trạng thái CTV nhanh (admin). */
export const updateCtvStatus = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const { is_active } = req.body as { is_active?: boolean };

  if (is_active === undefined) {
    return fail(res, 'Trạng thái là bắt buộc', 400);
  }

  const ctv = await userRepository.findCtvById(id);
  if (!ctv) {
    return fail(res, 'Không tìm thấy tài khoản CTV', 404);
  }

  const updated = await userRepository.updateStatus(id, is_active);
  return ok(res, updated as SafeUserRow, `Tài khoản CTV đã được ${is_active ? 'kích hoạt' : 'vô hiệu hóa'}`);
});

/** Xóa CTV (admin). */
export const deleteCtv = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);

  const ctv = await userRepository.findCtvById(id);
  if (!ctv) {
    return fail(res, 'Không tìm thấy tài khoản CTV', 404);
  }

  await userRepository.remove(id);
  return ok(res, undefined, 'Tài khoản CTV được xóa thành công');
});

// ===========================
// USER MANAGEMENT (ADMIN)
// ===========================

/** Danh sách user (admin) — phân trang, tìm kiếm, lọc role. */
export const listUsers = asyncHandler(async (req, res: Response) => {
  const { search, role = 'all', status, ban_status, page = '1', limit = '10' } = req.query as Record<string, string>;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, parseInt(limit, 10) || 10);
  const statusFilter = status || (ban_status === 'banned' ? 'inactive' : ban_status === 'active' ? 'active' : undefined);

  const { rows, pagination } = await userRepository.list({ search, role, status: statusFilter }, currentPage, pageSize);
  return res.json({ success: true, data: rows, pagination });
});

/** Chi tiết user (admin). */
export const getUser = asyncHandler(async (req, res: Response) => {
  const user = await userRepository.findSafeById(paramId(req));
  if (!user) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }
  return ok(res, user);
});

/** Tạo user (admin) — chọn role admin/ctv. */
export const createUser = asyncHandler(async (req, res: Response) => {
  const { username, password, full_name, role = 'ctv' } = req.body as UserBody;

  if (!username || !password || !full_name) {
    return fail(res, 'Tên đăng nhập, mật khẩu và tên đầy đủ là bắt buộc', 400);
  }
  if (!VALID_ROLES.includes(role ?? 'ctv')) {
    return fail(res, 'Vai trò không hợp lệ (admin/ctv)', 400);
  }
  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }
  if (await userRepository.usernameExists(username)) {
    return fail(res, 'Tên đăng nhập đã tồn tại', 400);
  }

  const password_hash = await bcryptjs.hash(password, 10);
  const user = await userRepository.create({ username, password_hash, full_name, role: role ?? 'ctv', is_active: true });

  return created(res, user, `Tài khoản ${role === 'admin' ? 'Admin' : 'CTV'} được tạo thành công`);
});

/** Cập nhật user (admin). */
export const updateUser = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const { username, full_name, password, role, is_active } = req.body as UserBody;

  const user = await userRepository.findById(id);
  if (!user) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }

  if (username && username !== user.username) {
    if (await userRepository.usernameExists(username, id)) {
      return fail(res, 'Tên đăng nhập đã được sử dụng', 400);
    }
  }
  if (role && !VALID_ROLES.includes(role)) {
    return fail(res, 'Vai trò không hợp lệ (admin/ctv)', 400);
  }

  let password_hash: string | undefined;
  if (password) {
    if (password.length < 6) {
      return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
    }
    password_hash = await bcryptjs.hash(password, 10);
  }

  const updated = await userRepository.update(id, {
    username: username ?? user.username ?? null,
    full_name: full_name ?? user.full_name,
    password_hash,
    role: role ?? user.role,
    is_active: is_active ?? user.is_active,
  });

  return ok(res, updated, 'Người dùng được cập nhật thành công');
});

/** Bật/tắt trạng thái user nhanh (admin). */
export const updateUserStatus = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const { is_active } = req.body as { is_active?: boolean };

  if (is_active === undefined) {
    return fail(res, 'Trạng thái là bắt buộc', 400);
  }

  const user = await userRepository.findById(id);
  if (!user) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }

  const updated = await userRepository.updateStatus(id, is_active);
  return ok(res, updated, `Tài khoản đã được ${is_active ? 'kích hoạt' : 'vô hiệu hóa'}`);
});

/** Xóa user (admin). */
export const deleteUser = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);

  const user = await userRepository.findById(id);
  if (!user) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }

  await userRepository.remove(id);
  return ok(res, undefined, 'Người dùng được xóa thành công');
});

// ===========================
// PARTICIPANT MANAGEMENT (ADMIN)
// ===========================

/** Danh sách participant (admin) — phân trang, tìm kiếm, lọc account_type. */
export const listParticipants = asyncHandler(async (req, res: Response) => {
  const { search, account_type, page = '1', limit = '10' } = req.query as Record<string, string>;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, parseInt(limit, 10) || 10);

  const { rows, pagination } = await participantRepository.list({ search, account_type }, currentPage, pageSize);
  return res.json({ success: true, data: rows, pagination });
});

/** Chi tiết participant (admin). */
export const getParticipant = asyncHandler(async (req, res: Response) => {
  const participant = await participantRepository.findSafeById(paramId(req));
  if (!participant) {
    return fail(res, 'Không tìm thấy người dùng (participant)', 404);
  }
  return ok(res, participant);
});

/** Tạo participant mới (admin). */
export const createParticipant = asyncHandler(async (req, res: Response) => {
  const { account_type = 'dut', username, password, full_name, class_name, faculty_name } = req.body as ParticipantBody;

  if (!username || !password || !full_name) {
    return fail(res, 'Tên đăng nhập / MSSV, mật khẩu và tên đầy đủ là bắt buộc', 400);
  }
  if (!['dut', 'free'].includes(account_type)) {
    return fail(res, 'Loại tài khoản không hợp lệ (dut/free)', 400);
  }
  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  const cleanUsername = username.trim();
  let finalId: string;
  let finalFaculty: string | null = faculty_name?.trim() || null;
  let finalClass: string | null = class_name?.trim() || null;

  if (account_type === 'dut') {
    const validation = validateDutStudentId(cleanUsername);
    if (!validation.isValid) {
      return fail(res, validation.error || 'MSSV không hợp lệ', 400);
    }
    finalId = cleanUsername; // Lấy MSSV làm ID tài khoản luôn
    finalFaculty = validation.faculty_name;
  } else {
    finalId = generateFreeParticipantId(); // Tự động sinh ID ngẫu nhiên cho luồng tự do
    finalFaculty = null;
    finalClass = null;
  }

  if (await participantRepository.usernameExists(cleanUsername)) {
    return fail(res, account_type === 'dut' ? 'MSSV này đã được đăng ký tài khoản' : 'Tên đăng nhập đã tồn tại', 400);
  }

  const password_hash = await bcryptjs.hash(password, 10);
  const participant = await participantRepository.create({
    id: finalId,
    account_type,
    username: cleanUsername,
    password_hash,
    full_name: full_name.trim(),
    class_name: finalClass,
    faculty_name: finalFaculty,
  });

  return created(res, participant, 'Tài khoản người dùng (participant) được tạo thành công');
});

/** Cập nhật participant (admin). */
export const updateParticipant = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);
  const { account_type, username, password, full_name, class_name, faculty_name } = req.body as ParticipantBody;

  const participant = await participantRepository.findById(id);
  if (!participant) {
    return fail(res, 'Không tìm thấy người dùng (participant)', 404);
  }

  const targetAccountType = account_type ?? participant.account_type;
  const cleanUsername = username ? username.trim() : (participant.username || '');
  let finalFaculty: string | null = faculty_name !== undefined ? (faculty_name?.trim() || null) : participant.faculty_name;
  let finalClass: string | null = class_name !== undefined ? (class_name?.trim() || null) : participant.class_name;

  if (targetAccountType === 'dut' || targetAccountType === 'internal') {
    if (cleanUsername) {
      const validation = validateDutStudentId(cleanUsername);
      if (!validation.isValid) {
        return fail(res, validation.error || 'MSSV không hợp lệ', 400);
      }
      finalFaculty = validation.faculty_name;
    }
  } else {
    finalFaculty = null;
    finalClass = null;
  }

  if (cleanUsername && cleanUsername !== participant.username) {
    if (await participantRepository.usernameExists(cleanUsername, id)) {
      return fail(res, 'Tên đăng nhập / MSSV đã được sử dụng', 400);
    }
  }

  let password_hash: string | undefined;
  if (password) {
    if (password.length < 6) {
      return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
    }
    password_hash = await bcryptjs.hash(password, 10);
  }

  const updated = await participantRepository.update(id, {
    account_type: targetAccountType,
    username: cleanUsername,
    full_name: full_name ? full_name.trim() : participant.full_name,
    class_name: finalClass,
    faculty_name: finalFaculty,
    password_hash,
  });

  return ok(res, updated, 'Cập nhật người dùng (participant) thành công');
});


/** Xóa participant (admin). */
export const deleteParticipant = asyncHandler(async (req, res: Response) => {
  const id = paramId(req);

  const participant = await participantRepository.findById(id);
  if (!participant) {
    return fail(res, 'Không tìm thấy người dùng (participant)', 404);
  }

  await participantRepository.remove(id);
  return ok(res, undefined, 'Xóa người dùng (participant) thành công');
});

/** [SRS 3.2 AD-02] Duyệt hoặc từ chối hồ sơ KYC sinh viên. */
export const reviewParticipant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { participant_id, id: bodyId, action, rejection_reason } = req.body as {
    participant_id?: string;
    id?: string;
    action?: 'approve' | 'reject';
    rejection_reason?: string;
  };
  const rawId = req.params.id || participant_id || bodyId;
  const targetId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!targetId) {
    return fail(res, 'ID sinh viên là bắt buộc', 400);
  }
  if (!action || !['approve', 'reject'].includes(action)) {
    return fail(res, 'Hành động duyệt không hợp lệ (approve/reject)', 400);
  }

  const current = await participantRepository.findById(targetId);
  if (!current) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }

  const updated = await participantRepository.review(targetId, {
    status: action === 'approve' ? 'approved' : 'rejected',
    rejection_reason: action === 'reject' ? (rejection_reason || 'Thông tin xác minh thẻ SV không hợp lệ') : null,
    approved_by: req.user!.id,
  });

  return ok(
    res,
    updated,
    action === 'approve' ? 'Phê duyệt hồ sơ sinh viên thành công' : 'Đã từ chối hồ sơ sinh viên',
  );
});


