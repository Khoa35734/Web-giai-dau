-- =============================================================================
-- DUT ESPORTS TOURNAMENT PLATFORM - DATABASE SCHEMA SNAPSHOT
-- Hệ quản trị cơ sở dữ liệu: PostgreSQL (13+) / Supabase
-- Đồng bộ 100% với SRS v1.3 & database_schema.sql (18 bảng chuẩn)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Hàm trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. BẢNG users
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  password_hash CHARACTER VARYING NOT NULL,
  full_name CHARACTER VARYING NOT NULL,
  email TEXT UNIQUE,
  phone_number CHARACTER VARYING,
  role CHARACTER VARYING NOT NULL DEFAULT 'ctv',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT chk_user_role CHECK (role IN ('admin', 'ctv'))
);

-- 2. BẢNG participants (Zero CCCD Invariant, 2 ảnh thẻ SV)
CREATE TABLE public.participants (
  id TEXT NOT NULL,
  username TEXT,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  student_id TEXT UNIQUE,
  email TEXT UNIQUE,
  phone_number CHARACTER VARYING,
  university_name CHARACTER VARYING,
  faculty_name TEXT,
  class_name TEXT,
  account_type TEXT NOT NULL DEFAULT 'external',
  student_card_url TEXT,
  selfie_with_student_card_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT true,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT chk_participant_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT chk_account_type CHECK (account_type IN ('internal', 'external'))
);

-- 3. BẢNG tournaments
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  code CHARACTER VARYING NOT NULL UNIQUE,
  name CHARACTER VARYING NOT NULL,
  game_name CHARACTER VARYING NOT NULL,
  game_logo_url TEXT,
  banner_url TEXT NOT NULL,
  participation_type CHARACTER VARYING NOT NULL,
  max_participants INTEGER NOT NULL,
  min_team_size INTEGER,
  max_team_size INTEGER,
  registration_open_at TIMESTAMP WITH TIME ZONE NOT NULL,
  registration_close_at TIMESTAMP WITH TIME ZONE NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  use_external_link BOOLEAN DEFAULT false,
  external_registration_url TEXT,
  form_schema JSONB DEFAULT '[]'::jsonb,
  created_by UUID,
  approved_by UUID,
  status CHARACTER VARYING DEFAULT 'pending',
  checkin_open_at TIMESTAMP WITH TIME ZONE,
  checkin_close_at TIMESTAMP WITH TIME ZONE,
  checkin_qr_secret TEXT,
  certificate_template_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- 4. BẢNG tournament_organizers
CREATE TABLE public.tournament_organizers (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL,
  organizer_type CHARACTER VARYING NOT NULL DEFAULT 'permanent',
  user_id UUID,
  participant_id TEXT,
  role CHARACTER VARYING NOT NULL DEFAULT 'co_organizer',
  custom_title CHARACTER VARYING,
  assigned_by UUID,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tournament_organizers_pkey PRIMARY KEY (id),
  CONSTRAINT fk_to_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_to_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_to_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_to_assigned_by FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_organizer_type CHECK (organizer_type IN ('permanent', 'seasonal')),
  CONSTRAINT chk_organizer_target CHECK (
    (organizer_type = 'permanent' AND user_id IS NOT NULL AND participant_id IS NULL) OR
    (organizer_type = 'seasonal' AND participant_id IS NOT NULL AND user_id IS NULL)
  ),
  CONSTRAINT chk_organizer_role CHECK (role IN ('lead_organizer', 'co_organizer', 'referee', 'seasonal_staff', 'support_staff'))
);

-- 5. BẢNG registrations
CREATE TABLE public.registrations (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL,
  captain_id TEXT NOT NULL,
  team_name CHARACTER VARYING,
  submitted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status CHARACTER VARYING DEFAULT 'pending',
  ingame_id CHARACTER VARYING,
  is_recruiting BOOLEAN NOT NULL DEFAULT false,
  recruitment_notes TEXT,
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT registrations_pkey PRIMARY KEY (id),
  CONSTRAINT registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT registrations_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.participants(id),
  CONSTRAINT registrations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);

-- 6. BẢNG registration_members
CREATE TABLE public.registration_members (
  registration_id UUID NOT NULL,
  participant_id TEXT NOT NULL,
  is_captain BOOLEAN DEFAULT false,
  ingame_id CHARACTER VARYING,
  role_in_team CHARACTER VARYING,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT registration_members_pkey PRIMARY KEY (registration_id, participant_id),
  CONSTRAINT fk_rm_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT fk_rm_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id)
);

-- 7. BẢNG team_join_requests
CREATE TABLE public.team_join_requests (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL,
  participant_id TEXT NOT NULL,
  ingame_id CHARACTER VARYING NOT NULL,
  message TEXT,
  status CHARACTER VARYING NOT NULL DEFAULT 'pending',
  processed_by TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT team_join_requests_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tjr_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT fk_tjr_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT fk_tjr_processed_by FOREIGN KEY (processed_by) REFERENCES public.participants(id),
  CONSTRAINT chk_tjr_status CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- 8. BẢNG brackets
CREATE TABLE public.brackets (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL,
  name CHARACTER VARYING NOT NULL,
  format CHARACTER VARYING NOT NULL,
  status CHARACTER VARYING NOT NULL DEFAULT 'draft',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT brackets_pkey PRIMARY KEY (id),
  CONSTRAINT fk_brackets_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT chk_bracket_format CHECK (format IN ('single_elimination', 'double_elimination', 'group_stage', 'round_robin', 'swiss', 'tft_lobbies')),
  CONSTRAINT chk_bracket_status CHECK (status IN ('draft', 'published', 'in_progress', 'completed'))
);

-- 9. BẢNG bracket_rounds
CREATE TABLE public.bracket_rounds (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  bracket_id UUID NOT NULL,
  round_number INTEGER NOT NULL,
  name CHARACTER VARYING NOT NULL,
  bo_type INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bracket_rounds_pkey PRIMARY KEY (id),
  CONSTRAINT fk_rounds_bracket FOREIGN KEY (bracket_id) REFERENCES public.brackets(id),
  CONSTRAINT chk_bo_type CHECK (bo_type IN (1, 3, 5, 7))
);

-- 10. BẢNG matches
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  bracket_id UUID NOT NULL,
  round_id UUID NOT NULL,
  match_code CHARACTER VARYING NOT NULL,
  match_type CHARACTER VARYING NOT NULL DEFAULT 'head_to_head',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  status CHARACTER VARYING NOT NULL DEFAULT 'scheduled',
  winner_registration_id UUID,
  next_match_id UUID,
  loser_next_match_id UUID,
  referee_id UUID,
  custom_room_info JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT fk_matches_bracket FOREIGN KEY (bracket_id) REFERENCES public.brackets(id),
  CONSTRAINT fk_matches_round FOREIGN KEY (round_id) REFERENCES public.bracket_rounds(id),
  CONSTRAINT fk_matches_winner FOREIGN KEY (winner_registration_id) REFERENCES public.registrations(id),
  CONSTRAINT fk_matches_next FOREIGN KEY (next_match_id) REFERENCES public.matches(id),
  CONSTRAINT fk_matches_loser_next FOREIGN KEY (loser_next_match_id) REFERENCES public.matches(id),
  CONSTRAINT fk_matches_referee FOREIGN KEY (referee_id) REFERENCES public.users(id),
  CONSTRAINT chk_match_type CHECK (match_type IN ('head_to_head', 'tft_lobby')),
  CONSTRAINT chk_match_status CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled'))
);

-- 11. BẢNG match_participants
CREATE TABLE public.match_participants (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL,
  registration_id UUID NOT NULL,
  slot_number INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL DEFAULT 0,
  rank_position INTEGER,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  evidence_url TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT match_participants_pkey PRIMARY KEY (id),
  CONSTRAINT uq_match_participant UNIQUE (match_id, registration_id),
  CONSTRAINT fk_mp_match FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT fk_mp_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);

-- 12. BẢNG match_games
CREATE TABLE public.match_games (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL,
  game_number INTEGER NOT NULL,
  duration_seconds INTEGER,
  winner_registration_id UUID,
  result_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT match_games_pkey PRIMARY KEY (id),
  CONSTRAINT uq_match_game_number UNIQUE (match_id, game_number),
  CONSTRAINT fk_mg_match FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT fk_mg_winner FOREIGN KEY (winner_registration_id) REFERENCES public.registrations(id)
);

-- 13. BẢNG check_ins
CREATE TABLE public.check_ins (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL,
  registration_id UUID NOT NULL,
  participant_id TEXT NOT NULL,
  checkin_method CHARACTER VARYING NOT NULL DEFAULT 'qr_scan',
  status CHARACTER VARYING NOT NULL DEFAULT 'approved',
  proof_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy DOUBLE PRECISION,
  ip_address CHARACTER VARYING,
  device_info TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  CONSTRAINT check_ins_pkey PRIMARY KEY (id),
  CONSTRAINT uq_tournament_participant_checkin UNIQUE (tournament_id, participant_id),
  CONSTRAINT fk_checkin_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT fk_checkin_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT fk_checkin_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT fk_checkin_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES public.users(id),
  CONSTRAINT chk_checkin_method CHECK (checkin_method IN ('qr_scan', 'proof_submission', 'proof_upload', 'ai_ocr', 'manual_admin', 'manual_override')),
  CONSTRAINT chk_checkin_status CHECK (status IN ('approved', 'pending_review', 'rejected'))
);

-- 14. BẢNG certificates
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL,
  certificate_type CHARACTER VARYING NOT NULL DEFAULT 'participant',
  participant_id TEXT NOT NULL,
  registration_id UUID,
  organizer_id UUID,
  certificate_code CHARACTER VARYING NOT NULL UNIQUE,
  title CHARACTER VARYING NOT NULL,
  achievement_title CHARACTER VARYING,
  certificate_url TEXT NOT NULL,
  qr_verify_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT certificates_pkey PRIMARY KEY (id),
  CONSTRAINT uq_tournament_participant_cert UNIQUE (tournament_id, participant_id, certificate_type),
  CONSTRAINT fk_cert_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT fk_cert_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT fk_cert_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT fk_cert_organizer FOREIGN KEY (organizer_id) REFERENCES public.tournament_organizers(id),
  CONSTRAINT chk_certificate_type CHECK (certificate_type IN ('participant', 'organizer')),
  CONSTRAINT chk_cert_requirements CHECK (
    (certificate_type = 'participant' AND registration_id IS NOT NULL) OR
    (certificate_type = 'organizer')
  )
);

-- 15. BẢNG ai_checkin_sessions
CREATE TABLE public.ai_checkin_sessions (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL,
  match_id UUID,
  created_by UUID NOT NULL,
  source_type CHARACTER VARYING NOT NULL DEFAULT 'congdong_lienquan',
  status CHARACTER VARYING NOT NULL DEFAULT 'pending_review',
  total_detected INTEGER DEFAULT 0,
  total_matched INTEGER DEFAULT 0,
  image_purged BOOLEAN NOT NULL DEFAULT false,
  confirmed_by UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_checkin_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_aics_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT fk_aics_match FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT fk_aics_created_by FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT fk_aics_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES public.users(id),
  CONSTRAINT chk_aics_source_type CHECK (source_type IN ('congdong_lienquan', 'custom_lobby', 'other')),
  CONSTRAINT chk_aics_status CHECK (status IN ('processing', 'pending_review', 'confirmed', 'cancelled', 'rejected'))
);

-- 16. BẢNG ai_checkin_detections
CREATE TABLE public.ai_checkin_detections (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  raw_text TEXT NOT NULL,
  ocr_confidence DOUBLE PRECISION,
  bounding_box JSONB DEFAULT '{}'::jsonb,
  matched_participant_id TEXT,
  matched_registration_id UUID,
  similarity_score DOUBLE PRECISION,
  is_manually_adjusted BOOLEAN NOT NULL DEFAULT false,
  is_confirmed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_checkin_detections_pkey PRIMARY KEY (id),
  CONSTRAINT fk_aicd_session FOREIGN KEY (session_id) REFERENCES public.ai_checkin_sessions(id),
  CONSTRAINT fk_aicd_participant FOREIGN KEY (matched_participant_id) REFERENCES public.participants(id),
  CONSTRAINT fk_aicd_registration FOREIGN KEY (matched_registration_id) REFERENCES public.registrations(id)
);

-- 17. BẢNG notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  recipient_type CHARACTER VARYING NOT NULL,
  recipient_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type CHARACTER VARYING NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT chk_recipient_type CHECK (recipient_type IN ('user', 'participant'))
);

-- 18. BẢNG audit_logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  actor_id TEXT NOT NULL,
  actor_role CHARACTER VARYING NOT NULL,
  action CHARACTER VARYING NOT NULL,
  target_table CHARACTER VARYING NOT NULL,
  target_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  ip_address CHARACTER VARYING,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);