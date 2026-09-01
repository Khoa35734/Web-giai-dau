-- =============================================================================
-- DUT ESPORTS PLATFORM - BACKEND COMPLETE SCHEMA RECONCILIATION
-- Migration đồng bộ triệt để schema database runtime với SRS v1.3 (18 bảng)
-- Idempotent: có thể chạy nhiều lần trên DB trống hoặc DB đang hoạt động
-- =============================================================================

BEGIN;

-- 0. Tiện ích UUID
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
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number CHARACTER VARYING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_role') THEN
        ALTER TABLE public.users ADD CONSTRAINT chk_user_role CHECK (role IN ('admin', 'ctv'));
    END IF;
END $$;

-- 2. BẢNG participants (Xóa sạch dấu vết CCCD, đầy đủ KYC 2 ảnh)
ALTER TABLE public.participants DROP COLUMN IF EXISTS cccd_number;
ALTER TABLE public.participants DROP COLUMN IF EXISTS cccd_front_url;
ALTER TABLE public.participants DROP COLUMN IF EXISTS cccd_back_url;

ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS phone_number CHARACTER VARYING;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS university_name CHARACTER VARYING;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS faculty_name TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS class_name TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'external';
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS student_card_url TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS selfie_with_student_card_url TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_participant_status') THEN
        ALTER TABLE public.participants ADD CONSTRAINT chk_participant_status
            CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_account_type') THEN
        ALTER TABLE public.participants ADD CONSTRAINT chk_account_type
            CHECK (account_type IN ('internal', 'external'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_username_lower
    ON public.participants (LOWER(username));

-- 3. BẢNG tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS checkin_open_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS checkin_close_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS checkin_qr_secret TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS certificate_template_url TEXT;

-- 4. BẢNG registrations
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS ingame_id CHARACTER VARYING;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS is_recruiting BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS recruitment_notes TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 5. BẢNG registration_members
ALTER TABLE public.registration_members ADD COLUMN IF NOT EXISTS ingame_id CHARACTER VARYING;
ALTER TABLE public.registration_members ADD COLUMN IF NOT EXISTS role_in_team CHARACTER VARYING;

-- 6. BẢNG tournament_organizers
CREATE TABLE IF NOT EXISTS public.tournament_organizers (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_to_user ON public.tournament_organizers(tournament_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_to_participant ON public.tournament_organizers(tournament_id, participant_id) WHERE participant_id IS NOT NULL;

-- 7. BẢNG team_join_requests
CREATE TABLE IF NOT EXISTS public.team_join_requests (
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
    CONSTRAINT fk_tjr_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE CASCADE,
    CONSTRAINT fk_tjr_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
    CONSTRAINT fk_tjr_processed_by FOREIGN KEY (processed_by) REFERENCES public.participants(id) ON DELETE SET NULL,
    CONSTRAINT chk_tjr_status CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- 8. CÁC BẢNG NHÁNH ĐẤU, TRẬN ĐẤU & CHI TIẾT GAME
CREATE TABLE IF NOT EXISTS public.brackets (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    name CHARACTER VARYING NOT NULL,
    format CHARACTER VARYING NOT NULL,
    status CHARACTER VARYING NOT NULL DEFAULT 'draft',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT brackets_pkey PRIMARY KEY (id),
    CONSTRAINT fk_brackets_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
    CONSTRAINT chk_bracket_format CHECK (format IN ('single_elimination', 'double_elimination', 'group_stage', 'round_robin', 'swiss', 'tft_lobbies')),
    CONSTRAINT chk_bracket_status CHECK (status IN ('draft', 'published', 'in_progress', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.bracket_rounds (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    bracket_id UUID NOT NULL,
    round_number INTEGER NOT NULL,
    name CHARACTER VARYING NOT NULL,
    bo_type INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bracket_rounds_pkey PRIMARY KEY (id),
    CONSTRAINT fk_rounds_bracket FOREIGN KEY (bracket_id) REFERENCES public.brackets(id) ON DELETE CASCADE,
    CONSTRAINT chk_bo_type CHECK (bo_type IN (1, 3, 5, 7))
);

CREATE TABLE IF NOT EXISTS public.matches (
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
    CONSTRAINT fk_matches_bracket FOREIGN KEY (bracket_id) REFERENCES public.brackets(id) ON DELETE CASCADE,
    CONSTRAINT fk_matches_round FOREIGN KEY (round_id) REFERENCES public.bracket_rounds(id) ON DELETE CASCADE,
    CONSTRAINT fk_matches_winner FOREIGN KEY (winner_registration_id) REFERENCES public.registrations(id) ON DELETE SET NULL,
    CONSTRAINT fk_matches_next FOREIGN KEY (next_match_id) REFERENCES public.matches(id) ON DELETE SET NULL,
    CONSTRAINT fk_matches_loser_next FOREIGN KEY (loser_next_match_id) REFERENCES public.matches(id) ON DELETE SET NULL,
    CONSTRAINT fk_matches_referee FOREIGN KEY (referee_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT chk_match_type CHECK (match_type IN ('head_to_head', 'tft_lobby')),
    CONSTRAINT chk_match_status CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.match_participants (
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
    CONSTRAINT fk_mp_match FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_mp_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.match_games (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL,
    game_number INTEGER NOT NULL,
    duration_seconds INTEGER,
    winner_registration_id UUID,
    result_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT match_games_pkey PRIMARY KEY (id),
    CONSTRAINT uq_match_game_number UNIQUE (match_id, game_number),
    CONSTRAINT fk_mg_match FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_mg_winner FOREIGN KEY (winner_registration_id) REFERENCES public.registrations(id) ON DELETE SET NULL
);

-- 9. BẢNG check_ins
CREATE TABLE IF NOT EXISTS public.check_ins (
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
    CONSTRAINT fk_checkin_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
    CONSTRAINT fk_checkin_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE CASCADE,
    CONSTRAINT fk_checkin_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
    CONSTRAINT fk_checkin_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_checkin_method') THEN
        ALTER TABLE public.check_ins ADD CONSTRAINT chk_checkin_method
            CHECK (checkin_method IN ('qr_scan', 'proof_submission', 'proof_upload', 'ai_ocr', 'manual_admin', 'manual_override'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_checkin_status') THEN
        ALTER TABLE public.check_ins ADD CONSTRAINT chk_checkin_status
            CHECK (status IN ('approved', 'pending_review', 'rejected'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkin_reviewed_by') THEN
        ALTER TABLE public.check_ins ADD CONSTRAINT fk_checkin_reviewed_by
            FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 10. BẢNG certificates
CREATE TABLE IF NOT EXISTS public.certificates (
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
    CONSTRAINT fk_cert_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
    CONSTRAINT fk_cert_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
    CONSTRAINT fk_cert_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE CASCADE,
    CONSTRAINT fk_cert_organizer FOREIGN KEY (organizer_id) REFERENCES public.tournament_organizers(id) ON DELETE SET NULL,
    CONSTRAINT chk_certificate_type CHECK (certificate_type IN ('participant', 'organizer')),
    CONSTRAINT chk_cert_requirements CHECK (
        (certificate_type = 'participant' AND registration_id IS NOT NULL) OR
        (certificate_type = 'organizer')
    )
);

-- 11. BẢNG AI CHECK-IN
CREATE TABLE IF NOT EXISTS public.ai_checkin_sessions (
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
    CONSTRAINT fk_aics_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
    CONSTRAINT fk_aics_match FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL,
    CONSTRAINT fk_aics_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_aics_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON DELETE SET NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aics_source_type') THEN
        ALTER TABLE public.ai_checkin_sessions ADD CONSTRAINT chk_aics_source_type
            CHECK (source_type IN ('congdong_lienquan', 'custom_lobby', 'other'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aics_status') THEN
        ALTER TABLE public.ai_checkin_sessions ADD CONSTRAINT chk_aics_status
            CHECK (status IN ('processing', 'pending_review', 'confirmed', 'cancelled', 'rejected'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_checkin_detections (
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
    CONSTRAINT fk_aicd_session FOREIGN KEY (session_id) REFERENCES public.ai_checkin_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_aicd_participant FOREIGN KEY (matched_participant_id) REFERENCES public.participants(id) ON DELETE SET NULL,
    CONSTRAINT fk_aicd_registration FOREIGN KEY (matched_registration_id) REFERENCES public.registrations(id) ON DELETE SET NULL
);

-- 12. BẢNG notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    recipient_type CHARACTER VARYING NOT NULL,
    recipient_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type CHARACTER VARYING NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_recipient_type') THEN
        ALTER TABLE public.notifications ADD CONSTRAINT chk_recipient_type
            CHECK (recipient_type IN ('user', 'participant'));
    END IF;
END $$;

-- 13. BẢNG audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
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

-- 14. TRIGGERS TỰ ĐỘNG CẬP NHẬT updated_at
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_participants_updated_at ON public.participants;
CREATE TRIGGER trg_participants_updated_at BEFORE UPDATE ON public.participants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tournaments_updated_at ON public.tournaments;
CREATE TRIGGER trg_tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_registrations_updated_at ON public.registrations;
CREATE TRIGGER trg_registrations_updated_at BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_team_join_requests_updated_at ON public.team_join_requests;
CREATE TRIGGER trg_team_join_requests_updated_at BEFORE UPDATE ON public.team_join_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_brackets_updated_at ON public.brackets;
CREATE TRIGGER trg_brackets_updated_at BEFORE UPDATE ON public.brackets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_matches_updated_at ON public.matches;
CREATE TRIGGER trg_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 15. PERFORMANCE & QUERY INDEXES
CREATE INDEX IF NOT EXISTS idx_participants_status ON public.participants(status);
CREATE INDEX IF NOT EXISTS idx_participants_account_type ON public.participants(account_type);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON public.registrations(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_checkins_tournament ON public.check_ins(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_aics_tournament ON public.ai_checkin_sessions(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_cert_code ON public.certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_cert_lookup ON public.certificates(tournament_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_type, recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_table, target_id);

COMMIT;
