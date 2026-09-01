/**
 * Application-level enum validation & normalization helpers.
 * Đảm bảo dữ liệu đầu vào luôn tuân thủ strict enum constraints trước khi lưu vào CSDL.
 */

import type {
  CheckinMethod,
  CheckinStatus,
  AiCheckinSourceType,
  AiCheckinStatus,
  NotificationRecipientType,
  AuditActorRole,
  ParticipantStatus,
} from '../types/index.ts';

export const CHECKIN_METHODS: readonly CheckinMethod[] = [
  'qr_scan',
  'proof_submission',
  'proof_upload',
  'ai_ocr',
  'manual_admin',
  'manual_override',
] as const;

export const CHECKIN_STATUSES: readonly CheckinStatus[] = [
  'approved',
  'pending_review',
  'rejected',
] as const;

export const AI_SOURCE_TYPES: readonly AiCheckinSourceType[] = [
  'congdong_lienquan',
  'custom_lobby',
  'other',
] as const;

export const AI_SESSION_STATUSES: readonly AiCheckinStatus[] = [
  'processing',
  'pending_review',
  'confirmed',
  'cancelled',
  'rejected',
] as const;

export const NOTIFICATION_RECIPIENT_TYPES: readonly NotificationRecipientType[] = [
  'user',
  'participant',
] as const;

export const AUDIT_ACTOR_ROLES: readonly AuditActorRole[] = [
  'admin',
  'ctv',
  'participant',
  'system',
] as const;

export const PARTICIPANT_STATUSES: readonly ParticipantStatus[] = [
  'pending',
  'approved',
  'rejected',
] as const;

export function isValidCheckinMethod(method: unknown): method is CheckinMethod {
  return typeof method === 'string' && (CHECKIN_METHODS as readonly string[]).includes(method);
}

export function isValidCheckinStatus(status: unknown): status is CheckinStatus {
  return typeof status === 'string' && (CHECKIN_STATUSES as readonly string[]).includes(status);
}

export function isValidAiSourceType(source: unknown): source is AiCheckinSourceType {
  return typeof source === 'string' && (AI_SOURCE_TYPES as readonly string[]).includes(source);
}

export function isValidAiSessionStatus(status: unknown): status is AiCheckinStatus {
  return typeof status === 'string' && (AI_SESSION_STATUSES as readonly string[]).includes(status);
}

export function isValidNotificationRecipientType(type: unknown): type is NotificationRecipientType {
  return typeof type === 'string' && (NOTIFICATION_RECIPIENT_TYPES as readonly string[]).includes(type);
}

export function isValidAuditActorRole(role: unknown): role is AuditActorRole {
  return typeof role === 'string' && (AUDIT_ACTOR_ROLES as readonly string[]).includes(role);
}

export function isValidParticipantStatus(status: unknown): status is ParticipantStatus {
  return typeof status === 'string' && (PARTICIPANT_STATUSES as readonly string[]).includes(status);
}
