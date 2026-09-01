import type { Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import type { AuthenticatedParticipantRequest, AuthenticatedRequest } from '../middleware/auth.ts';
import { participantRepository } from '../repositories/participant.ts';
import { userRepository } from '../repositories/user.ts';
import {
  resolveDutIdentity,
  validateDutStudentId,
  generateFreeParticipantId,
  normalizeParticipantIdentity,
  normalizeParticipantAccountType,
} from '../utils/dutIdentity.ts';
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

interface StudentRegisterBody {
  account_type?: ParticipantAccountType;
  student_id?: string;
  username?: string;
  email?: string;
  phone_number?: string;
  university_name?: string;
  password?: string;
  full_name?: string;
  class_name?: string;
  faculty_name?: string;
  student_card_url?: string;
  selfie_with_student_card_url?: string;
}

interface StudentLoginBody {
  login_identifier?: string;
  student_id?: string;
  username?: string;
  email?: string;
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
  username?: string | null;
  student_id?: string | null;
  class_name?: string | null;
  faculty_name?: string | null;
  student_card_url?: string | null;
  selfie_with_student_card_url?: string | null;
  new_password?: string;
}

/** Sinh JWT cho user quản trị (Admin / CTV). */
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

/** Sinh JWT cho Sinh viên (Participant). */
function signParticipantToken(participant: SafeParticipant): string {
  return jwt.sign(
    {
      kind: 'participant',
      id: participant.id,
      username: participant.username ?? participant.student_id ?? participant.email ?? participant.id,
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

/** Đăng nhập Quản trị viên (admin/ctv bằng username). */
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

/** Lấy thông tin user quản trị hiện tại. */
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
 * [SV-01] ĐĂNG KÝ TÀI KHOẢN SINH VIÊN (KYC qua 2 ảnh thẻ SV)
 * Sau khi đăng ký thành công -> status = 'pending', điều hướng tới trang /pending-approval
 */
export const studentRegister = asyncHandler(async (req, res: Response) => {
  const {
    account_type = 'internal',
    student_id,
    username,
    email,
    phone_number,
    university_name,
    password,
    full_name,
    class_name,
    faculty_name,
    student_card_url,
    selfie_with_student_card_url,
  } = req.body as StudentRegisterBody;

  if (!password || !full_name) {
    return fail(res, 'Họ và tên cùng mật khẩu là bắt buộc', 400);
  }

  if (password.length < 6) {
    return fail(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  const rawId = student_id?.trim() || username?.trim() || email?.trim();
  if (!rawId) {
    return fail(res, 'Mã số sinh viên hoặc Email là bắt buộc', 400);
  }

  // [SRS 3.1] Chuẩn hóa toàn diện định danh (id, student_id, username, account_type)
  const identity = normalizeParticipantIdentity({
    account_type,
    student_id,
    username: rawId,
    email,
  });

  let finalFaculty = faculty_name?.trim() || null;
  let finalClass = class_name?.trim() || null;
  let finalUniversity = university_name?.trim() || 'Trường Đại học Bách khoa - ĐHĐN (DUT)';

  if (identity.account_type === 'internal' && identity.student_id) {
    const validation = validateDutStudentId(identity.student_id);
    if (validation.isValid) {
      finalFaculty = validation.faculty_name || finalFaculty;
      if (!finalClass) finalClass = `DUT-${identity.student_id.slice(0, 3)}`;
    }
  }

  // Kiểm tra trùng lặp
  if (email && (await participantRepository.emailExists(email.trim()))) {
    return fail(res, 'Email này đã được đăng ký tài khoản', 409);
  }

  if (identity.student_id && (await participantRepository.studentIdExists(identity.student_id))) {
    return fail(res, 'Mã số sinh viên này đã được đăng ký', 409);
  }

  if (await participantRepository.usernameExists(identity.username)) {
    return fail(res, 'Tên đăng nhập / MSSV này đã tồn tại', 409);
  }

  const password_hash = await bcryptjs.hash(password, 10);
  const participant = await participantRepository.create({
    id: identity.id,
    account_type: identity.account_type,
    username: identity.username,
    password_hash,
    full_name: full_name.trim(),
    student_id: identity.student_id,
    email: email ? email.trim() : null,
    phone_number: phone_number ? phone_number.trim() : null,
    university_name: finalUniversity,
    class_name: finalClass,
    faculty_name: finalFaculty,
    student_card_url: student_card_url ?? null,
    selfie_with_student_card_url: selfie_with_student_card_url ?? null,
    status: 'pending', // Luôn khởi tạo ở trạng thái pending chờ duyệt
  });

  const token = signParticipantToken(participant);

  return res.status(201).json({
    success: true,
    message: 'Đăng ký thành công! Hồ sơ của bạn đang chờ Ban tổ chức phê duyệt.',
    token,
    redirectTo: 'pending-approval',
    participant,
    data: participant,
  });
});

/**
 * [SV-02] ĐĂNG NHẬP SINH VIÊN (bằng Email / MSSV / Username)
 * - Nếu status = 'pending' -> redirectTo = 'pending-approval'
 * - Nếu status = 'rejected' -> redirectTo = 'rejected-info'
 * - Nếu status = 'approved' -> redirectTo = 'profile'
 */
export const studentLogin = asyncHandler(async (req, res: Response) => {
  const { login_identifier, student_id, username, email, password } = req.body as StudentLoginBody;
  const identifier = login_identifier || student_id || username || email;

  if (!identifier || !password) {
    return fail(res, 'Vui lòng nhập Mã sinh viên / Email và mật khẩu', 400);
  }

  // [SRS 3.1 SV-02, 5.1] Exact match tìm kiếm định danh đăng nhập
  const credentials = await participantRepository.findPasswordHashByLoginIdentifier(identifier);
  if (!credentials) {
    return fail(res, 'Tài khoản hoặc mật khẩu không chính xác', 401);
  }

  const isValidPassword = await bcryptjs.compare(password, credentials.password_hash);
  if (!isValidPassword) {
    return fail(res, 'Tài khoản hoặc mật khẩu không chính xác', 401);
  }

  // Lấy safe participant (không password_hash) cho response
  const safeParticipant = await participantRepository.findSafeById(credentials.id);
  if (!safeParticipant) {
    return fail(res, 'Không tìm thấy hồ sơ người dùng', 404);
  }

  // [SRS 3.2 AD-02] Kiểm tra trạng thái kích hoạt tài khoản
  if (safeParticipant.is_active === false) {
    return fail(res, 'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa tạm thời. Vui lòng liên hệ Ban tổ chức.', 403);
  }

  const token = signParticipantToken(safeParticipant);

  // Xác định trang điều hướng theo trạng thái KYC
  let redirectTo = '/';
  let message = 'Đăng nhập thành công';

  if (safeParticipant.status === 'pending') {
    redirectTo = 'pending-approval';
    message = 'Tài khoản đang chờ duyệt KYC. Vui lòng đợi Ban tổ chức phê duyệt.';
  } else if (safeParticipant.status === 'rejected') {
    redirectTo = 'rejected-info';
    message = 'Hồ sơ KYC của bạn chưa được duyệt. Vui lòng xem lý do và nộp lại.';
  }

  return res.json({
    success: true,
    message,
    token,
    redirectTo,
    status: safeParticipant.status,
    participant: safeParticipant,
    data: safeParticipant,
  });
});

/**
 * [SV-03] LẤY HỒ SƠ SINH VIÊN HIỆN TẠI
 */
export const getParticipantMe = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const participant = await participantRepository.findSafeById(req.participant!.id);
  if (!participant) {
    return fail(res, 'Không tìm thấy hồ sơ sinh viên', 404);
  }
  return ok(res, participant);
});

/**
 * [SV-03] CẬP NHẬT HỒ SƠ SINH VIÊN
 */
export const updateParticipantProfile = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  const participantId = req.participant!.id;
  const { full_name, phone_number, class_name, faculty_name, old_password, password } = req.body as UpdateProfileBody;

  const current = await participantRepository.findById(participantId);
  if (!current) {
    return fail(res, 'Không tìm thấy tài khoản sinh viên', 404);
  }

  let newPasswordHash: string | undefined;
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
 * [SV-04] NỘP LẠI HỒ SƠ KYC KHI BỊ TỪ CHỐI (RE-SUBMIT)
 * - Nguồn xác thực ưu tiên 1: req.participant (từ JWT Token). Cố định ID từ token, tuyệt đối không nhận ID qua body.
 * - Trường hợp fallback (không gửi token): Phải tìm kiếm qua exact identifier VÀ bắt buộc xác thực mật khẩu bcrypt.
 */
export const resubmitParticipant = asyncHandler(async (req: AuthenticatedParticipantRequest, res: Response) => {
  let targetId = req.participant?.id;
  const authHeader = req.headers.authorization;
  if (!targetId && authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.jwtSecret) as any;
      if (decoded?.id && decoded?.kind === 'participant') {
        targetId = decoded.id;
      }
    } catch {
      // ignore
    }
  }

  const {
    identifier,
    id,
    full_name,
    phone_number,
    university_name,
    student_id,
    class_name,
    faculty_name,
    student_card_url,
    selfie_with_student_card_url,
    new_password,
    password,
    current_password,
  } = req.body as any;

  // [SV-04] RÀNG BUỘC ĐỊNH DANH NGHIÊM NGẶT:
  // 1. NẾU ĐÃ CÓ TOKEN: targetId cố định từ token, KHÔNG nhận bất kỳ ID nào từ req.body
  //    (Ngăn chặn hoàn toàn việc người dùng A nộp đè hồ sơ người dùng B).
  // 2. NẾU KHÔNG CÓ TOKEN (Fallback): BẮT BUỘC phải xác thực mật khẩu hiện tại bằng bcrypt.
  if (!targetId) {
    const lookup = (id || identifier || student_id || (req.body as any).email || (req.body as any).username || '').toString().trim();
    if (!lookup) {
      return fail(res, 'Không xác định được tài khoản sinh viên cần nộp lại hồ sơ. Vui lòng đăng nhập hoặc cung cấp Mã sinh viên / Email.', 400);
    }

    const currentCreds = await participantRepository.findPasswordHashByLoginIdentifier(lookup);
    if (!currentCreds) {
      return fail(res, 'Không tìm thấy tài khoản sinh viên', 404);
    }

    const checkPass = current_password || password;
    if (!checkPass) {
      return fail(res, 'Vui lòng cung cấp mật khẩu tài khoản để xác thực quyền nộp lại hồ sơ', 401);
    }

    const isMatch = await bcryptjs.compare(checkPass, currentCreds.password_hash);
    if (!isMatch) {
      return fail(res, 'Mật khẩu xác thực tài khoản không chính xác', 401);
    }

    targetId = currentCreds.id;
  }

  const current = await participantRepository.findById(targetId);
  if (!current) {
    return fail(res, 'Không tìm thấy tài khoản sinh viên', 404);
  }

  // [SV-04] Chỉ cho phép nộp lại hồ sơ khi đang ở trạng thái bị từ chối (rejected)
  if (current.status !== 'rejected') {
    return fail(
      res,
      `Hồ sơ của bạn hiện đang ở trạng thái "${current.status}". Chỉ hồ sơ bị từ chối phê duyệt mới có thể nộp lại.`,
      400,
    );
  }

  const pass = new_password || (req.participant ? password : undefined);
  let password_hash: string | undefined;
  if (pass && pass.length >= 6) {
    password_hash = await bcryptjs.hash(pass, 10);
  }

  const updated = await participantRepository.resubmit(targetId, {
    full_name: full_name?.trim() || current.full_name,
    phone_number: phone_number !== undefined ? (phone_number?.trim() || null) : current.phone_number,
    university_name: university_name !== undefined ? (university_name?.trim() || null) : current.university_name,
    student_id: student_id !== undefined ? (student_id?.trim() || null) : current.student_id,
    class_name: class_name !== undefined ? (class_name?.trim() || null) : current.class_name,
    faculty_name: faculty_name !== undefined ? (faculty_name?.trim() || null) : current.faculty_name,
    student_card_url: student_card_url !== undefined ? student_card_url : current.student_card_url,
    selfie_with_student_card_url:
      selfie_with_student_card_url !== undefined ? selfie_with_student_card_url : current.selfie_with_student_card_url,
    password_hash,
  });

  if (!updated) {
    return fail(res, 'Cập nhật nộp lại hồ sơ thất bại', 500);
  }

  const token = signParticipantToken(updated);

  return res.json({
    success: true,
    message: 'Hồ sơ đã được nộp lại thành công và chuyển sang trạng thái Chờ duyệt',
    token,
    redirectTo: 'pending-approval',
    participant: updated,
    data: updated,
  });
});

// Legacy aliases for backward compatibility
export const dutRegister = studentRegister;
export const dutLogin = studentLogin;
export const freeRegister = studentRegister;
export const freeLogin = studentLogin;
export const getProfile = getParticipantMe;
export const updateProfile = updateParticipantProfile;
