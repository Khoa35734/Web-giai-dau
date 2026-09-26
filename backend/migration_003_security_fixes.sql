-- =============================================================================
-- Migration 003: Security Fixes
-- [SRS 3.2 AD-13, SRS 5.1, SRS 6.2]
-- Supports: registration audit trail, case-safe participant identity
-- =============================================================================

-- 1. Add audit columns to registrations table
--    Tracks who reviewed a registration, why, and when.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS review_reason text;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 2. Case-insensitive unique index on participant username
--    Prevents duplicate case-variant usernames (e.g., 'JohnDoe' vs 'johndoe').
--    NOTE: If duplicate case-variants already exist, run the check query below first:
--
--    SELECT LOWER(username), array_agg(id) FROM participants
--    GROUP BY LOWER(username) HAVING COUNT(*) > 1;
--
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_username_lower
  ON participants (LOWER(username));

-- 3. Add username column to users table (if missing — current schema has email only)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar UNIQUE;
