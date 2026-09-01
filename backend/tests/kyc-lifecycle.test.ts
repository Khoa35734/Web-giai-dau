import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateDutStudentId, resolveDutIdentity } from '../src/utils/dutIdentity.ts';
import type { Participant, SafeParticipant, ParticipantStatus } from '../src/types/index.ts';

const TEST_JWT_SECRET = 'test_jwt_secret_esports_2026';

/** Mô phỏng cấu trúc Database In-Memory để test End-to-End trọn vẹn vòng đời KYC */
class MockKYCDatabase {
  private participants: Map<string, Participant> = new Map();
  public notifications: Array<{
    recipient_type: string;
    recipient_id: string;
    title: string;
    message: string;
    type: string;
    metadata: string;
  }> = [];
  public auditLogs: Array<{
    actor_id: string;
    actor_role: string;
    action: string;
    target_table: string;
    target_id: string;
    payload: string;
    ip_address: string | null;
  }> = [];

  async register(params: {
    student_id: string;
    full_name: string;
    password: string;
    student_card_url: string;
    selfie_with_student_card_url: string;
    email?: string;
    phone_number?: string;
  }): Promise<{ participant: SafeParticipant; token: string; redirectTo: string }> {
    if (!params.full_name || !params.password) {
      throw new Error('Họ và tên cùng mật khẩu là bắt buộc');
    }
    if (params.password.length < 6) {
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
    }

    const { isValid, faculty_name } = validateDutStudentId(params.student_id);
    if (!isValid) {
      throw new Error('MSSV không hợp lệ');
    }

    const identity = resolveDutIdentity(params.student_id);
    const password_hash = await bcryptjs.hash(params.password, 10);

    const participant: Participant = {
      id: params.student_id,
      username: params.student_id,
      password_hash,
      full_name: params.full_name,
      student_id: params.student_id,
      email: params.email ?? null,
      phone_number: params.phone_number ?? null,
      university_name: 'Trường Đại học Bách khoa - ĐHĐN (DUT)',
      faculty_name: identity.faculty_name,
      class_name: identity.class_name,
      account_type: 'internal',
      student_card_url: params.student_card_url,
      selfie_with_student_card_url: params.selfie_with_student_card_url,
      status: 'pending', // SV-01: Khởi tạo luôn là pending
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      rejected_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.participants.set(participant.id, participant);

    const safeParticipant: SafeParticipant = {
      id: participant.id,
      username: participant.username,
      full_name: participant.full_name,
      student_id: participant.student_id,
      email: participant.email,
      phone_number: participant.phone_number,
      university_name: participant.university_name,
      faculty_name: participant.faculty_name,
      class_name: participant.class_name,
      account_type: participant.account_type,
      student_card_url: participant.student_card_url,
      selfie_with_student_card_url: participant.selfie_with_student_card_url,
      status: participant.status,
    };

    const token = jwt.sign(
      {
        kind: 'participant',
        id: safeParticipant.id,
        username: safeParticipant.username,
        full_name: safeParticipant.full_name,
        account_type: safeParticipant.account_type,
      },
      TEST_JWT_SECRET,
      { expiresIn: '7d' },
    );

    return {
      participant: safeParticipant,
      token,
      redirectTo: 'pending-approval',
    };
  }

  async login(identifier: string, password: string): Promise<{
    success: boolean;
    status: ParticipantStatus;
    redirectTo: string;
    message: string;
  }> {
    const participant = this.participants.get(identifier);
    if (!participant) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác');
    }

    const isValidPassword = await bcryptjs.compare(password, participant.password_hash);
    if (!isValidPassword) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác');
    }

    let redirectTo = '/';
    let message = 'Đăng nhập thành công';

    if (participant.status === 'pending') {
      redirectTo = 'pending-approval';
      message = 'Tài khoản đang chờ duyệt KYC. Vui lòng đợi Ban tổ chức phê duyệt.';
    } else if (participant.status === 'rejected') {
      redirectTo = 'rejected-info';
      message = 'Hồ sơ KYC của bạn chưa được duyệt. Vui lòng xem lý do và nộp lại.';
    }

    return {
      success: true,
      status: participant.status,
      redirectTo,
      message,
    };
  }

  async adminReject(
    studentId: string,
    adminId: string,
    reason: string,
    ipAddress: string = '127.0.0.1',
  ): Promise<SafeParticipant> {
    const p = this.participants.get(studentId);
    if (!p) throw new Error('Không tìm thấy sinh viên');

    p.status = 'rejected';
    p.rejection_reason = reason;
    p.rejected_at = new Date().toISOString();
    p.updated_at = new Date().toISOString();

    // 1. Notifications schema khớp
    this.notifications.push({
      recipient_type: 'participant',
      recipient_id: studentId,
      title: 'Hồ sơ KYC bị từ chối',
      message: `Hồ sơ xác thực sinh viên của bạn chưa được duyệt. Lý do: ${reason}`,
      type: 'kyc_status',
      metadata: JSON.stringify({ participant_id: studentId, status: 'rejected', rejection_reason: reason }),
    });

    // 2. Audit logs schema khớp
    this.auditLogs.push({
      actor_id: adminId,
      actor_role: 'admin',
      action: 'REJECT_STUDENT',
      target_table: 'participants',
      target_id: studentId,
      payload: JSON.stringify({ status: 'rejected', rejection_reason: reason }),
      ip_address: ipAddress,
    });

    return { ...p };
  }

  async adminApprove(
    studentId: string,
    adminId: string,
    ipAddress: string = '127.0.0.1',
  ): Promise<SafeParticipant> {
    const p = this.participants.get(studentId);
    if (!p) throw new Error('Không tìm thấy sinh viên');

    p.status = 'approved';
    p.approved_by = adminId;
    p.approved_at = new Date().toISOString();
    p.rejection_reason = null;
    p.updated_at = new Date().toISOString();

    this.notifications.push({
      recipient_type: 'participant',
      recipient_id: studentId,
      title: 'Hồ sơ KYC đã được phê duyệt',
      message: 'Hồ sơ sinh viên của bạn đã được duyệt thành công.',
      type: 'kyc_status',
      metadata: JSON.stringify({ participant_id: studentId, status: 'approved' }),
    });

    this.auditLogs.push({
      actor_id: adminId,
      actor_role: 'admin',
      action: 'APPROVE_STUDENT',
      target_table: 'participants',
      target_id: studentId,
      payload: JSON.stringify({ status: 'approved', approved_by: adminId }),
      ip_address: ipAddress,
    });

    return { ...p };
  }

  async resubmit(
    studentId: string,
    data: { student_card_url?: string; selfie_with_student_card_url?: string },
  ): Promise<{ status: ParticipantStatus; redirectTo: string }> {
    const p = this.participants.get(studentId);
    if (!p) throw new Error('Không tìm thấy tài khoản sinh viên');

    // Chặn nếu hồ sơ không phải 'rejected'
    if (p.status !== 'rejected') {
      throw new Error(`Hồ sơ của bạn hiện đang ở trạng thái "${p.status}". Chỉ hồ sơ bị từ chối phê duyệt mới có thể nộp lại.`);
    }

    if (data.student_card_url) p.student_card_url = data.student_card_url;
    if (data.selfie_with_student_card_url) p.selfie_with_student_card_url = data.selfie_with_student_card_url;

    p.status = 'pending';
    p.rejection_reason = null;
    p.updated_at = new Date().toISOString();

    return {
      status: 'pending',
      redirectTo: 'pending-approval',
    };
  }

  getParticipant(id: string): Participant | undefined {
    return this.participants.get(id);
  }
}

describe('KYC End-to-End Lifecycle: Register -> Pending -> Reject -> Resubmit -> Approve', () => {
  const db = new MockKYCDatabase();
  const studentId = '102210123';
  const password = 'Password@123';

  it('Step 1: Student registers account -> Status is strictly "pending" [SV-01]', async () => {
    const res = await db.register({
      student_id: studentId,
      full_name: 'Nguyễn Văn Nam',
      password,
      student_card_url: 'https://dut-esports.vn/api/documents/doc_card_1.jpg',
      selfie_with_student_card_url: 'https://dut-esports.vn/api/documents/doc_selfie_1.jpg',
      email: 'nam.nv@dut.udn.vn',
      phone_number: '0905123456',
    });

    assert.equal(res.participant.status, 'pending');
    assert.equal(res.participant.faculty_name, 'Khoa Công Nghệ Thông Tin');
    assert.equal(res.participant.class_name, 'DUT-102');
    assert.equal(res.redirectTo, 'pending-approval');

    const decoded = jwt.verify(res.token, TEST_JWT_SECRET) as any;
    assert.equal(decoded.kind, 'participant');
    assert.equal(decoded.id, studentId);
  });

  it('Step 2: Student logs in while in "pending" status -> Directed to "pending-approval" [SV-02]', async () => {
    const loginRes = await db.login(studentId, password);
    assert.equal(loginRes.status, 'pending');
    assert.equal(loginRes.redirectTo, 'pending-approval');
    assert.match(loginRes.message, /chờ duyệt KYC/i);
  });

  it('Step 3: Block resubmission when status is still "pending" [SV-04 Protection]', async () => {
    await assert.rejects(
      async () => {
        await db.resubmit(studentId, {
          student_card_url: 'https://dut-esports.vn/api/documents/doc_card_retry.jpg',
        });
      },
      (err: Error) => {
        assert.match(err.message, /Chỉ hồ sơ bị từ chối phê duyệt mới có thể nộp lại/i);
        return true;
      },
    );
  });

  it('Step 4: Admin reviews and REJECTS KYC with specific reason [AD-02]', async () => {
    const rejectionReason = 'Ảnh thẻ sinh viên bị lóa đèn flash, không đọc được số thẻ.';
    const rejected = await db.adminReject(studentId, 'admin-uuid-001', rejectionReason, '192.168.1.100');

    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.rejection_reason, rejectionReason);

    // Kiểm tra Notification được tạo đúng schema
    assert.equal(db.notifications.length, 1);
    assert.equal(db.notifications[0].recipient_type, 'participant');
    assert.equal(db.notifications[0].recipient_id, studentId);
    assert.equal(db.notifications[0].type, 'kyc_status');

    // Kiểm tra Audit Log được lưu đúng schema
    assert.equal(db.auditLogs.length, 1);
    assert.equal(db.auditLogs[0].action, 'REJECT_STUDENT');
    assert.equal(db.auditLogs[0].target_table, 'participants');
    assert.equal(db.auditLogs[0].target_id, studentId);
    assert.equal(db.auditLogs[0].actor_role, 'admin');
  });

  it('Step 5: Student logs in while in "rejected" status -> Directed to "rejected-info" [SV-02]', async () => {
    const loginRes = await db.login(studentId, password);
    assert.equal(loginRes.status, 'rejected');
    assert.equal(loginRes.redirectTo, 'rejected-info');
    assert.match(loginRes.message, /chưa được duyệt/i);
  });

  it('Step 6: Student resubmits new photos -> Status resets to "pending" [SV-04]', async () => {
    const resubmitRes = await db.resubmit(studentId, {
      student_card_url: 'https://dut-esports.vn/api/documents/doc_card_clear.jpg',
      selfie_with_student_card_url: 'https://dut-esports.vn/api/documents/doc_selfie_clear.jpg',
    });

    assert.equal(resubmitRes.status, 'pending');
    assert.equal(resubmitRes.redirectTo, 'pending-approval');

    const participant = db.getParticipant(studentId);
    assert.equal(participant?.status, 'pending');
    assert.equal(participant?.rejection_reason, null);
    assert.equal(participant?.student_card_url, 'https://dut-esports.vn/api/documents/doc_card_clear.jpg');
  });

  it('Step 7: Admin reviews and APPROVES KYC [AD-02]', async () => {
    const approved = await db.adminApprove(studentId, 'admin-uuid-001', '192.168.1.100');

    assert.equal(approved.status, 'approved');
    assert.equal(approved.approved_by, 'admin-uuid-001');
    assert.equal(approved.rejection_reason, null);

    // Kiểm tra Notification thứ 2
    assert.equal(db.notifications.length, 2);
    assert.equal(db.notifications[1].title, 'Hồ sơ KYC đã được phê duyệt');

    // Kiểm tra Audit Log thứ 2
    assert.equal(db.auditLogs.length, 2);
    assert.equal(db.auditLogs[1].action, 'APPROVE_STUDENT');
  });

  it('Step 8: Student logs in after approval -> Directed to home "/" [SV-02]', async () => {
    const loginRes = await db.login(studentId, password);
    assert.equal(loginRes.status, 'approved');
    assert.equal(loginRes.redirectTo, '/');
    assert.match(loginRes.message, /Đăng nhập thành công/i);
  });

  it('Step 9: Block resubmission after approval [SV-04 Protection]', async () => {
    await assert.rejects(
      async () => {
        await db.resubmit(studentId, {
          student_card_url: 'https://dut-esports.vn/api/documents/doc_another.jpg',
        });
      },
      (err: Error) => {
        assert.match(err.message, /Chỉ hồ sơ bị từ chối phê duyệt mới có thể nộp lại/i);
        return true;
      },
    );
  });
});
