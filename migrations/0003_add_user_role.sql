-- Add role column to users with default 'USER'
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'USER';

-- Backfill existing rows implicitly use default.
-- No further changes required.
