-- 025_member_basic_profile.sql
-- Stores categorical body size and/or precise height/weight for the primary member.
-- height_cm and weight_kg are always stored in metric regardless of display preference.

CREATE TABLE public.member_basic_profile (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  body_size   text        CHECK (body_size IN ('LOW', 'MEDIUM', 'HIGH')),
  height_cm   numeric,
  weight_kg   numeric,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id)
);

ALTER TABLE public.member_basic_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_basic_profile: member owner access"
  ON public.member_basic_profile
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );
