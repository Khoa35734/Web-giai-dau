import type { Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import type { AuthenticatedParticipantRequest, AuthenticatedRequest } from '../middleware/auth.ts';
import { participantRepository } from '../repositories/participant.ts';
import { userRepository } from '../repositories/user.ts';
import { resolveDutIdentity, validateDutStudentId, generateFreeParticipantId } from '../utils/dutIdentity.ts';
import type { ParticipantAccountType, SafeParticipant, SafeUser, UserRole } from '../types/index.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { created, fail, ok } from '../utils/response.ts';

interface RegisterBody {
  username?: string;
  password?: string;
  full_name?: string;
}

interface LoginBody {
  username?: string;
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
function signToken(user: { id: string; username?: string | null; email?: string | null; full_name: string; role: UserRole }): string {
  return jwt.sign(
    {
      kind: 'user',
      id: user.id,
      username: user.username ?? user.email ?? undefined,
      full_name: user.full_name,
      role: user.role,
    },
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

/** Sinh JWT cho Sinh viên (Participant) đã được duyệt. */
function signParticipantToken(participant: {
  id: string;
  username?: string | null;
  full_name: string;
  account_type: ParticipantAccountType;
  student_id?: string | null;
  email?: string | null;
}): string {
  return jwt.sign(
    {
      kind: 'participant',
      id: participant.id,
      username: participant.username ?? participant.student_id ?? participant.email ?? undefined,
      full_name: participant.full_name,
      account_type: participant.account_type,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpire as jwt.SignOptions['expiresIn'] },
  );
}

// =============================================================================
// 1. ADMIN & CTV AUTHENTICATION
// =============================================================================

/** Đăng ký tài khoản Admin (chỉ dùng nội bộ). */
export const register = asyncHandler(async (req, res: Response) => {
  const { username, password, full_name } = req.body as RegisterBody;

  if (!username || !password || !full_name) {
    return fail(res, 'Tất cả trường là bắt buộc', 400);
  }

  if (await userRepository.usernameExists(username)) {
    return fail(res, 'Tên đăng nhập đã tồn tại', 400);
  }

  const password_hash = await bcryptjs.hash(password, 10);
  const user = await userRepository.create({
    username,
    password_hash,
    full_name,
    role: 'admin',
    is_active: true,
  });

  return created(res, user, 'Tài khoản admin được tạo thành công');
});

/** Đăng nhập — trả JWT token + thông tin user (admin/ctv bằng username). */
export const login = asyncHandler(async (req, res: Response) => {
  const { username, password } = req.body as LoginBody;

  if (!username || !password) {
    return fail(res, 'Tên đăng nhập và mật khẩu là bắt buộc', 400);
  }

  const user = await userRepository.findByUsername(username);
  if (!user) {
    return fail(res, 'Tên đăng nhập hoặc mật khẩu không đúng', 401);
  }

  if (!['admin', 'ctv'].includes(user.role)) {
    return fail(res, 'Chỉ admin và CTV có thể đăng nhập tại đây', 403);
  }

  const isValidPassword = await bcryptjs.compare(password, user.password_hash);
  if (!isValidPassword) {
    return fail(res, 'Tên đăng nhập hoặc mật khẩu không đúng', 401);
  }

  if (!user.is_active) {
    return fail(res, 'Tài khoản của bạn đã bị vô hiệu hóa', 403);
  }

  const token = signToken(user);
  const redirectTo = user.role === 'admin' ? 'admin-dashboard' : 'ctv-dashboard';

  return res.json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    redirectTo,
    user: {
      id: user.id,
      username: user.username ?? user.email ?? null,
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
  return ok(res, user);
});

// =============================================================================
// 2. SINH VIÊN KYC & AUTHENTICATION (SV-01, SV-02, SV-03, SV-04)
// =============================================================================

  const sid = student_id.trim();
  const validation = validateDutStudentId(sid);
  if (!validation.isValid) {
    return fail(res, validation.error || 'student_id không hợp lệ', 400);
  }

  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  // Kiểm tra trùng
  if (await participantRepository.usernameExists(sid)) {
    return fail(res, 'student_id đã được đăng ký', 409);
  }

  // Băm mật khẩu bằng bcryptjs (salt 10)
  const password_hash = await bcryptjs.hash(password, 10);
  const participant = await participantRepository.create({
    id: sid,
    account_type: 'dut',
    username: sid,
    password_hash,
    full_name: full_name.trim(),
    class_name: `DUT-${sid.slice(0, 3)}`,
    faculty_name: validation.faculty_name,
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

  // 3. Nếu tài khoản ĐÃ ĐƯỢC PHÊ DUYỆT (approved)
  const token = signParticipantToken(participant);

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    participant,
  });
});

/**
 * [SRS 3.1 SV-03] LẤY HỒ SƠ CÁ NHÂN SINH VIÊN HIỆN TẠI
 */
export const getParticipantMe = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const participant = await participantRepository.findSafeById(req.participant!.id);
  if (!participant) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }
  return ok(res, participant);
});

/**
 * [SRS 3.1 SV-03] CẬP NHẬT HỒ SƠ CÁ NHÂN SINH VIÊN
 * Cho phép cập nhật SĐT, Lớp, Khoa và Đổi mật khẩu
 */
export const updateParticipantProfile = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const participantId = req.participant!.id;
  const { full_name, phone_number, class_name, faculty_name, old_password, password } = req.body as UpdateProfileBody;

  const current = await participantRepository.findById(participantId);
  if (!current) {
    return fail(res, 'Không tìm thấy tài khoản sinh viên', 404);
  }

  let newPasswordHash: string | undefined;

  // Nếu muốn đổi mật khẩu
  if (password) {
    if (!old_password) {
      return fail(res, 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới', 400);
    }
    const isMatch = await bcryptjs.compare(old_password, current.password_hash);
    if (!isMatch) {
      return fail(res, 'Mật khẩu hiện tại không chính xác', 400);
    }
    if (password.length < 6) {
      return fail(res, 'Mật khẩu mới phải có ít nhất 6 ký tự', 400);
    }
    newPasswordHash = await bcryptjs.hash(password, 10);
  }

  const updated = await participantRepository.updateProfile(participantId, {
    full_name: full_name?.trim() || current.full_name,
    phone_number: phone_number !== undefined ? (phone_number?.trim() || null) : current.phone_number,
    class_name: class_name !== undefined ? (class_name?.trim() || null) : current.class_name,
    faculty_name: faculty_name !== undefined ? (faculty_name?.trim() || null) : current.faculty_name,
    password_hash: newPasswordHash,
  });

  return ok(res, updated, 'Cập nhật thông tin cá nhân thành công');
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
