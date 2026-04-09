-- Helper RPC: fetch all active rules + their actions for a given set of goal IDs.
-- Single round-trip from the browser; JOIN done server-side.
-- SECURITY DEFINER so callers using the anon key can read through RLS without issues.

CREATE OR REPLACE FUNCTION public.get_rules_for_goals(p_goal_ids uuid[])
RETURNS TABLE (
  rule_id          uuid,
  rule_name        text,
  trigger_node_id  uuid,
  priority         integer,
  conflict_strategy text,
  action_id        uuid,
  action_type      text,
  nutrient_node_id uuid,
  tag_node_id      uuid,
  form_node_id     uuid,
  min_dose         numeric,
  max_dose         numeric,
  preferred_dose   numeric,
  unit             text,
  dose_priority    integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    r.id            AS rule_id,
    r.rule_name,
    r.trigger_node_id,
    r.priority,
    r.conflict_strategy,
    ra.id           AS action_id,
    ra.action_type,
    ra.nutrient_node_id,
    ra.tag_node_id,
    ra.form_node_id,
    ra.min_dose,
    ra.max_dose,
    ra.preferred_dose,
    ra.unit,
    ra.dose_priority
  FROM public.rules r
  JOIN public.rule_actions ra ON ra.rule_id = r.id
  WHERE r.is_active = true
    AND r.trigger_type = 'goal'
    AND r.trigger_node_id = ANY(p_goal_ids)
  ORDER BY r.priority ASC, r.id, ra.id;
$$;
