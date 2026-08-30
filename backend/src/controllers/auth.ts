import type { Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import type { AuthenticatedParticipantRequest, AuthenticatedRequest } from '../middleware/auth.ts';
import { participantRepository } from '../repositories/participant.ts';
import { userRepository } from '../repositories/user.ts';
import { validateDutStudentId } from '../utils/dutIdentity.ts';
import type { ParticipantAccountType, ParticipantStatus, SafeParticipant, SafeUser, UserRole } from '../types/index.ts';
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

interface StudentRegisterBody {
  account_type?: 'internal' | 'external' | 'dut' | 'free' | 'dut_student';
  full_name?: string;
  username?: string;
  email?: string;
  phone_number?: string;
  university_name?: string;
  student_id?: string;
  faculty_name?: string;
  class_name?: string;
  password?: string;
  student_card_url?: string;
  selfie_with_student_card_url?: string;
}

interface StudentLoginBody {
  identifier?: string;
  login_identifier?: string;
  username?: string;
  email?: string;
  student_id?: string;
  password?: string;
}

interface UpdateProfileBody {
  full_name?: string;
  phone_number?: string;
  class_name?: string;
  faculty_name?: string;
  old_password?: string;
  password?: string;
}

interface ResubmitBody {
  identifier?: string;
  password?: string;
  full_name?: string;
  phone_number?: string;
  university_name?: string;
  faculty_name?: string;
  class_name?: string;
  student_card_url?: string;
  selfie_with_student_card_url?: string;
  new_password?: string;
}

function toSafeParticipant(participant: {
  id: string;
  account_type: ParticipantAccountType;
  username?: string | null;
  full_name: string;
  student_id?: string | null;
  email?: string | null;
  phone_number?: string | null;
  university_name?: string | null;
  faculty_name?: string | null;
  class_name?: string | null;
  student_card_url?: string | null;
  selfie_with_student_card_url?: string | null;
  status: ParticipantStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}): SafeParticipant {
  return {
    id: participant.id,
    account_type: participant.account_type,
    username: participant.username ?? null,
    full_name: participant.full_name,
    student_id: participant.student_id ?? null,
    email: participant.email ?? null,
    phone_number: participant.phone_number ?? null,
    university_name: participant.university_name ?? null,
    faculty_name: participant.faculty_name ?? null,
    class_name: participant.class_name ?? null,
    student_card_url: participant.student_card_url ?? null,
    selfie_with_student_card_url: participant.selfie_with_student_card_url ?? null,
    status: participant.status,
    approved_by: participant.approved_by ?? null,
    approved_at: participant.approved_at ?? null,
    rejection_reason: participant.rejection_reason ?? null,
    created_at: participant.created_at,
    updated_at: participant.updated_at,
  };
}

/** Sinh JWT cho Admin/CTV. */
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

/** Đăng nhập Admin / CTV qua username hoặc email. */
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

/** Lấy thông tin user Admin/CTV hiện tại. */
export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await userRepository.findSafeById(req.user!.id);
  if (!user) {
    return fail(res, 'Không tìm thấy người dùng', 404);
  }
  return ok(res, user);
});

// =============================================================================
// 2. SINH VIÊN KYC & AUTHENTICATION (SV-01, SV-02, SV-03, SV-04)
// =============================================================================

/**
 * [SRS 3.1 SV-01] ĐĂNG KÝ TÀI KHOẢN SINH VIÊN (KYC)
 * Chỉ yêu cầu 2 ảnh thẻ SV (Tuyệt đối không dùng CCCD).
 * Trạng thái khởi tạo: status = 'pending'
 */
export const studentRegister = asyncHandler(async (req, res: Response) => {
  const body = req.body as StudentRegisterBody;
  const {
    full_name,
    password,
    email,
    phone_number,
    university_name,
    student_id,
    faculty_name,
    class_name,
    username,
    student_card_url,
    selfie_with_student_card_url,
  } = body;

  // Validate các trường bắt buộc
  if (!full_name || !password || !email) {
    return fail(res, 'Họ tên, mật khẩu và email là bắt buộc', 400);
  }

  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  // Xác định account_type: internal (DUT) hoặc external (trường khác)
  const isDut =
    body.account_type === 'internal' ||
    body.account_type === 'dut' ||
    body.account_type === 'dut_student' ||
    (university_name && /Bách khoa|DUT/i.test(university_name));

  const resolvedAccountType: ParticipantAccountType = isDut ? 'internal' : 'external';

  let finalStudentId: string | null = student_id ? student_id.trim().toUpperCase() : null;
  let finalFacultyName: string | null = faculty_name?.trim() || null;

  if (isDut && finalStudentId) {
    const dutCheck = validateDutStudentId(finalStudentId);
    if (dutCheck.isValid && dutCheck.faculty_name && !finalFacultyName) {
      finalFacultyName = dutCheck.faculty_name;
    }
  }

  const cleanUsername = username ? username.trim().toLowerCase() : (finalStudentId || email.trim().toLowerCase());
  const cleanEmail = email.trim().toLowerCase();

  // Kiểm tra trùng lặp (username, email, student_id)
  const dupCheck = await participantRepository.checkDuplicate({
    username: cleanUsername,
    email: cleanEmail,
    student_id: finalStudentId ?? undefined,
  });

  if (dupCheck.duplicate) {
    return fail(res, dupCheck.message || 'Thông tin đăng ký đã tồn tại trong hệ thống', 409);
  }

  // Băm mật khẩu bằng bcryptjs (salt 10)
  const password_hash = await bcryptjs.hash(password, 10);

  // Tạo tài khoản sinh viên với status = 'pending'
  const createdParticipant = await participantRepository.create({
    account_type: resolvedAccountType,
    username: cleanUsername,
    password_hash,
    full_name: full_name.trim(),
    student_id: finalStudentId,
    email: cleanEmail,
    phone_number: phone_number?.trim() || null,
    university_name: university_name?.trim() || (isDut ? 'Trường Đại học Bách khoa - ĐHĐN (DUT)' : 'Trường Đại học khác'),
    faculty_name: finalFacultyName,
    class_name: class_name?.trim() || null,
    student_card_url: student_card_url || null,
    selfie_with_student_card_url: selfie_with_student_card_url || null,
    status: 'pending',
  });

  return res.status(201).json({
    success: true,
    message: 'Đăng ký tài khoản thành công! Hồ sơ của bạn đang chờ Ban tổ chức duyệt KYC.',
    status: 'pending',
    redirectTo: '/pending-approval',
    participant: createdParticipant,
    data: createdParticipant,
  });
});

/**
 * [SRS 3.1 SV-02] ĐĂNG NHẬP SINH VIÊN (Đa năng & Phân luồng theo trạng thái)
 * Đăng nhập bằng Email, MSSV hoặc Username.
 * - Approved: Cấp JWT Token -> Vào trang chủ / dashboard.
 * - Pending: Báo chờ duyệt -> Điều hướng tới /pending-approval.
 * - Rejected: Báo lý do -> Điều hướng tới /rejected-info.
 */
export const studentLogin = asyncHandler(async (req, res: Response) => {
  const body = req.body as StudentLoginBody;
  const loginId = body.login_identifier || body.identifier || body.username || body.email || body.student_id;
  const password = body.password;

  if (!loginId || !password) {
    return fail(res, 'Vui lòng nhập Email / MSSV / Tên đăng nhập và mật khẩu', 400);
  }

  const participant = await participantRepository.findByLoginIdentifier(loginId);
  if (!participant) {
    return fail(res, 'Thông tin đăng nhập hoặc mật khẩu không chính xác', 401);
  }

  const isValidPassword = await bcryptjs.compare(password, participant.password_hash);
  if (!isValidPassword) {
    return fail(res, 'Thông tin đăng nhập hoặc mật khẩu không chính xác', 401);
  }

  const safeParticipant = toSafeParticipant(participant);

  // 1. Nếu tài khoản ĐANG CHỜ DUYỆT (pending)
  if (participant.status === 'pending') {
    return res.status(200).json({
      success: true,
      message: 'Tài khoản của bạn đang chờ Ban tổ chức xét duyệt hồ sơ KYC.',
      status: 'pending',
      redirectTo: '/pending-approval',
      participant: safeParticipant,
      user: safeParticipant,
      data: safeParticipant,
    });
  }

  // 2. Nếu tài khoản BỊ TỪ CHỐI (rejected)
  if (participant.status === 'rejected') {
    return res.status(200).json({
      success: true,
      message: 'Hồ sơ KYC của bạn đã bị từ chối phê duyệt.',
      status: 'rejected',
      rejection_reason: participant.rejection_reason || 'Thông tin thẻ sinh viên không hợp lệ hoặc không rõ nét',
      redirectTo: '/rejected-info',
      participant: safeParticipant,
      user: safeParticipant,
      data: safeParticipant,
    });
  }

  // 3. Nếu tài khoản ĐÃ ĐƯỢC PHÊ DUYỆT (approved)
  const token = signParticipantToken(participant);

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    status: 'approved',
    redirectTo: '/',
    participant: safeParticipant,
    user: safeParticipant,
    data: safeParticipant,
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

/**
 * [SRS 3.1 SV-04] GỬI DUYỆT LẠI HỒ SƠ KHI BỊ TỪ CHỐI (RESUBMIT)
 * Cập nhật lại ảnh thẻ SV / thông tin và chuyển status về 'pending'
 */
export const participantResubmit = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const body = req.body as ResubmitBody;
  
  // Xác định ID sinh viên từ JWT (nếu có đăng nhập) hoặc từ identifier + password
  let participantId = req.participant?.id;

  if (!participantId) {
    const loginId = body.identifier;
    const pwd = body.password;
    if (!loginId || !pwd) {
      return fail(res, 'Vui lòng cung cấp thông tin xác thực tài khoản để gửi duyệt lại', 400);
    }
    const existing = await participantRepository.findByLoginIdentifier(loginId);
    if (!existing || !(await bcryptjs.compare(pwd, existing.password_hash))) {
      return fail(res, 'Xác thực tài khoản không chính xác', 401);
    }
    participantId = existing.id;
  }

  const current = await participantRepository.findById(participantId);
  if (!current) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }

  let newPasswordHash: string | undefined;
  if (body.new_password && body.new_password.length >= 6) {
    newPasswordHash = await bcryptjs.hash(body.new_password, 10);
  }

  const updated = await participantRepository.resubmit(participantId, {
    full_name: body.full_name?.trim() || current.full_name,
    phone_number: body.phone_number !== undefined ? (body.phone_number?.trim() || null) : current.phone_number,
    university_name: body.university_name !== undefined ? (body.university_name?.trim() || null) : current.university_name,
    faculty_name: body.faculty_name !== undefined ? (body.faculty_name?.trim() || null) : current.faculty_name,
    class_name: body.class_name !== undefined ? (body.class_name?.trim() || null) : current.class_name,
    student_card_url: body.student_card_url || current.student_card_url,
    selfie_with_student_card_url: body.selfie_with_student_card_url || current.selfie_with_student_card_url,
    password_hash: newPasswordHash,
  });

  return res.status(200).json({
    success: true,
    message: 'Hồ sơ đã được gửi duyệt lại thành công! Vui lòng chờ Ban tổ chức phê duyệt.',
    status: 'pending',
    redirectTo: '/pending-approval',
    participant: updated,
    data: updated,
  });
});

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES
// =============================================================================
export const dutRegister = studentRegister;
export const dutLogin = studentLogin;
export const freeRegister = studentRegister;
export const freeLogin = studentLogin;
