-- Migration 020: expose rule description in get_rules_for_goals
-- The rules.description column is used to explain why a nutrient is required,
-- so the UI can show it as a tooltip on nutrient pills in the Matches section.

DROP FUNCTION IF EXISTS public.get_rules_for_goals(uuid[]);

CREATE FUNCTION public.get_rules_for_goals(p_goal_ids uuid[])
RETURNS TABLE (
  rule_id               uuid,
  rule_name             text,
  rule_description      text,
  trigger_node_id       uuid,
  priority              int,
  conflict_strategy     text,
  action_id             uuid,
  action_type           text,
  nutrient_node_id      uuid,
  nutrient_display_name text,
  tag_node_id           uuid,
  form_node_id          uuid,
  min_dose              numeric,
  max_dose              numeric,
  preferred_dose        numeric,
  unit                  text,
  dose_priority         int,
  enforce_level         text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    r.id,
    r.rule_name,
    r.description,
    r.trigger_node_id,
    r.priority,
    r.conflict_strategy,
    ra.id,
    ra.action_type,
    ra.nutrient_node_id,
    o.display_name,
    ra.tag_node_id,
    ra.form_node_id,
    ra.min_dose,
    ra.max_dose,
    ra.preferred_dose,
    ra.unit,
    ra.dose_priority,
    ra.enforce_level
  FROM public.rules r
  JOIN public.rule_actions ra ON ra.rule_id = r.id
  LEFT JOIN public.ontology o ON o.id = ra.nutrient_node_id
  WHERE r.is_active = true
    AND r.trigger_type = 'goal'
    AND r.trigger_node_id = ANY(p_goal_ids)
  ORDER BY r.priority ASC, r.id, ra.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_rules_for_goals(uuid[]) TO anon, authenticated;
