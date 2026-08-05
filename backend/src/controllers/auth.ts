import type { Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { userRepository } from '../repositories/user.ts';
import type { SafeUser, UserRole } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { created, fail, ok } from '../utils/response.ts';

interface RegisterBody {
  email?: string;
  password?: string;
  full_name?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
}

interface StudentRegisterBody {
  student_id?: string;
  password?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  faculty?: string;
  class_name?: string;
  course?: string;
}

interface StudentLoginBody {
  student_id?: string;
  password?: string;
}

interface SafeUserRow extends Omit<SafeUser, 'role'> {
  role: UserRole;
}

/** Sinh JWT cho user. */
function signToken(user: { id: string; email: string | null; full_name: string; role: UserRole }): string {
  return jwt.sign(
    { id: user.id, email: user.email ?? undefined, full_name: user.full_name, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpire as jwt.SignOptions['expiresIn'] },
  );
}

/** Đăng ký tài khoản (chỉ sử dụng từ backend để tạo admin). */
export const register = asyncHandler(async (req, res: Response) => {
  const { email, password, full_name } = req.body as RegisterBody;

  if (!email || !password || !full_name) {
    return fail(res, 'Tất cả trường là bắt buộc', 400);
  }

  if (await userRepository.emailExists(email)) {
    return fail(res, 'Email đã tồn tại', 400);
  }

  const password_hash = await bcryptjs.hash(password, 10);
  const user = await userRepository.create({
    email,
    password_hash,
    full_name,
    role: 'admin',
    is_active: true,
  });

  return created(res, user as SafeUserRow, 'Tài khoản admin được tạo thành công');
});

/** Đăng nhập — trả JWT token + thông tin user (admin/ctv qua email). */
export const login = asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body as LoginBody;

  if (!email || !password) {
    return fail(res, 'Email và mật khẩu là bắt buộc', 400);
  }

  const user = await userRepository.findByEmail(email);
  if (!user) {
    return fail(res, 'Email hoặc mật khẩu không đúng', 401);
  }

  if (!['admin', 'ctv'].includes(user.role)) {
    return fail(res, 'Chỉ admin và CTV có thể đăng nhập', 403);
  }

  const isValidPassword = await bcryptjs.compare(password, user.password_hash);
  if (!isValidPassword) {
    return fail(res, 'Email hoặc mật khẩu không đúng', 401);
  }

  if (!user.is_active) {
    return fail(res, 'Tài khoản của bạn đã bị vô hiệu hóa', 403);
  }

  const token = signToken(user);

  return res.json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      student_id: user.student_id,
      phone: user.phone,
      faculty: user.faculty,
      class_name: user.class_name,
      course: user.course,
      role: user.role,
    },
  });
});

/** ĐĂNG KÝ SINH VIÊN — đăng ký bằng mã số sinh viên (public). */
export const studentRegister = asyncHandler(async (req, res: Response) => {
  const { student_id, password, full_name, email, phone, faculty, class_name, course } =
    req.body as StudentRegisterBody;

  // Validate bắt buộc
  if (!student_id || !password || !full_name) {
    return fail(res, 'Mã số sinh viên, mật khẩu và họ tên là bắt buộc', 400);
  }

  const sid = student_id.trim().toUpperCase();
  const mssvRegex = /^[A-Z0-9]{6,15}$/;
  if (!mssvRegex.test(sid)) {
    return fail(res, 'Mã số sinh viên không hợp lệ (6-15 ký tự chữ số, không dấu cách)', 400);
  }

  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  // Kiểm tra trùng
  if (await userRepository.studentIdExists(sid)) {
    return fail(res, 'Mã số sinh viên đã được đăng ký', 409);
  }
  if (email && (await userRepository.emailExists(email))) {
    return fail(res, 'Email đã được sử dụng', 409);
  }

  const password_hash = await bcryptjs.hash(password, 10);
  const user = await userRepository.create({
    email: email?.trim() || null,
    password_hash,
    full_name: full_name.trim(),
    student_id: sid,
    phone: phone?.trim() || null,
    faculty: faculty?.trim() || null,
    class_name: class_name?.trim() || null,
    course: course?.trim() || null,
    role: 'user',
    is_active: true,
  });

  const token = signToken(user);

  return res.status(201).json({
    success: true,
    message: 'Đăng ký thành công!',
    token,
    user,
  });
});

/** ĐĂNG NHẬP SINH VIÊN — bằng mã số sinh viên (public). */
export const studentLogin = asyncHandler(async (req, res: Response) => {
  const { student_id, password } = req.body as StudentLoginBody;

  if (!student_id || !password) {
    return fail(res, 'Mã số sinh viên và mật khẩu là bắt buộc', 400);
  }

  const sid = student_id.trim().toUpperCase();
  const user = await userRepository.findByStudentId(sid);
  if (!user) {
    return fail(res, 'Mã số sinh viên hoặc mật khẩu không đúng', 401);
  }

  const isValidPassword = await bcryptjs.compare(password, user.password_hash);
  if (!isValidPassword) {
    return fail(res, 'Mã số sinh viên hoặc mật khẩu không đúng', 401);
  }

  if (!user.is_active) {
    return fail(res, 'Tài khoản của bạn đã bị vô hiệu hóa', 403);
  }

  const token = signToken(user);

  return res.json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      student_id: user.student_id,
      phone: user.phone,
      faculty: user.faculty,
      class_name: user.class_name,
      course: user.course,
      role: user.role,
    },
  });
});

/** Lấy thông tin user hiện tại (yêu cầu token). */
export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await userRepository.findSafeById(req.user!.id);
  if (!user) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }
  return ok(res, user);
});
