/**
 * Domain types shared across the backend application.
 * Map 1:1 với schema PostgreSQL (users, participants, tournaments, registrations, notifications, audit_logs).
 */

export type UserRole = 'admin' | 'ctv';

/** Canonical account types quy định trong SRS v1.3 và database_schema.sql */
export type CanonicalAccountType = 'internal' | 'external';
/** ParticipantAccountType bao gồm cả alias legacy 'dut', 'free' cho backward compatibility */
export type ParticipantAccountType = CanonicalAccountType | 'dut' | 'free';

export type ParticipantStatus = 'pending' | 'approved' | 'rejected';

export type TournamentStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'completed';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export type ParticipationType = 'individual' | 'team';

export interface User {
  id: string;
  username?: string | null;
  email?: string | null;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** User object WITHOUT sensitive fields (password_hash). */
export interface SafeUser {
  id: string;
  username?: string | null;
  email?: string | null;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Participant {
  id: string;
  username?: string | null;
  password_hash: string;
  full_name: string;
  student_id?: string | null;
  email?: string | null;
  phone_number?: string | null;
  university_name?: string | null;
  faculty_name?: string | null;
  class_name?: string | null;
  account_type: ParticipantAccountType;
  student_card_url?: string | null;
  selfie_with_student_card_url?: string | null;
  status: ParticipantStatus;
  is_active?: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafeParticipant {
  id: string;
  username?: string | null;
  full_name: string;
  student_id?: string | null;
  email?: string | null;
  phone_number?: string | null;
  university_name?: string | null;
  faculty_name?: string | null;
  class_name?: string | null;
  account_type: ParticipantAccountType;
  student_card_url?: string | null;
  selfie_with_student_card_url?: string | null;
  status: ParticipantStatus;
  is_active?: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'number' | 'file' | 'select';
  required: boolean;
  options?: string;
  description?: string;
}

/** form_schema lưu JSONB — có thể là array đã parse, hoặc chuỗi JSON thô. */
export type FormSchema = FormField[] | string | null;

export interface Tournament {
  id: string;
  code: string;
  name: string;
  game_name: string;
  game_logo_url: string | null;
  banner_url: string;
  participation_type: ParticipationType;
  max_participants: number;
  min_team_size: number | null;
  max_team_size: number | null;
  registration_open_at: string;
  registration_close_at: string;
  start_at: string;
  end_at: string;
  description: string | null;
  use_external_link: boolean;
  external_registration_url: string | null;
  form_schema: FormSchema;
  created_by: string | null;
  approved_by: string | null;
  status: TournamentStatus;
  created_at: string;
  approved_at: string | null;
  updated_at: string;
}

export interface Registration {
  id: string;
  tournament_id: string;
  captain_id: string;
  team_name: string | null;
  submitted_data: Record<string, unknown> | string;
  status: RegistrationStatus;
  registered_at: string;
  updated_at: string;
  is_auto_matched: boolean;
}

export interface RegistrationMember {
  registration_id: string;
  participant_id: string;
  is_captain: boolean;
  created_at?: string;
}

export interface JwtPayload {
  kind: 'user' | 'participant';
  id: string;
  email?: string;
  username?: string;
  full_name: string;
  role?: UserRole;
  account_type?: ParticipantAccountType;
}

export interface PaginationResult {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// =============================================================================
// DOMAIN TYPES: CHECK-IN, AI OCR, CERTIFICATES, NOTIFICATIONS, AUDIT LOGS
// =============================================================================

export type CheckinMethod = 'qr_scan' | 'proof_submission' | 'proof_upload' | 'ai_ocr' | 'manual_admin' | 'manual_override';
export type CheckinStatus = 'approved' | 'pending_review' | 'rejected';

export interface CheckIn {
  id: string;
  tournament_id: string;
  registration_id: string;
  participant_id: string;
  checkin_method: CheckinMethod;
  status: CheckinStatus;
  proof_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  ip_address?: string | null;
  device_info?: string | null;
  checked_in_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  notes?: string | null;
}

export type AiCheckinSourceType = 'congdong_lienquan' | 'custom_lobby' | 'other';
export type AiCheckinStatus = 'processing' | 'pending_review' | 'confirmed' | 'cancelled' | 'rejected';

export interface AiCheckinSession {
  id: string;
  tournament_id: string;
  match_id?: string | null;
  created_by: string;
  source_type: AiCheckinSourceType;
  status: AiCheckinStatus;
  total_detected: number;
  total_matched: number;
  image_purged: boolean;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
}

export interface AiCheckinDetection {
  id: string;
  session_id: string;
  raw_text: string;
  ocr_confidence?: number | null;
  bounding_box?: Record<string, unknown>;
  matched_participant_id?: string | null;
  matched_registration_id?: string | null;
  similarity_score?: number | null;
  is_manually_adjusted: boolean;
  is_confirmed: boolean;
  created_at: string;
}

export type CertificateType = 'participant' | 'organizer';

export interface Certificate {
  id: string;
  tournament_id: string;
  certificate_type: CertificateType;
  participant_id: string;
  registration_id?: string | null;
  organizer_id?: string | null;
  certificate_code: string;
  title: string;
  achievement_title?: string | null;
  certificate_url: string;
  qr_verify_url?: string | null;
  metadata?: Record<string, unknown>;
  is_revoked: boolean;
  issued_at: string;
}

export type NotificationRecipientType = 'user' | 'participant';
export type NotificationType = 'kyc_status' | 'team_request' | 'match_schedule' | 'checkin_status' | 'certificate_issued' | 'system';

export interface Notification {
  id: string;
  recipient_type: NotificationRecipientType;
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export type AuditActorRole = 'admin' | 'ctv' | 'participant' | 'system';

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_role: AuditActorRole;
  action: string;
  target_table: string;
  target_id?: string | null;
  payload?: Record<string, unknown>;
  ip_address?: string | null;
  created_at: string;
}

