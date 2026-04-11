-- Migration 022: Track products the member is currently taking as supplements.
-- Persisted per member so the engine can (later) account for existing coverage.

CREATE TABLE public.member_current_supplements (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID    NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES public.products(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, product_id)
);

CREATE INDEX idx_mcs_member ON public.member_current_supplements(member_id);

ALTER TABLE public.member_current_supplements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own current supplements"
  ON public.member_current_supplements
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
