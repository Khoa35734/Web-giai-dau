/**
 * Domain types shared across the backend application.
 * Map 1:1 với schema PostgreSQL (users, participants, tournaments, registrations).
 */

export type UserRole = 'admin' | 'ctv';

export type ParticipantAccountType = 'dut' | 'free';

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
  account_type: ParticipantAccountType;
  username: string;
  password_hash: string;
  full_name: string;
  class_name: string | null;
  faculty_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafeParticipant {
  id: string;
  account_type: ParticipantAccountType;
  username: string;
  full_name: string;
  class_name: string | null;
  faculty_name: string | null;
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
