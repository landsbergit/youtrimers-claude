-- Add nutrient_display_name to get_rules_for_goals so the UI can label pills
-- without a second round-trip to the ontology table.
-- Must DROP first because the return type is changing (new column).

DROP FUNCTION IF EXISTS public.get_rules_for_goals(uuid[]);

CREATE FUNCTION public.get_rules_for_goals(p_goal_ids uuid[])
RETURNS TABLE (
  rule_id            uuid,
  rule_name          text,
  trigger_node_id    uuid,
  priority           int,
  conflict_strategy  text,
  action_id          uuid,
  action_type        text,
  nutrient_node_id   uuid,
  nutrient_display_name text,
  tag_node_id        uuid,
  form_node_id       uuid,
  min_dose           numeric,
  max_dose           numeric,
  preferred_dose     numeric,
  unit               text,
  dose_priority      int
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    r.id,
    r.rule_name,
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
    ra.dose_priority
  FROM public.rules r
  JOIN public.rule_actions ra ON ra.rule_id = r.id
  LEFT JOIN public.ontology o ON o.id = ra.nutrient_node_id
  WHERE r.is_active = true
    AND r.trigger_type = 'goal'
    AND r.trigger_node_id = ANY(p_goal_ids)
  ORDER BY r.priority ASC, r.id, ra.id;
$$;
