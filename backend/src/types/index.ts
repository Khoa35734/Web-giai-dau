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

export type TournamentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'draft'
  | 'ongoing'
  | 'registration_opened'
  | 'registration_closed';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type ParticipationType = 'individual' | 'team';

export type OrganizerType = 'permanent' | 'seasonal';
export type OrganizerRole = 'lead_organizer' | 'co_organizer' | 'referee' | 'seasonal_staff' | 'support_staff';
export const ORGANIZER_ROLES: OrganizerRole[] = [
  'lead_organizer',
  'co_organizer',
  'referee',
  'seasonal_staff',
  'support_staff',
];

export interface TournamentOrganizer {
  id: string;
  tournament_id: string;
  organizer_type: OrganizerType;
  user_id?: string | null;
  participant_id?: string | null;
  role: OrganizerRole;
  custom_title?: string | null;
  assigned_by?: string | null;
  assigned_at: string;

  // Joined display info
  user_name?: string | null;
  user_email?: string | null;
  participant_name?: string | null;
  participant_email?: string | null;
  student_id?: string | null;
  faculty_name?: string | null;
  assigned_by_name?: string | null;
}

export interface TournamentOrganizerDTO {
  id: string;
  tournamentId: string;
  organizerType: OrganizerType;
  userId?: string | null;
  participantId?: string | null;
  role: OrganizerRole;
  customTitle?: string | null;
  assignedBy?: string | null;
  assignedAt: string;

  // Joined display info
  userName?: string | null;
  userEmail?: string | null;
  participantName?: string | null;
  participantEmail?: string | null;
  studentId?: string | null;
  facultyName?: string | null;
  assignedByName?: string | null;
}

export interface CandidateUserDTO {
  id: string;
  username?: string | null;
  email?: string | null;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface CandidateParticipantDTO {
  id: string;
  username?: string | null;
  fullName: string;
  studentId?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  universityName?: string | null;
  facultyName?: string | null;
  className?: string | null;
  accountType: ParticipantAccountType;
  status: ParticipantStatus;
  createdAt?: string;
}

export function mapOrganizerToDTO(raw: TournamentOrganizer): TournamentOrganizerDTO {
  return {
    id: raw.id,
    tournamentId: raw.tournament_id,
    organizerType: raw.organizer_type,
    userId: raw.user_id ?? null,
    participantId: raw.participant_id ?? null,
    role: raw.role,
    customTitle: raw.custom_title ?? null,
    assignedBy: raw.assigned_by ?? null,
    assignedAt: raw.assigned_at,
    userName: raw.user_name ?? null,
    userEmail: raw.user_email ?? null,
    participantName: raw.participant_name ?? null,
    participantEmail: raw.participant_email ?? null,
    studentId: raw.student_id ?? null,
    facultyName: raw.faculty_name ?? null,
    assignedByName: raw.assigned_by_name ?? null,
  };
}

export function mapUserCandidateToDTO(raw: SafeUser): CandidateUserDTO {
  return {
    id: raw.id,
    username: raw.username ?? null,
    email: raw.email ?? null,
    fullName: raw.full_name,
    role: raw.role,
    isActive: raw.is_active,
  };
}

export function mapParticipantCandidateToDTO(raw: SafeParticipant): CandidateParticipantDTO {
  return {
    id: raw.id,
    username: raw.username ?? null,
    fullName: raw.full_name,
    studentId: raw.student_id ?? null,
    email: raw.email ?? null,
    phoneNumber: raw.phone_number ?? null,
    universityName: raw.university_name ?? null,
    facultyName: raw.faculty_name ?? null,
    className: raw.class_name ?? null,
    accountType: raw.account_type,
    status: raw.status,
    createdAt: raw.created_at,
  };
}


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
  checkin_open_at?: string | null;
  checkin_close_at?: string | null;
  checkin_qr_secret?: string | null;
  certificate_template_url?: string | null;
  description: string | null;
  location?: string | null;
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
  team_avatar_url?: string | null;
  ingame_id?: string | null;
  is_recruiting: boolean;
  recruitment_notes?: string | null;
  submitted_data: Record<string, unknown> | string;
  status: RegistrationStatus;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  registered_at: string;
  updated_at: string;
}

export interface RegistrationMember {
  registration_id: string;
  participant_id: string;
  is_captain: boolean;
  ingame_id?: string | null;
  role_in_team?: string | null;
  joined_at?: string;
  created_at?: string;

  // Joined display info
  full_name?: string;
  student_id?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  university_name?: string | null;
  faculty_name?: string | null;
  class_name?: string | null;
  account_type?: string | null;
  participant_status?: string | null;
  student_card_url?: string | null;
  selfie_with_student_card_url?: string | null;
}

export interface RegistrationMemberDTO {
  registrationId: string;
  registration_id?: string;
  participantId: string;
  participant_id?: string;
  isCaptain: boolean;
  is_captain?: boolean;
  ingameId?: string | null;
  ingame_id?: string | null;
  roleInTeam?: string | null;
  role_in_team?: string | null;
  joinedAt?: string;
  joined_at?: string;
  createdAt?: string;
  created_at?: string;

  fullName?: string;
  full_name?: string;
  studentId?: string | null;
  student_id?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  universityName?: string | null;
  university_name?: string | null;
  facultyName?: string | null;
  faculty_name?: string | null;
  className?: string | null;
  class_name?: string | null;
  accountType?: string | null;
  account_type?: string | null;
  status?: string | null;
  participant_status?: string | null;
  studentCardUrl?: string | null;
  student_card_url?: string | null;
  selfieWithStudentCardUrl?: string | null;
  selfie_with_student_card_url?: string | null;
}

export interface RegistrationDTO {
  id: string;
  tournamentId: string;
  tournament_id?: string;
  captainId: string;
  captain_id?: string;
  teamName: string | null;
  teamAvatarUrl?: string | null;
  ingameId?: string | null;
  isRecruiting: boolean;
  recruitmentNotes?: string | null;
  submittedData: Record<string, unknown> | string;
  status: RegistrationStatus;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  registeredAt: string;
  registered_at?: string;
  updatedAt: string;
  updated_at?: string;
  members?: RegistrationMemberDTO[];
  tournamentName?: string;
  tournament_name?: string;
  gameName?: string;
  game_name?: string;
  captainName?: string;
  captain_name?: string;
  captainStudentId?: string;
  captain_student_id?: string;
  captainUsername?: string;
  captain_username?: string;
  captainUniversityName?: string;
  captain_university_name?: string;
  captainClassName?: string;
  captain_class_name?: string;
  captainFacultyName?: string;
  captain_faculty_name?: string;
  captainEmail?: string;
  captain_email?: string;
  captainPhone?: string;
  captain_phone?: string;
  captainAccountType?: string;
  captain_account_type?: string;
  captainStudentCardUrl?: string;
  captain_student_card_url?: string;
  captainSelfieWithStudentCardUrl?: string;
  captain_selfie_with_student_card_url?: string;

  // Joined tournament metadata fields
  participation_type?: string;
  participationType?: string;
  banner_url?: string;
  bannerUrl?: string;
  registration_open_at?: string;
  registrationOpenAt?: string;
  registration_close_at?: string;
  registrationCloseAt?: string;
  start_at?: string;
  startAt?: string;
  end_at?: string;
  endAt?: string;
  checkin_open_at?: string | null;
  checkinOpenAt?: string | null;
  location?: string | null;
  tournament_status?: string;
  tournamentStatus?: string;
  checkin_status?: string | null;
  checkinStatus?: string | null;
  is_captain?: boolean;
  isCaptain?: boolean;
}

export function mapRegistrationMemberToDTO(raw: any): RegistrationMemberDTO {
  const regId = raw.registration_id ?? raw.registrationId;
  const pId = raw.participant_id ?? raw.participantId;
  const isCap = Boolean(raw.is_captain ?? raw.isCaptain);
  const inId = raw.ingame_id ?? raw.ingameId ?? null;
  const rInTeam = raw.role_in_team ?? raw.roleInTeam ?? null;
  const jAt = raw.joined_at ?? raw.joinedAt ?? raw.created_at ?? raw.createdAt ?? new Date().toISOString();
  const cAt = raw.created_at ?? raw.createdAt ?? raw.joined_at ?? raw.joinedAt ?? new Date().toISOString();
  const fName = raw.full_name ?? raw.fullName ?? '';
  const sId = raw.student_id ?? raw.studentId ?? null;
  const uName = raw.username ?? raw.student_id ?? raw.studentId ?? null;
  const email = raw.email ?? null;
  const phone = raw.phone ?? raw.phone_number ?? raw.phoneNumber ?? null;
  const univName = raw.university_name ?? raw.universityName ?? null;
  const facName = raw.faculty_name ?? raw.facultyName ?? null;
  const clsName = raw.class_name ?? raw.className ?? null;
  const accType = raw.account_type ?? raw.accountType ?? null;
  const stt = raw.participant_status ?? raw.status ?? null;
  const cardUrl = raw.student_card_url ?? raw.studentCardUrl ?? null;
  const selfieUrl = raw.selfie_with_student_card_url ?? raw.selfieWithStudentCardUrl ?? null;

  return {
    registrationId: regId,
    registration_id: regId,
    participantId: pId,
    participant_id: pId,
    isCaptain: isCap,
    is_captain: isCap,
    ingameId: inId,
    ingame_id: inId,
    roleInTeam: rInTeam,
    role_in_team: rInTeam,
    joinedAt: jAt,
    joined_at: jAt,
    createdAt: cAt,
    created_at: cAt,

    fullName: fName,
    full_name: fName,
    studentId: sId,
    student_id: sId,
    username: uName,
    email,
    phone,
    phone_number: phone,
    universityName: univName,
    university_name: univName,
    facultyName: facName,
    faculty_name: facName,
    className: clsName,
    class_name: clsName,
    accountType: accType,
    account_type: accType,
    status: stt,
    participant_status: stt,
    studentCardUrl: cardUrl,
    student_card_url: cardUrl,
    selfieWithStudentCardUrl: selfieUrl,
    selfie_with_student_card_url: selfieUrl,
  };
}

export function mapRegistrationToDTO(
  raw: any,
): RegistrationDTO {
  const tId = raw.tournament_id ?? raw.tournamentId;
  const cId = raw.captain_id ?? raw.captainId;
  const regAt = raw.registered_at ?? raw.registeredAt;
  const upAt = raw.updated_at ?? raw.updatedAt;
  const tName = raw.tournament_name ?? raw.tournamentName;
  const gName = raw.game_name ?? raw.gameName;

  const capName = raw.captain_name ?? raw.captainName;
  const capStudId = raw.captain_student_id ?? raw.captainStudentId;
  const capUsername = raw.captain_username ?? raw.captainUsername;
  const capUniv = raw.captain_university_name ?? raw.captainUniversityName;
  const capClass = raw.captain_class_name ?? raw.captainClassName;
  const capFaculty = raw.captain_faculty_name ?? raw.captainFacultyName;
  const capEmail = raw.captain_email ?? raw.captainEmail;
  const capPhone = raw.captain_phone ?? raw.captainPhone;
  const capAccType = raw.captain_account_type ?? raw.captainAccountType;
  const capCardUrl = raw.captain_student_card_url ?? raw.captainStudentCardUrl;
  const capSelfieUrl = raw.captain_selfie_with_student_card_url ?? raw.captainSelfieWithStudentCardUrl;

  return {
    id: raw.id,
    tournamentId: tId,
    tournament_id: tId,
    captainId: cId,
    captain_id: cId,
    teamName: raw.team_name ?? raw.teamName ?? null,
    teamAvatarUrl: raw.team_avatar_url ?? raw.teamAvatarUrl ?? null,
    ingameId: raw.ingame_id ?? raw.ingameId ?? null,
    isRecruiting: Boolean(raw.is_recruiting ?? raw.isRecruiting),
    recruitmentNotes: raw.recruitment_notes ?? raw.recruitmentNotes ?? null,
    submittedData: typeof raw.submitted_data === 'string'
      ? (JSON.parse(raw.submitted_data) as Record<string, unknown>)
      : (raw.submitted_data ?? raw.submittedData ?? {}),
    status: raw.status,
    rejectionReason: raw.rejection_reason ?? raw.rejectionReason ?? null,
    reviewedBy: raw.reviewed_by ?? raw.reviewedBy ?? null,
    reviewedAt: raw.reviewed_at ?? raw.reviewedAt ?? null,
    registeredAt: regAt,
    registered_at: regAt,
    updatedAt: upAt,
    updated_at: upAt,
    members: Array.isArray(raw.members) ? raw.members.map(mapRegistrationMemberToDTO) : undefined,
    tournamentName: tName,
    tournament_name: tName,
    gameName: gName,
    game_name: gName,
    captainName: capName,
    captain_name: capName,
    captainStudentId: capStudId,
    captain_student_id: capStudId,
    captainUsername: capUsername,
    captain_username: capUsername,
    captainUniversityName: capUniv,
    captain_university_name: capUniv,
    captainClassName: capClass,
    captain_class_name: capClass,
    captainFacultyName: capFaculty,
    captain_faculty_name: capFaculty,
    captainEmail: capEmail,
    captain_email: capEmail,
    captainPhone: capPhone,
    captain_phone: capPhone,
    captainAccountType: capAccType,
    captain_account_type: capAccType,
    captainStudentCardUrl: capCardUrl,
    captain_student_card_url: capCardUrl,
    captainSelfieWithStudentCardUrl: capSelfieUrl,
    captain_selfie_with_student_card_url: capSelfieUrl,

    // Joined fields
    participation_type: raw.participation_type ?? raw.participationType,
    participationType: raw.participation_type ?? raw.participationType,
    banner_url: raw.banner_url ?? raw.bannerUrl,
    bannerUrl: raw.banner_url ?? raw.bannerUrl,
    registration_open_at: raw.registration_open_at ?? raw.registrationOpenAt,
    registrationOpenAt: raw.registration_open_at ?? raw.registrationOpenAt,
    registration_close_at: raw.registration_close_at ?? raw.registrationCloseAt,
    registrationCloseAt: raw.registration_close_at ?? raw.registrationCloseAt,
    start_at: raw.start_at ?? raw.startAt,
    startAt: raw.start_at ?? raw.startAt,
    end_at: raw.end_at ?? raw.endAt,
    endAt: raw.end_at ?? raw.endAt,
    checkin_open_at: raw.checkin_open_at ?? raw.checkinOpenAt,
    checkinOpenAt: raw.checkin_open_at ?? raw.checkinOpenAt,
    location: raw.location,
    tournament_status: raw.tournament_status ?? raw.tournamentStatus,
    tournamentStatus: raw.tournament_status ?? raw.tournamentStatus,
    checkin_status: raw.checkin_status ?? raw.checkinStatus,
    checkinStatus: raw.checkin_status ?? raw.checkinStatus,
    is_captain: raw.is_captain ?? raw.isCaptain,
    isCaptain: raw.is_captain ?? raw.isCaptain,
  };
}

export type TeamJoinRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface TeamJoinRequest {
  id: string;
  registration_id: string;
  participant_id: string;
  ingame_id: string;
  message?: string | null;
  status: TeamJoinRequestStatus;
  processed_by?: string | null;
  processed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;

  // Joined display info
  participant_name?: string;
  student_id?: string | null;
  email?: string | null;
  faculty_name?: string | null;
  class_name?: string | null;
  team_name?: string | null;
  tournament_name?: string | null;
}

export interface TeamJoinRequestDTO {
  id: string;
  registrationId: string;
  participantId: string;
  ingameId: string;
  message?: string | null;
  status: TeamJoinRequestStatus;
  processedBy?: string | null;
  processedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;

  participantName?: string;
  studentId?: string | null;
  email?: string | null;
  facultyName?: string | null;
  className?: string | null;
  teamName?: string | null;
  tournamentName?: string | null;
}

export function mapTeamJoinRequestToDTO(raw: any): TeamJoinRequestDTO {
  return {
    id: raw.id,
    registrationId: raw.registration_id,
    participantId: raw.participant_id,
    ingameId: raw.ingame_id,
    message: raw.message ?? null,
    status: raw.status,
    processedBy: raw.processed_by ?? null,
    processedAt: raw.processed_at ? new Date(raw.processed_at).toISOString() : null,
    rejectionReason: raw.rejection_reason ?? null,
    createdAt: raw.created_at ? new Date(raw.created_at).toISOString() : new Date().toISOString(),
    updatedAt: raw.updated_at ? new Date(raw.updated_at).toISOString() : new Date().toISOString(),

    participantName: raw.participant_name,
    studentId: raw.student_id ?? null,
    email: raw.email ?? null,
    facultyName: raw.faculty_name ?? null,
    className: raw.class_name ?? null,
    teamName: raw.team_name ?? null,
    tournamentName: raw.tournament_name ?? null,
  };
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

