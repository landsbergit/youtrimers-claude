-- Mark existing discontinued products inactive
-- Products tagged with 'AVAILABILITY' are discontinued items (e.g. "... (Discontinued Item)").
UPDATE public.products
SET is_active = false
WHERE 'AVAILABILITY' = ANY(normalized_tags)
  AND is_active = true;

-- Trigger: auto-set is_active = false whenever a product row has the AVAILABILITY tag.
-- Fires on INSERT and UPDATE so any future upload or refresh is handled automatically.

CREATE OR REPLACE FUNCTION public.mark_discontinued_products()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.normalized_tags IS NOT NULL AND 'AVAILABILITY' = ANY(NEW.normalized_tags) THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_discontinued ON public.products;

CREATE TRIGGER trg_mark_discontinued
  BEFORE INSERT OR UPDATE OF normalized_tags, is_active
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_discontinued_products();
