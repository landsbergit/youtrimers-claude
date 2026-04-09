-- Recursive CTE that returns every (ancestor_id, descendant_id) pair reachable
-- from the given node IDs.  Self-pairs are included so the scorer can always
-- fall back to an exact match.
--
-- Used by useRecommendations to expand each required nutrient node to the full
-- set of acceptable child/descendant nodes when scoring products.

CREATE OR REPLACE FUNCTION public.get_nutrient_descendants(p_node_ids uuid[])
RETURNS TABLE (ancestor_id uuid, descendant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH RECURSIVE tree AS (
    -- Seed: the requested nodes (self-pair)
    SELECT id AS ancestor_id, id AS descendant_id
    FROM public.ontology
    WHERE id = ANY(p_node_ids)

    UNION ALL

    -- Recurse: children of the current frontier
    SELECT t.ancestor_id, o.id AS descendant_id
    FROM public.ontology o
    JOIN tree t ON o.parent_id = t.descendant_id
  )
  SELECT ancestor_id, descendant_id FROM tree;
$$;

GRANT EXECUTE ON FUNCTION public.get_nutrient_descendants(uuid[]) TO anon, authenticated;
