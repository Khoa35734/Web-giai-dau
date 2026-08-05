-- Migration: Add missing columns to tournaments table
-- This script safely adds missing columns if they don't exist

ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS min_team_size integer,
ADD COLUMN IF NOT EXISTS max_team_size integer,
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS prize_pool bigint DEFAULT 0;

-- Ensure all datetime columns have proper defaults with current timestamp including time
ALTER TABLE public.tournaments
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for better performance on tournaments table
CREATE INDEX IF NOT EXISTS idx_tournaments_status
    ON public.tournaments(status);

CREATE INDEX IF NOT EXISTS idx_tournaments_game_name
    ON public.tournaments(game_name);

CREATE INDEX IF NOT EXISTS idx_tournaments_approved_by
    ON public.tournaments(approved_by);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_tournaments_dates
    ON public.tournaments(registration_open_at, registration_close_at, start_at, end_at);

-- ===========================
-- Users Table Indexes
-- ===========================
-- Optimize user search and filtering
CREATE INDEX IF NOT EXISTS idx_users_email
    ON public.users(email);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON public.users(role);

CREATE INDEX IF NOT EXISTS idx_users_is_active
    ON public.users(is_active);

CREATE INDEX IF NOT EXISTS idx_users_full_name
    ON public.users(full_name);

-- Index for user search by name or email pattern
CREATE INDEX IF NOT EXISTS idx_users_name_email_search
    ON public.users(full_name, email);

-- Index for ordering and filtering combined
CREATE INDEX IF NOT EXISTS idx_users_role_created_at
    ON public.users(role, created_at DESC);
