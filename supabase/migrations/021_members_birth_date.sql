-- Migration 021: Add birth_year and birth_month to members
-- Used to auto-compute the member's current age and set age-based dosage form defaults.
-- Separate columns (vs date_of_birth) so we don't over-collect PII.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS birth_year  INTEGER CHECK (birth_year  >= 1900 AND birth_year  <= 2200),
  ADD COLUMN IF NOT EXISTS birth_month INTEGER CHECK (birth_month >= 1    AND birth_month <= 12);
