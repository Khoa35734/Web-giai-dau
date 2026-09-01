import type { Response } from 'express';
import bcryptjs from 'bcryptjs';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { userRepository } from '../repositories/user.ts';
import { statsRepository } from '../repositories/stats.ts';
import type { SafeUser, UserRole } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { paramId } from '../utils/param.ts';
import { created, fail, ok } from '../utils/response.ts';

// Re-export Participant Controller methods for unified admin API
export * from './participant.controller.ts';

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
export const dashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [user, stats] = await Promise.all([
    userRepository.findSafeById(req.user!.id),
    statsRepository.get(),
  ]);

  if (!user) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }

  return ok(res, { user, stats } satisfies AdminDashboardData, 'Dashboard sẵn sàng');
});

// =============================================================================
// CTV MANAGEMENT
// =============================================================================

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

// =============================================================================
// USER MANAGEMENT (ADMIN)
// =============================================================================

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
