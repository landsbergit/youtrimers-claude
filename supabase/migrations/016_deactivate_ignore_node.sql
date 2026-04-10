-- The IGNORE node is a catch-all for ingredient names that have no nutritional
-- relevance (labels, blends, macros, etc.).  Marking it inactive excludes it
-- from ontology lookups, rule authoring, and any future UI dropdowns.
UPDATE public.ontology
SET is_active = false
WHERE node_name = 'IGNORE';
