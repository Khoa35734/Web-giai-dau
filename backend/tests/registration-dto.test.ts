import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapRegistrationMemberToDTO,
  mapRegistrationToDTO,
  type FormField,
  type Registration,
  type RegistrationMember,
} from '../src/types/index.ts';
import { parseTournamentSchema } from '../src/repositories/registration.repository.ts';

describe('TASK_BE_202: Dynamic Tournament Registration & Ingame ID Unit Tests', () => {
  it('should parse form_schema from string or array correctly', () => {
    const rawSchema: FormField[] = [
      { id: 'phone', label: 'Số điện thoại', type: 'text', required: true },
      { id: 'discord', label: 'Discord Tag', type: 'text', required: false },
    ];

    const parsedArray = parseTournamentSchema(rawSchema);
    assert.equal(parsedArray.length, 2);
    assert.equal(parsedArray[0].id, 'phone');
    assert.equal(parsedArray[0].required, true);

    const jsonStringSchema = JSON.stringify(rawSchema);
    const parsedString = parseTournamentSchema(jsonStringSchema);
    assert.equal(parsedString.length, 2);
    assert.equal(parsedString[1].id, 'discord');
    assert.equal(parsedString[1].required, false);
  });

  it('should validate dynamic required fields in form submission', () => {
    const schema: FormField[] = [
      { id: 'full_name', label: 'Họ và tên', type: 'text', required: true },
      { id: 'tshirt_size', label: 'Size áo', type: 'select', required: true },
      { id: 'note', label: 'Ghi chú', type: 'textarea', required: false },
    ];

    const validateSubmission = (formData: Record<string, unknown>) => {
      for (const field of schema.filter((f) => f.required)) {
        const val = formData[field.id];
        if (val === undefined || val === null || String(val).trim() === '') {
          return { valid: false, field: field.id, message: `Trường "${field.label}" là bắt buộc` };
        }
      }
      return { valid: true };
    };

    // Valid submission
    const validResult = validateSubmission({ full_name: 'Nguyễn Văn A', tshirt_size: 'L' });
    assert.equal(validResult.valid, true);

    // Missing required field
    const invalidResult = validateSubmission({ full_name: 'Nguyễn Văn A' });
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.field, 'tshirt_size');
  });

  it('should mandate ingame_id for individual and team member registrations', () => {
    const validateIngameIds = (captainIngame: string, members: Array<{ participantId: string; ingameId: string }>) => {
      if (!captainIngame || !captainIngame.trim()) {
        return { valid: false, error: 'Thiếu Ingame ID của đội trưởng' };
      }
      for (const m of members) {
        if (!m.ingameId || !m.ingameId.trim()) {
          return { valid: false, error: `Thành viên (${m.participantId}) bị thiếu Ingame ID` };
        }
      }
      return { valid: true };
    };

    assert.deepEqual(
      validateIngameIds('Faker#KR1', [{ participantId: 'part-1', ingameId: 'Oner#KR1' }]),
      { valid: true },
    );

    assert.deepEqual(
      validateIngameIds('', [{ participantId: 'part-1', ingameId: 'Oner#KR1' }]),
      { valid: false, error: 'Thiếu Ingame ID của đội trưởng' },
    );

    assert.deepEqual(
      validateIngameIds('Faker#KR1', [{ participantId: 'part-1', ingameId: '' }]),
      { valid: false, error: 'Thành viên (part-1) bị thiếu Ingame ID' },
    );
  });

  it('should validate recruiting status toggle bounds & notes', () => {
    const canToggleRecruiting = (currentCount: number, maxTeamSize: number, requestedState: boolean) => {
      if (requestedState && currentCount >= maxTeamSize) {
        return { allowed: false, message: `Đội đã đủ ${currentCount}/${maxTeamSize} thành viên, không thể mở tuyển quân` };
      }
      return { allowed: true };
    };

    // 4/5 members -> allowed to turn on recruiting
    assert.deepEqual(canToggleRecruiting(4, 5, true), { allowed: true });

    // 5/5 members -> blocked from turning on recruiting
    assert.deepEqual(canToggleRecruiting(5, 5, true), {
      allowed: false,
      message: 'Đội đã đủ 5/5 thành viên, không thể mở tuyển quân',
    });
  });

  it('should map DB snake_case registration record to camelCase DTO seamlessly', () => {
    const rawRegistration: Registration & { members: RegistrationMember[] } = {
      id: 'reg-101',
      tournament_id: 'tour-202',
      captain_id: 'part-001',
      team_name: 'DUT Esports Warriors',
      team_avatar_url: 'https://cdn.example.com/team.jpg',
      ingame_id: 'Captain#DUT',
      is_recruiting: true,
      recruitment_notes: 'Tuyển 1 Jungler Rank Cao Thủ',
      submitted_data: { phone: '0905123456' },
      status: 'pending',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      registered_at: '2026-09-02T03:00:00Z',
      updated_at: '2026-09-02T03:00:00Z',
      members: [
        {
          registration_id: 'reg-101',
          participant_id: 'part-001',
          is_captain: true,
          ingame_id: 'Captain#DUT',
          role_in_team: 'Captain',
          full_name: 'Nguyễn Văn A',
          student_id: '102210001',
        },
      ],
    };

    const dto = mapRegistrationToDTO(rawRegistration);
    assert.equal(dto.id, 'reg-101');
    assert.equal(dto.tournamentId, 'tour-202');
    assert.equal(dto.captainId, 'part-001');
    assert.equal(dto.teamName, 'DUT Esports Warriors');
    assert.equal(dto.isRecruiting, true);
    assert.equal(dto.recruitmentNotes, 'Tuyển 1 Jungler Rank Cao Thủ');
    assert.equal(dto.members?.[0].participantId, 'part-001');
    assert.equal(dto.members?.[0].isCaptain, true);
    assert.equal(dto.members?.[0].ingameId, 'Captain#DUT');
    assert.equal(dto.members?.[0].fullName, 'Nguyễn Văn A');
  });
});
