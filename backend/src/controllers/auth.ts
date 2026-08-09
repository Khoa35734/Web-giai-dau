import type { Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import type { AuthenticatedParticipantRequest, AuthenticatedRequest } from '../middleware/auth.ts';
import { participantRepository } from '../repositories/participant.ts';
import { userRepository } from '../repositories/user.ts';
import { resolveDutIdentity } from '../utils/dutIdentity.ts';
import type { ParticipantAccountType, SafeParticipant, SafeUser, UserRole } from '../types/index.ts';
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

interface DutRegisterBody {
  student_id?: string;
  password?: string;
  full_name?: string;
}

interface DutLoginBody {
  student_id?: string;
  password?: string;
}

interface FreeRegisterBody {
  username?: string;
  password?: string;
  full_name?: string;
  class_name?: string;
  faculty_name?: string;
}

interface FreeLoginBody {
  username?: string;
  password?: string;
}

interface SafeUserRow extends Omit<SafeUser, 'role'> {
  role: UserRole;
}

interface SafeParticipantRow extends Omit<SafeParticipant, 'account_type'> {
  account_type: ParticipantAccountType;
}

function toSafeParticipant(participant: {
  id: string;
  account_type: ParticipantAccountType;
  username: string;
  full_name: string;
  class_name: string | null;
  faculty_name: string | null;
  created_at?: string;
  updated_at?: string;
}): SafeParticipantRow {
  return {
    id: participant.id,
    account_type: participant.account_type,
    username: participant.username,
    full_name: participant.full_name,
    class_name: participant.class_name,
    faculty_name: participant.faculty_name,
    created_at: participant.created_at,
    updated_at: participant.updated_at,
  };
}

/** Sinh JWT cho user hoặc participant. */
function signToken(user: { id: string; email: string | null; full_name: string; role: UserRole }): string {
  return jwt.sign(
    { kind: 'user', id: user.id, email: user.email ?? undefined, full_name: user.full_name, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpire as jwt.SignOptions['expiresIn'] },
  );
}

function signParticipantToken(participant: {
  id: string;
  username: string;
  full_name: string;
  account_type: ParticipantAccountType;
}): string {
  return jwt.sign(
    {
      kind: 'participant',
      id: participant.id,
      username: participant.username,
      full_name: participant.full_name,
      account_type: participant.account_type,
    },
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
      role: user.role,
    },
  });
});

/** ĐĂNG KÝ DUT — đăng ký bằng student_id (public). */
export const dutRegister = asyncHandler(async (req, res: Response) => {
  const { student_id, password, full_name } = req.body as DutRegisterBody;

  // Validate bắt buộc
  if (!student_id || !password || !full_name) {
    return fail(res, 'student_id, mật khẩu và họ tên là bắt buộc', 400);
  }

  const sid = student_id.trim().toUpperCase();
  const student_idRegex = /^\d{8,15}$/;
  if (!student_idRegex.test(sid)) {
    return fail(res, 'student_id không hợp lệ (chỉ chấp nhận số, 8-15 ký tự)', 400);
  }

  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  // Kiểm tra trùng
  if (await participantRepository.usernameExists(sid)) {
    return fail(res, 'student_id đã được đăng ký', 409);
  }

  const identity = resolveDutIdentity(sid);
  const password_hash = await bcryptjs.hash(password, 10);
  const participant = await participantRepository.create({
    id: sid,
    account_type: 'dut',
    username: sid,
    password_hash,
    full_name: full_name.trim(),
    class_name: identity.class_name,
    faculty_name: identity.faculty_name,
  });

  const token = signParticipantToken(participant as SafeParticipantRow);

  return res.status(201).json({
    success: true,
    message: 'Đăng ký thành công!',
    token,
    participant,
  });
});

/** ĐĂNG NHẬP DUT — bằng student_id (public). */
export const dutLogin = asyncHandler(async (req, res: Response) => {
  const { student_id, password } = req.body as DutLoginBody;

  if (!student_id || !password) {
    return fail(res, 'student_id và mật khẩu là bắt buộc', 400);
  }

  const sid = student_id.trim().toUpperCase();
  const participant = await participantRepository.findByUsername(sid);
  if (!participant || participant.account_type !== 'dut') {
    return fail(res, 'student_id hoặc mật khẩu không đúng', 401);
  }

  const isValidPassword = await bcryptjs.compare(password, participant.password_hash);
  if (!isValidPassword) {
    return fail(res, 'student_id hoặc mật khẩu không đúng', 401);
  }

  const token = signParticipantToken(participant as SafeParticipantRow);

  return res.json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    participant: toSafeParticipant(participant),
  });
});
function generateFreeParticipantId(): string {
  // 1. Lấy 4 số của năm hiện tại
  const year = new Date().getFullYear().toString(); 
  
  // 2. Random 5 số (từ 00000 đến 99999). 
  // Dùng padStart để đảm bảo nếu random ra số 7 thì nó sẽ biến thành '00007'
  const random5 = Math.floor(Math.random() * 100000).toString().padStart(5, '0'); 
  
  // 3. Ghép lại thành chuỗi 9 ký tự
  return year + random5; 
}
/** Đăng ký luồng tự do. */
export const freeRegister = asyncHandler(async (req, res: Response) => {
  const { username, password, full_name, class_name, faculty_name } = req.body as FreeRegisterBody;

  if (!username || !password || !full_name) {
    return fail(res, 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc', 400);
  }

  const normalizedUsername = username.trim().toLowerCase();
  const usernameRegex = /^[a-z0-9._-]{3,32}$/;
  if (!usernameRegex.test(normalizedUsername)) {
    return fail(res, 'Tên đăng nhập không hợp lệ (3-32 ký tự, chỉ dùng chữ, số và . _ -)', 400);
  }

  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  if (await participantRepository.usernameExists(normalizedUsername)) {
    return fail(res, 'Tên đăng nhập đã tồn tại', 409);
  }

  const password_hash = await bcryptjs.hash(password, 10);
  const generatedId = generateFreeParticipantId();
  const participant = await participantRepository.create({
    id: generatedId,
    account_type: 'free',
    username: normalizedUsername,
    password_hash,
    full_name: full_name.trim(),
    class_name: class_name?.trim() || null,
    faculty_name: faculty_name?.trim() || null,
  });

  const token = signParticipantToken(participant as SafeParticipantRow);

  return res.status(201).json({
    success: true,
    message: 'Đăng ký thành công!',
    token,
    participant: toSafeParticipant(participant),
  });
});

/** Đăng nhập luồng tự do bằng username. */
export const freeLogin = asyncHandler(async (req, res: Response) => {
  const { username, password } = req.body as FreeLoginBody;

  if (!username || !password) {
    return fail(res, 'Tên đăng nhập và mật khẩu là bắt buộc', 400);
  }

  const normalizedUsername = username.trim().toLowerCase();
  const participant = await participantRepository.findByUsername(normalizedUsername);
  if (!participant || participant.account_type !== 'free') {
    return fail(res, 'Tên đăng nhập hoặc mật khẩu không đúng', 401);
  }

  const isValidPassword = await bcryptjs.compare(password, participant.password_hash);
  if (!isValidPassword) {
    return fail(res, 'Tên đăng nhập hoặc mật khẩu không đúng', 401);
  }

  const token = signParticipantToken(participant as SafeParticipantRow);

  return res.json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    participant,
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

/** Lấy thông tin participant hiện tại (yêu cầu token participant). */
export const getParticipantMe = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const participant = await participantRepository.findSafeById(req.participant!.id);
  if (!participant) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }
  return ok(res, participant);
});

export const studentRegister = dutRegister;
export const studentLogin = dutLogin;
