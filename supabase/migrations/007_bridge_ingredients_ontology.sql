-- Bridge the existing ingredients table to the ontology tree.
-- Adds ontology_node_id so the rule engine can match ingredients to nutrient nodes
-- without altering or replacing the existing data.

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS ontology_node_id UUID REFERENCES public.ontology(id);

-- Populate via node_name match. Unmatched rows (e.g. the IGNORE marker) stay NULL
-- and are silently excluded from rule matching.
UPDATE public.ingredients i
SET ontology_node_id = o.id
FROM public.ontology o
WHERE o.node_name = i.normalized_ingredient;

CREATE INDEX IF NOT EXISTS idx_ingredients_ontology
  ON public.ingredients(ontology_node_id);

-- Soft-delete flag so the UI can hide discontinued products without data loss.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_products_active
  ON public.products(is_active);
