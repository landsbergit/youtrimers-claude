-- Replace the standalone goals table with the ontology table (type = 'goals').
-- Fixes three nodes orphaned by malformed lines in the source file.

-- ── 1. Drop old tables ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.member_goals;
DROP TABLE IF EXISTS public.goals;

-- ── 2. Lowercase all type values (make them human-readable query values) ──────
UPDATE public.ontology SET type = lower(type);

-- ── 3. Fix SKELETAL_HEALTH (was TREE|HEALTH_GOALS_CATEGORY~SKELETAL_HEALTH) ──
UPDATE public.ontology
SET parent_id = (SELECT id FROM public.ontology WHERE node_name = 'HEALTH_GOALS_CATEGORY'),
    type      = 'goals'
WHERE node_name = 'SKELETAL_HEALTH';

-- Fix descendants whose type was incorrectly set to 'skeletal_health'
UPDATE public.ontology SET type = 'goals'
WHERE type = 'skeletal_health';

-- ── 4. Fix DIGESTIVE_HEALTH (was TREE||HEALTH_GOALS_CATEGORY|DIGESTIVE_HEALTH) ─
UPDATE public.ontology
SET parent_id = (SELECT id FROM public.ontology WHERE node_name = 'HEALTH_GOALS_CATEGORY'),
    type      = 'goals'
WHERE node_name = 'DIGESTIVE_HEALTH';

-- Fix descendants
UPDATE public.ontology SET type = 'goals'
WHERE type = 'digestive_health';

-- ── 5. Fix EYE_HEALTH (was TREEHEALTH_GOALS_CATEGORY|EYE_HEALTH) ─────────────
UPDATE public.ontology
SET parent_id = (SELECT id FROM public.ontology WHERE node_name = 'HEALTH_GOALS_CATEGORY'),
    type      = 'goals'
WHERE node_name = 'EYE_HEALTH';

-- Fix descendants
UPDATE public.ontology SET type = 'goals'
WHERE type = 'eye_health';

-- ── 6. Mark HEALTH_GOALS_CATEGORY as non-leaf (it now has more children) ─────
UPDATE public.ontology SET is_leaf = false
WHERE node_name = 'HEALTH_GOALS_CATEGORY';

-- ── 7. Recreate member_goals referencing ontology ────────────────────────────
CREATE TABLE public.member_goals (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid        NOT NULL REFERENCES public.members(id)  ON DELETE CASCADE,
  goal_id    uuid        NOT NULL REFERENCES public.ontology(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, goal_id)
);

ALTER TABLE public.member_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their members goals" ON public.member_goals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.members
            WHERE members.id = member_goals.member_id AND members.user_id = auth.uid())
  );

CREATE POLICY "Users can insert their members goals" ON public.member_goals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.members
            WHERE members.id = member_goals.member_id AND members.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their members goals" ON public.member_goals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.members
            WHERE members.id = member_goals.member_id AND members.user_id = auth.uid())
  );
