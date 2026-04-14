-- ── Table: member_religious_preferences ──────────────────────────────────────
-- Ontology nodes RELIGION_PERMISSIONS / KOSHER / HALAL are already seeded
-- in 004_ontology_seed.sql. This migration only creates the member table.

CREATE TABLE IF NOT EXISTS public.member_religious_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL
                REFERENCES public.members(id) ON DELETE CASCADE,
  node_id     UUID NOT NULL
                REFERENCES public.ontology(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (member_id, node_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.member_religious_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_religious_preferences_select"
  ON public.member_religious_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "member_religious_preferences_insert"
  ON public.member_religious_preferences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "member_religious_preferences_delete"
  ON public.member_religious_preferences FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );
