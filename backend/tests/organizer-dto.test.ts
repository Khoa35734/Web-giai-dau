import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapOrganizerToDTO,
  mapUserCandidateToDTO,
  mapParticipantCandidateToDTO,
  type TournamentOrganizer,
  type SafeUser,
  type SafeParticipant,
} from '../src/types/index.ts';

describe('TASK_BE_201: DTO Mapping & Data Lifecycle [SYSTEM_RULES Section 1]', () => {
  it('should map raw DB TournamentOrganizer (snake_case) to camelCase TournamentOrganizerDTO', () => {
    const raw: TournamentOrganizer = {
      id: 'org-uuid-001',
      tournament_id: 'tour-uuid-100',
      organizer_type: 'seasonal',
      user_id: null,
      participant_id: '102210001',
      role: 'referee',
      custom_title: 'Trọng tài bàn 1',
      assigned_by: 'admin-uuid-999',
      assigned_at: '2026-09-02T03:00:00Z',
      user_name: null,
      user_email: null,
      participant_name: 'Nguyen Van A',
      participant_email: 'nva@sv.dut.udn.vn',
      student_id: '102210001',
      faculty_name: 'Khoa Công nghệ Thông tin',
      assigned_by_name: 'Admin Tổng',
    };

    const dto = mapOrganizerToDTO(raw);

    assert.equal(dto.id, 'org-uuid-001');
    assert.equal(dto.tournamentId, 'tour-uuid-100');
    assert.equal(dto.organizerType, 'seasonal');
    assert.equal(dto.userId, null);
    assert.equal(dto.participantId, '102210001');
    assert.equal(dto.role, 'referee');
    assert.equal(dto.customTitle, 'Trọng tài bàn 1');
    assert.equal(dto.assignedBy, 'admin-uuid-999');
    assert.equal(dto.assignedAt, '2026-09-02T03:00:00Z');
    assert.equal(dto.participantName, 'Nguyen Van A');
    assert.equal(dto.participantEmail, 'nva@sv.dut.udn.vn');
    assert.equal(dto.studentId, '102210001');
    assert.equal(dto.facultyName, 'Khoa Công nghệ Thông tin');
    assert.equal(dto.assignedByName, 'Admin Tổng');
  });

  it('should map SafeUser candidate to CandidateUserDTO', () => {
    const rawUser: SafeUser = {
      id: 'usr-001',
      username: 'ctv_le_van_b',
      email: 'ctv_b@dut.udn.vn',
      full_name: 'Lê Văn B',
      role: 'ctv',
      is_active: true,
    };

    const dto = mapUserCandidateToDTO(rawUser);

    assert.equal(dto.id, 'usr-001');
    assert.equal(dto.username, 'ctv_le_van_b');
    assert.equal(dto.email, 'ctv_b@dut.udn.vn');
    assert.equal(dto.fullName, 'Lê Văn B');
    assert.equal(dto.role, 'ctv');
    assert.equal(dto.isActive, true);
  });

  it('should map SafeParticipant candidate to CandidateParticipantDTO', () => {
    const rawParticipant: SafeParticipant = {
      id: '102210002',
      username: '102210002',
      full_name: 'Trần Thị C',
      student_id: '102210002',
      email: 'ttc@sv.dut.udn.vn',
      phone_number: '0905123456',
      university_name: 'Trường Đại học Bách khoa - ĐHĐN',
      faculty_name: 'Khoa ĐTVT',
      class_name: '21DT1',
      account_type: 'internal',
      status: 'approved',
      created_at: '2026-09-01T10:00:00Z',
    };

    const dto = mapParticipantCandidateToDTO(rawParticipant);

    assert.equal(dto.id, '102210002');
    assert.equal(dto.fullName, 'Trần Thị C');
    assert.equal(dto.studentId, '102210002');
    assert.equal(dto.phoneNumber, '0905123456');
    assert.equal(dto.facultyName, 'Khoa ĐTVT');
    assert.equal(dto.accountType, 'internal');
    assert.equal(dto.status, 'approved');
  });

  it('should process request body accepting both camelCase and snake_case fields', () => {
    const parseInput = (body: Record<string, any>) => ({
      organizerType: body.organizerType || body.organizer_type,
      userId: body.userId || body.user_id,
      participantId: body.participantId || body.participant_id,
      role: body.role,
      customTitle: body.customTitle || body.custom_title,
    });

    const camelCasePayload = {
      organizerType: 'permanent',
      userId: 'usr-100',
      role: 'co_organizer',
      customTitle: 'Phó Ban Tổ Chức',
    };

    const snakeCasePayload = {
      organizer_type: 'seasonal',
      participant_id: '102210003',
      role: 'seasonal_staff',
      custom_title: 'CTV Hỗ trợ kỹ thuật',
    };

    assert.deepEqual(parseInput(camelCasePayload), {
      organizerType: 'permanent',
      userId: 'usr-100',
      participantId: undefined,
      role: 'co_organizer',
      customTitle: 'Phó Ban Tổ Chức',
    });

    assert.deepEqual(parseInput(snakeCasePayload), {
      organizerType: 'seasonal',
      userId: undefined,
      participantId: '102210003',
      role: 'seasonal_staff',
      customTitle: 'CTV Hỗ trợ kỹ thuật',
    });
  });
});
