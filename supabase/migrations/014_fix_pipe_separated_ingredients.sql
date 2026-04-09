-- Link pipe-separated ingredient names (e.g. "L_METHYLFOLATE|FOLATE") to the ontology.
-- Migration 007 used an exact node_name match, which misses these compound names.
-- This migration splits on '|' and takes the first matching ontology node for each part.

UPDATE public.ingredients i
SET ontology_node_id = (
  SELECT o.id
  FROM public.ontology o
  WHERE o.node_name = ANY(string_to_array(i.normalized_ingredient, '|'))
  ORDER BY o.node_name   -- deterministic
  LIMIT 1
)
WHERE i.ontology_node_id IS NULL
  AND i.normalized_ingredient LIKE '%|%';
