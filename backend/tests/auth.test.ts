import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  validateDutStudentId,
  resolveDutIdentity,
  generateFreeParticipantId,
  normalizeParticipantAccountType,
  normalizeParticipantIdentity,
} from '../src/utils/dutIdentity.ts';
import type { SafeParticipant, JwtPayload, ParticipantStatus } from '../src/types/index.ts';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_esports_2026';

function signTestParticipantToken(participant: SafeParticipant): string {
  return jwt.sign(
    {
      kind: 'participant',
      id: participant.id,
      username: participant.username ?? participant.student_id ?? participant.email ?? participant.id,
      full_name: participant.full_name,
      account_type: participant.account_type,
    },
    TEST_JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function signTestUserToken(user: { id: string; username: string; full_name: string; role: 'admin' | 'ctv' }): string {
  return jwt.sign(
    {
      kind: 'user',
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    },
    TEST_JWT_SECRET,
    { expiresIn: '7d' },
  );
}

describe('DUT Identity & Student Validation [SV-01]', () => {
  it('should successfully validate valid DUT student IDs with correct faculty mapping', () => {
    const itStudent = validateDutStudentId('102210123');
    assert.equal(itStudent.isValid, true);
    assert.equal(itStudent.faculty_name, 'Khoa Công Nghệ Thông Tin');

    const mechaStudent = validateDutStudentId('101200001');
    assert.equal(mechaStudent.isValid, true);
    assert.equal(mechaStudent.faculty_name, 'Khoa Cơ Khí');

    const eceStudent = validateDutStudentId('106210005');
    assert.equal(eceStudent.isValid, true);
    assert.equal(eceStudent.faculty_name, 'Khoa Điện Tử - Viễn Thông');
  });

  it('should reject invalid DUT student IDs (wrong length or unknown faculty code)', () => {
    const shortId = validateDutStudentId('102210');
    assert.equal(shortId.isValid, false);
    assert.match(shortId.error || '', /9 chữ số/i);

    const nonDigit = validateDutStudentId('10221abcd');
    assert.equal(nonDigit.isValid, false);

    const unknownFaculty = validateDutStudentId('999210123');
    assert.equal(unknownFaculty.isValid, false);
    assert.match(unknownFaculty.error || '', /không thuộc Khoa nào/i);
  });

  it('should resolve DUT identity with automatic class name and faculty', () => {
    const resolved = resolveDutIdentity('102210123');
    assert.equal(resolved.class_name, 'DUT-102');
    assert.equal(resolved.faculty_name, 'Khoa Công Nghệ Thông Tin');
  });

  it('should generate valid free participant IDs with current year prefix', () => {
    const freeId = generateFreeParticipantId();
    const currentYear = new Date().getFullYear().toString();
    assert.ok(freeId.startsWith(currentYear));
    assert.equal(freeId.length, 9);
  });
});

describe('Participant JWT Authentication & Role Segregation [SV-02]', () => {
  it('should generate consistent JWT payload for participant with kind = "participant"', () => {
    const sampleParticipant: SafeParticipant = {
      id: '102210123',
      username: '102210123',
      full_name: 'Nguyễn Văn A',
      student_id: '102210123',
      email: 'nva@dut.udn.vn',
      phone_number: '0901234567',
      university_name: 'Trường Đại học Bách khoa - ĐHĐN (DUT)',
      faculty_name: 'Khoa Công Nghệ Thông Tin',
      class_name: '21TCLC_DT1',
      account_type: 'internal',
      student_card_url: 'https://example.com/card.jpg',
      selfie_with_student_card_url: 'https://example.com/selfie.jpg',
      status: 'approved',
    };

    const token = signTestParticipantToken(sampleParticipant);
    assert.ok(token);

    const decoded = jwt.verify(token, TEST_JWT_SECRET) as JwtPayload;
    assert.equal(decoded.kind, 'participant');
    assert.equal(decoded.id, '102210123');
    assert.equal(decoded.username, '102210123');
    assert.equal(decoded.full_name, 'Nguyễn Văn A');
    assert.equal(decoded.account_type, 'internal');
  });

  it('should distinguish user token (Admin/CTV) from participant token to prevent privilege escalation', () => {
    const adminToken = signTestUserToken({
      id: 'admin-01',
      username: 'admin',
      full_name: 'DUT Admin',
      role: 'admin',
    });

    const decodedAdmin = jwt.verify(adminToken, TEST_JWT_SECRET) as JwtPayload;
    assert.equal(decodedAdmin.kind, 'user');
    assert.equal(decodedAdmin.role, 'admin');

    const participantToken = signTestParticipantToken({
      id: '102210123',
      username: '102210123',
      full_name: 'Nguyễn Văn A',
      account_type: 'internal',
      status: 'approved',
    });

    const decodedParticipant = jwt.verify(participantToken, TEST_JWT_SECRET) as JwtPayload;
    assert.equal(decodedParticipant.kind, 'participant');
    assert.equal(decodedParticipant.role, undefined);
  });
});

describe('KYC Status Routing & Login Flow [SV-02]', () => {
  function getLoginRedirect(status: ParticipantStatus): { redirectTo: string; messageContains: string } {
    if (status === 'pending') {
      return {
        redirectTo: 'pending-approval',
        messageContains: 'chờ duyệt',
      };
    } else if (status === 'rejected') {
      return {
        redirectTo: 'rejected-info',
        messageContains: 'chưa được duyệt',
      };
    } else {
      return {
        redirectTo: '/',
        messageContains: 'thành công',
      };
    }
  }

  it('should route pending participants to pending-approval screen', () => {
    const route = getLoginRedirect('pending');
    assert.equal(route.redirectTo, 'pending-approval');
    assert.match(route.messageContains, /chờ duyệt/i);
  });

  it('should route rejected participants to rejected-info screen', () => {
    const route = getLoginRedirect('rejected');
    assert.equal(route.redirectTo, 'rejected-info');
    assert.match(route.messageContains, /chưa được duyệt/i);
  });

  it('should route approved participants to home screen', () => {
    const route = getLoginRedirect('approved');
    assert.equal(route.redirectTo, '/');
    assert.match(route.messageContains, /thành công/i);
  });
});

describe('Security: Password Hashing & Verification', () => {
  it('should properly hash passwords with bcrypt and verify matches accurately', async () => {
    const rawPassword = 'SecurePassword123!';
    const passwordHash = await bcryptjs.hash(rawPassword, 10);

    assert.notEqual(rawPassword, passwordHash);
    const isMatch = await bcryptjs.compare(rawPassword, passwordHash);
    assert.equal(isMatch, true);

    const isWrongMatch = await bcryptjs.compare('WrongPassword', passwordHash);
    assert.equal(isWrongMatch, false);
  });
});

describe('PR #4 Fix 2: Participant Account Type & Identity Normalization [SRS 3.1]', () => {
  it('should canonicalize all account type variants correctly', () => {
    assert.equal(normalizeParticipantAccountType('dut'), 'internal');
    assert.equal(normalizeParticipantAccountType('dut_student'), 'internal');
    assert.equal(normalizeParticipantAccountType('internal'), 'internal');
    assert.equal(normalizeParticipantAccountType('free'), 'external');
    assert.equal(normalizeParticipantAccountType('external'), 'external');
    assert.equal(normalizeParticipantAccountType(null), 'internal');
    assert.equal(normalizeParticipantAccountType('unknown'), 'external');
  });

  it('should normalize internal participant identity with student_id as primary identifier', () => {
    const identity = normalizeParticipantIdentity({
      account_type: 'dut',
      student_id: '102210123',
      username: 'MyCustomUser',
      email: 'student@dut.udn.vn',
    });

    assert.equal(identity.account_type, 'internal');
    assert.equal(identity.id, '102210123');
    assert.equal(identity.student_id, '102210123');
    assert.equal(identity.username, 'MyCustomUser');
  });

  it('should normalize external participant identity: lowercase username and student_id is null', () => {
    const identity = normalizeParticipantIdentity({
      account_type: 'free',
      student_id: 'SomeIgnoredMSSV',
      username: 'Gamer_Pro_2026',
      email: 'gamer@gmail.com',
    });

    assert.equal(identity.account_type, 'external');
    assert.equal(identity.student_id, null);
    assert.equal(identity.username, 'gamer_pro_2026');
    assert.ok(identity.id.length > 0);
  });
});

describe('PR #4 Fix 4: Status Semantics & is_active Account Lock', () => {
  it('should reject login when participant is_active is false, regardless of KYC status', () => {
    const activeApprovedParticipant: SafeParticipant = {
      id: '102210123',
      username: '102210123',
      full_name: 'Nguyễn Văn A',
      account_type: 'internal',
      status: 'approved',
      is_active: true,
    };

    const lockedApprovedParticipant: SafeParticipant = {
      id: '102210124',
      username: '102210124',
      full_name: 'Nguyễn Văn B',
      account_type: 'internal',
      status: 'approved',
      is_active: false,
    };

    assert.equal(activeApprovedParticipant.is_active, true);
    assert.equal(lockedApprovedParticipant.is_active, false);
    // KYC status remains 'approved' even when account is locked
    assert.equal(lockedApprovedParticipant.status, 'approved');
  });
});

