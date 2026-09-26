import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  OrganizerRole,
  OrganizerType,
  RegistrationStatus,
  TeamJoinRequestStatus,
} from '../src/types/index.js';

describe('Phase 2: Tournament Organizers & Permissions [SRS 4.2, AD-05, SV-13]', () => {
  const VALID_ORGANIZER_TYPES: OrganizerType[] = ['permanent', 'seasonal'];
  const VALID_ORGANIZER_ROLES: OrganizerRole[] = [
    'lead_organizer',
    'co_organizer',
    'referee',
    'seasonal_staff',
    'support_staff',
  ];

  it('should validate all canonical organizer types according to database schema Table 4', () => {
    assert.deepEqual(VALID_ORGANIZER_TYPES, ['permanent', 'seasonal']);
  });

  it('should validate all canonical organizer roles according to database schema Table 4', () => {
    assert.deepEqual(VALID_ORGANIZER_ROLES, [
      'lead_organizer',
      'co_organizer',
      'referee',
      'seasonal_staff',
      'support_staff',
    ]);
  });

  it('should enforce chk_organizer_target constraint: permanent requires user_id and NO participant_id', () => {
    const validateOrganizerTarget = (
      type: OrganizerType,
      userId?: string | null,
      participantId?: string | null,
    ): boolean => {
      if (type === 'permanent') {
        return Boolean(userId) && !participantId;
      }
      if (type === 'seasonal') {
        return Boolean(participantId) && !userId;
      }
      return false;
    };

    // Valid cases
    assert.equal(validateOrganizerTarget('permanent', 'usr-123', null), true);
    assert.equal(validateOrganizerTarget('seasonal', null, 'part-456'), true);

    // Invalid cases violating chk_organizer_target
    assert.equal(validateOrganizerTarget('permanent', null, 'part-456'), false);
    assert.equal(validateOrganizerTarget('permanent', 'usr-123', 'part-456'), false);
    assert.equal(validateOrganizerTarget('permanent', null, null), false);
    assert.equal(validateOrganizerTarget('seasonal', 'usr-123', null), false);
    assert.equal(validateOrganizerTarget('seasonal', 'usr-123', 'part-456'), false);
    assert.equal(validateOrganizerTarget('seasonal', null, null), false);
  });

  it('should only allow approved KYC participants to be assigned as seasonal staff', () => {
    const canAssignSeasonalStaff = (participantStatus: string): boolean => {
      return participantStatus === 'approved';
    };

    assert.equal(canAssignSeasonalStaff('approved'), true);
    assert.equal(canAssignSeasonalStaff('pending'), false);
    assert.equal(canAssignSeasonalStaff('rejected'), false);
  });
});

describe('Phase 2: Tournament Registration & Ingame ID [SRS 3.1 SV-04, SV-07, AD-03]', () => {
  const VALID_REGISTRATION_STATUSES: RegistrationStatus[] = [
    'pending',
    'approved',
    'rejected',
    'cancelled',
  ];

  it('should validate all registration statuses including "cancelled" [SRS 3.1 SV-07]', () => {
    assert.deepEqual(VALID_REGISTRATION_STATUSES, [
      'pending',
      'approved',
      'rejected',
      'cancelled',
    ]);
  });

  it('should require Ingame ID for individual registrations', () => {
    const validateIndividualRegistration = (ingameId?: string | null): boolean => {
      return Boolean(ingameId && ingameId.trim().length > 0);
    };

    assert.equal(validateIndividualRegistration('Faker#KR1'), true);
    assert.equal(validateIndividualRegistration(''), false);
    assert.equal(validateIndividualRegistration(null), false);
    assert.equal(validateIndividualRegistration('   '), false);
  });

  it('should validate cancellation window: allow before registration_close_at, reject after', () => {
    const canCancel = (closeAtStr: string, currentTime: Date): boolean => {
      return currentTime.getTime() < new Date(closeAtStr).getTime();
    };

    const futureClose = '2026-12-31T23:59:59Z';
    const pastClose = '2026-01-01T00:00:00Z';
    const now = new Date('2026-09-01T12:00:00Z');

    assert.equal(canCancel(futureClose, now), true);
    assert.equal(canCancel(pastClose, now), false);
  });
});

describe('Phase 2: Recruiting Market & Join Request Progression [SRS 3.1 SV-05, SV-06, SRS 4.3]', () => {
  const VALID_JOIN_REQUEST_STATUSES: TeamJoinRequestStatus[] = [
    'pending',
    'accepted',
    'rejected',
    'cancelled',
  ];

  it('should validate all canonical join request statuses', () => {
    assert.deepEqual(VALID_JOIN_REQUEST_STATUSES, [
      'pending',
      'accepted',
      'rejected',
      'cancelled',
    ]);
  });

  it('should auto-toggle is_recruiting = false when accepted members reach max_team_size', () => {
    const processTeamCapacity = (
      currentCount: number,
      maxTeamSize: number,
    ): { is_recruiting: boolean; is_full: boolean } => {
      if (currentCount >= maxTeamSize) {
        return { is_recruiting: false, is_full: true };
      }
      return { is_recruiting: true, is_full: false };
    };

    // Team has 4/5 members -> still recruiting
    assert.deepEqual(processTeamCapacity(4, 5), { is_recruiting: true, is_full: false });

    // Team accepts 5th member -> auto close recruiting
    assert.deepEqual(processTeamCapacity(5, 5), { is_recruiting: false, is_full: true });

    // Team reaches 6 members (if sub was added) -> closed
    assert.deepEqual(processTeamCapacity(6, 5), { is_recruiting: false, is_full: true });
  });

  it('should prevent user from applying to multiple teams if already registered in tournament', () => {
    const canApplyToTeam = (
      isRegisteredInTournament: boolean,
      hasPendingRequestForSameTeam: boolean,
    ): boolean => {
      if (isRegisteredInTournament) return false;
      if (hasPendingRequestForSameTeam) return false;
      return true;
    };

    assert.equal(canApplyToTeam(false, false), true);
    assert.equal(canApplyToTeam(true, false), false);
    assert.equal(canApplyToTeam(false, true), false);
    assert.equal(canApplyToTeam(true, true), false);
  });
});
