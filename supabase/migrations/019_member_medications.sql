-- Migration 019: member_medications table
-- Stores the medications a member has indicated they are taking.
-- Follows the same pattern as member_goals (one row per member × ontology node).

CREATE TABLE public.member_medications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  ontology_node_id  UUID        NOT NULL REFERENCES public.ontology(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, ontology_node_id)
);

CREATE INDEX idx_member_medications_member ON public.member_medications(member_id);

ALTER TABLE public.member_medications ENABLE ROW LEVEL SECURITY;

-- Members can only read/write their own medications
CREATE POLICY "Users manage their own member medications"
  ON public.member_medications
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
