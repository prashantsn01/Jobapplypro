-- Migration: 003_flat_profile_and_portal_links
-- Adds flat profile columns to User (replaces old profile Json)
-- Adds isPortalLink to Job
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$)

-- ── User flat profile fields ─────────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "profileComplete"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "phone"            TEXT,
  ADD COLUMN IF NOT EXISTS "city"             TEXT,
  ADD COLUMN IF NOT EXISTS "college"          TEXT,
  ADD COLUMN IF NOT EXISTS "degree"           TEXT,
  ADD COLUMN IF NOT EXISTS "branch"           TEXT,
  ADD COLUMN IF NOT EXISTS "graduationYear"   TEXT,
  ADD COLUMN IF NOT EXISTS "cgpa"             TEXT,
  ADD COLUMN IF NOT EXISTS "skills"           TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "jobPreferences"   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "linkedinUrl"      TEXT,
  ADD COLUMN IF NOT EXISTS "githubUrl"        TEXT,
  ADD COLUMN IF NOT EXISTS "portfolioUrl"     TEXT,
  ADD COLUMN IF NOT EXISTS "openToRemote"     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "openToRelocation" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "noticePeriod"     TEXT,
  ADD COLUMN IF NOT EXISTS "expectedSalary"   TEXT;

-- ── Job: isPortalLink ────────────────────────────────────────────────────────
ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "isPortalLink" BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Job: make externalId NOT NULL if it wasn't already ───────────────────────
-- (idempotent: raises no error if already NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='Job' AND column_name='externalId' AND is_nullable='YES'
  ) THEN
    UPDATE "Job" SET "externalId" = gen_random_uuid()::text WHERE "externalId" IS NULL;
    ALTER TABLE "Job" ALTER COLUMN "externalId" SET NOT NULL;
  END IF;
END $$;

-- ── Drop old Session table if it exists (no longer needed with Redis sessions) ─
DROP TABLE IF EXISTS "Session";

-- ── Drop old profile Json column if migrating from v1 ────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='User' AND column_name='profile'
  ) THEN
    ALTER TABLE "User" DROP COLUMN "profile";
  END IF;
END $$;
