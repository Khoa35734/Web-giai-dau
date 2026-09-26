import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { getTournamentStage } from '../src/utils/tournamentStage.ts';
import type { Tournament } from '../src/types/index.ts';

describe('Tournament Stages & Lifecycle Management [GD0 - GD4]', () => {
  const baseTournament: Tournament = {
    id: 't-123',
    code: 'DUT-TFT-01',
    name: 'DUT TFT Championship 2026',
    game_name: 'TFT',
    game_logo_url: null,
    banner_url: 'https://example.com/banner.jpg',
    participation_type: 'individual',
    max_participants: 64,
    min_team_size: 1,
    max_team_size: 1,
    registration_open_at: '2026-09-05T00:00:00Z',
    registration_close_at: '2026-09-10T23:59:59Z',
    start_at: '2026-09-12T08:00:00Z',
    end_at: '2026-09-15T18:00:00Z',
    checkin_open_at: '2026-09-12T07:00:00Z',
    checkin_close_at: '2026-09-12T07:50:00Z',
    description: null,
    location: 'Hội trường F - ĐHBK',
    use_external_link: false,
    external_registration_url: null,
    form_schema: [],
    created_by: null,
    approved_by: null,
    status: 'approved',
    created_at: '2026-09-01T00:00:00Z',
    approved_at: '2026-09-02T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
  };

  test('should classify as GD0 (Chưa mở đăng ký) when now < registration_open_at', () => {
    const now = new Date('2026-09-03T00:00:00Z');
    const info = getTournamentStage(baseTournament, now);
    assert.equal(info.stage, 'GD0');
    assert.equal(info.canRegister, false);
    assert.equal(info.canCancel, false);
    assert.equal(info.canUpdateInfo, false);
    assert.equal(info.canCheckin, false);
  });

  test('should classify as GD0 when tournament status is pending', () => {
    const now = new Date('2026-09-06T00:00:00Z');
    const info = getTournamentStage({ ...baseTournament, status: 'pending' }, now);
    assert.equal(info.stage, 'GD0');
    assert.equal(info.canRegister, false);
  });

  test('should classify as GD1 (Đang mở đăng ký) when registration is active', () => {
    const now = new Date('2026-09-07T12:00:00Z');
    const info = getTournamentStage(baseTournament, now);
    assert.equal(info.stage, 'GD1');
    assert.equal(info.canRegister, true);
    assert.equal(info.canCancel, true);
    assert.equal(info.canUpdateInfo, true);
    assert.equal(info.canCheckin, false);
  });

  test('should classify as GD2 (Đã đóng đăng ký) when registration closed but checkin not started', () => {
    const now = new Date('2026-09-11T12:00:00Z');
    const info = getTournamentStage(baseTournament, now);
    assert.equal(info.stage, 'GD2');
    assert.equal(info.canRegister, false);
    assert.equal(info.canCancel, false);
    assert.equal(info.canUpdateInfo, true);
    assert.equal(info.canCheckin, false);
  });

  test('should classify as GD3 (Check-in & Thi đấu) during match time', () => {
    const now = new Date('2026-09-12T07:30:00Z');
    const info = getTournamentStage(baseTournament, now);
    assert.equal(info.stage, 'GD3');
    assert.equal(info.canRegister, false);
    assert.equal(info.canCancel, false);
    assert.equal(info.canUpdateInfo, false); // Locked for tournament integrity
    assert.equal(info.canCheckin, true);
    assert.equal(info.canViewBrackets, true);
  });

  test('should classify as GD4 (Đã kết thúc) after end_at or when completed', () => {
    const now = new Date('2026-09-16T00:00:00Z');
    const info = getTournamentStage(baseTournament, now);
    assert.equal(info.stage, 'GD4');
    assert.equal(info.canRegister, false);
    assert.equal(info.canExportCert, true);

    const completedEarly = getTournamentStage(
      { ...baseTournament, status: 'completed' },
      new Date('2026-09-13T00:00:00Z'),
    );
    assert.equal(completedEarly.stage, 'GD4');
    assert.equal(completedEarly.canExportCert, true);
  });

  test('should classify as cancelled and disable mutations when tournament is cancelled', () => {
    const cancelled = getTournamentStage(
      { ...baseTournament, status: 'cancelled' },
      new Date('2026-09-07T00:00:00Z'),
    );
    assert.equal(cancelled.label, 'Đã hủy');
    assert.equal(cancelled.canRegister, false);
    assert.equal(cancelled.canCancel, false);
    assert.equal(cancelled.canUpdateInfo, false);
  });
});
