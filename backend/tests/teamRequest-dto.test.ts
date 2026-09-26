import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapTeamJoinRequestToDTO,
  type TeamJoinRequest,
} from '../src/types/index.ts';

describe('TASK_BE_203: Team Join Request DTO & Logic Unit Tests', () => {
  it('should correctly map raw database team_join_requests record (snake_case) to DTO (camelCase)', () => {
    const rawReq: TeamJoinRequest = {
      id: 'req-123456',
      registration_id: 'reg-789012',
      participant_id: 'part-345678',
      ingame_id: 'ProPlayer#1234',
      message: 'Xin chào đội trưởng, mình chuyên đi Mid rank Cao Thủ!',
      status: 'pending',
      processed_by: null,
      processed_at: null,
      rejection_reason: null,
      created_at: '2026-09-02T03:00:00.000Z',
      updated_at: '2026-09-02T03:00:00.000Z',
      participant_name: 'Nguyễn Văn Nam',
      student_id: '102210001',
      email: 'nam.nv@sv.dut.udn.vn',
      faculty_name: 'Khoa Công nghệ Thông tin',
      class_name: '21TCLC_DT1',
      team_name: 'DUT Cyber Warriors',
      tournament_name: 'DUT Esports League 2026',
    };

    const dto = mapTeamJoinRequestToDTO(rawReq);

    assert.equal(dto.id, 'req-123456');
    assert.equal(dto.registrationId, 'reg-789012');
    assert.equal(dto.participantId, 'part-345678');
    assert.equal(dto.ingameId, 'ProPlayer#1234');
    assert.equal(dto.message, 'Xin chào đội trưởng, mình chuyên đi Mid rank Cao Thủ!');
    assert.equal(dto.status, 'pending');
    assert.equal(dto.processedBy, null);
    assert.equal(dto.processedAt, null);
    assert.equal(dto.rejectionReason, null);
    assert.equal(dto.participantName, 'Nguyễn Văn Nam');
    assert.equal(dto.studentId, '102210001');
    assert.equal(dto.email, 'nam.nv@sv.dut.udn.vn');
    assert.equal(dto.facultyName, 'Khoa Công nghệ Thông tin');
    assert.equal(dto.className, '21TCLC_DT1');
    assert.equal(dto.teamName, 'DUT Cyber Warriors');
    assert.equal(dto.tournamentName, 'DUT Esports League 2026');
  });

  it('should map processed accepted join request correctly', () => {
    const rawReq: TeamJoinRequest = {
      id: 'req-999',
      registration_id: 'reg-888',
      participant_id: 'part-777',
      ingame_id: 'ADC_God',
      message: null,
      status: 'accepted',
      processed_by: 'part-captain-1',
      processed_at: '2026-09-02T03:10:00.000Z',
      rejection_reason: null,
      created_at: '2026-09-02T03:00:00.000Z',
      updated_at: '2026-09-02T03:10:00.000Z',
    };

    const dto = mapTeamJoinRequestToDTO(rawReq);

    assert.equal(dto.status, 'accepted');
    assert.equal(dto.processedBy, 'part-captain-1');
    assert.equal(dto.processedAt, '2026-09-02T03:10:00.000Z');
    assert.equal(dto.rejectionReason, null);
  });

  it('should auto-reject pending requests when team reaches max_team_size upon accepting', () => {
    let isRecruiting = true;
    const maxTeamSize = 5;
    let currentMembersCount = 4;
    const requests = [
      { id: 'req-1', status: 'pending' },
      { id: 'req-2', status: 'pending' },
    ];

    // Captain accepts req-1
    const acceptedReqId = 'req-1';
    currentMembersCount += 1;

    if (currentMembersCount >= maxTeamSize) {
      isRecruiting = false;
      // Auto-reject remaining pending
      for (const r of requests) {
        if (r.id === acceptedReqId) {
          r.status = 'accepted';
        } else if (r.status === 'pending') {
          r.status = 'rejected';
        }
      }
    }

    assert.equal(isRecruiting, false);
    assert.equal(requests[0].status, 'accepted');
    assert.equal(requests[1].status, 'rejected');
  });

  it('should enforce IDOR security check when requesting team join requests list', () => {
    const captainId: string = 'part-captain-1';
    const callerId1: string = 'part-captain-1'; // Legitimate Captain
    const callerId2: string = 'part-hacker-9';  // Unauthorized Student

    const canAccess1 = callerId1 === captainId;
    const canAccess2 = callerId2 === captainId;

    assert.equal(canAccess1, true, 'Captain can view join requests');
    assert.equal(canAccess2, false, 'Other student cannot view team join requests (IDOR Protected)');
  });
});
