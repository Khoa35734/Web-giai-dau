import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCheckinMethod,
  isValidCheckinStatus,
  isValidAiSourceType,
  isValidAiSessionStatus,
  isValidNotificationRecipientType,
  isValidAuditActorRole,
  isValidParticipantStatus,
  CHECKIN_METHODS,
  CHECKIN_STATUSES,
  AI_SOURCE_TYPES,
  AI_SESSION_STATUSES,
  NOTIFICATION_RECIPIENT_TYPES,
  AUDIT_ACTOR_ROLES,
  PARTICIPANT_STATUSES,
} from '../src/utils/enumValidators.ts';

describe('Application-level Enum Validators [SRS Integrity]', () => {
  describe('Checkin Methods & Statuses', () => {
    it('should validate all canonical checkin methods', () => {
      for (const method of CHECKIN_METHODS) {
        assert.equal(isValidCheckinMethod(method), true);
      }
      assert.equal(isValidCheckinMethod('bluetooth'), false);
      assert.equal(isValidCheckinMethod(''), false);
      assert.equal(isValidCheckinMethod(null), false);
      assert.equal(isValidCheckinMethod(undefined), false);
      assert.equal(isValidCheckinMethod(123), false);
    });

    it('should validate all canonical checkin statuses', () => {
      for (const status of CHECKIN_STATUSES) {
        assert.equal(isValidCheckinStatus(status), true);
      }
      assert.equal(isValidCheckinStatus('unknown_status'), false);
      assert.equal(isValidCheckinStatus('draft'), false);
    });
  });

  describe('AI Check-in Sessions', () => {
    it('should validate AI source types', () => {
      for (const source of AI_SOURCE_TYPES) {
        assert.equal(isValidAiSourceType(source), true);
      }
      assert.equal(isValidAiSourceType('facebook'), false);
      assert.equal(isValidAiSourceType(''), false);
    });

    it('should validate AI session statuses', () => {
      for (const status of AI_SESSION_STATUSES) {
        assert.equal(isValidAiSessionStatus(status), true);
      }
      assert.equal(isValidAiSessionStatus('completed'), false);
      assert.equal(isValidAiSessionStatus('in_review'), false);
    });
  });

  describe('Notifications & Audit Logs', () => {
    it('should validate notification recipient types', () => {
      for (const recipient of NOTIFICATION_RECIPIENT_TYPES) {
        assert.equal(isValidNotificationRecipientType(recipient), true);
      }
      assert.equal(isValidNotificationRecipientType('organizer'), false);
      assert.equal(isValidNotificationRecipientType('guest'), false);
    });

    it('should validate audit actor roles', () => {
      for (const role of AUDIT_ACTOR_ROLES) {
        assert.equal(isValidAuditActorRole(role), true);
      }
      assert.equal(isValidAuditActorRole('superadmin'), false);
      assert.equal(isValidAuditActorRole('anonymous'), false);
    });

    it('should validate participant statuses', () => {
      for (const status of PARTICIPANT_STATUSES) {
        assert.equal(isValidParticipantStatus(status), true);
      }
      assert.equal(isValidParticipantStatus('locked'), false);
      assert.equal(isValidParticipantStatus('banned'), false);
    });
  });
});
