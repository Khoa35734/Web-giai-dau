/**
 * Domain types shared across the backend application.
 * Map 1:1 với schema PostgreSQL (users, tournaments, registrations).
 */

export type UserRole = 'admin' | 'ctv' | 'user';

export type TournamentStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'completed';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export type ParticipationType = 'individual' | 'team';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  student_id: string | null;
  phone: string | null;
  faculty: string | null;
  class_name: string | null;
  course: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** User object WITHOUT sensitive fields (password_hash). */
export interface SafeUser {
  id: string;
  email: string;
  full_name: string;
  student_id: string | null;
  phone: string | null;
  faculty: string | null;
  class_name: string | null;
  course: string | null;
  role: UserRole;
  is_active: boolean;
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
  prize_pool: number;
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
  submitted_data: Record<string, unknown> | string;
  status: RegistrationStatus;
  registered_at: string;
  updated_at: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

export interface PaginationResult {
  total: number;
  page: number;
  limit: number;
  pages: number;
}
