-- Member health conditions: stores which conditions each member has selected.
CREATE TABLE public.member_health_conditions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  node_id     UUID NOT NULL REFERENCES public.ontology(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, node_id)
);

CREATE INDEX idx_mhc_member ON public.member_health_conditions(member_id);

ALTER TABLE public.member_health_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own health conditions"
  ON public.member_health_conditions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );
