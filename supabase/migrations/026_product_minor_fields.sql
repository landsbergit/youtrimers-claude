-- Add optional descriptive fields used by the Find Similar feature to surface
-- minor differences (shown as explanatory diffs, not as acceptance criteria).
-- All columns are nullable and start unpopulated; the engine treats missing
-- data as "no difference" on that field.
--
-- Populated later by the iHerb extraction pipeline:
--   flavor           — batch_extract_flavors.py (new; regex over scraped HTML)
--   expiration_date  — 3A_extract.py (main product extraction)
--   packaging        — 3A_extract.py (main product extraction)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS flavor TEXT,
  ADD COLUMN IF NOT EXISTS expiration_date DATE,
  ADD COLUMN IF NOT EXISTS packaging TEXT;
