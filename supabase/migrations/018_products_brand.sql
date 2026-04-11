-- Migration 018: Add brand column to products
-- Brand is extracted from product_name (text before the first comma).
-- This enables brand-based similarity in diversity re-ranking, and future brand search.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT;

-- Populate brand from product_name: text before first comma, trimmed.
-- Products without a comma get the full name as brand (still useful for dedup).
UPDATE public.products
SET brand = TRIM(SPLIT_PART(product_name, ',', 1));

CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
