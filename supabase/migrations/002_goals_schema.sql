-- Goals table: available goals per category (categories are hard-coded in the app)
CREATE TABLE public.goals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  category    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Goals are publicly readable so anyone can browse options before signing in
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read goals" ON public.goals FOR SELECT USING (true);


-- Member goals: which goals are selected for each member
CREATE TABLE public.member_goals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  goal_id     uuid        NOT NULL REFERENCES public.goals(id)   ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, goal_id)
);

ALTER TABLE public.member_goals ENABLE ROW LEVEL SECURITY;

-- Users can only read/write goals for their own members
CREATE POLICY "Users can view their members goals" ON public.member_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.id = member_goals.member_id
        AND members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their members goals" ON public.member_goals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.id = member_goals.member_id
        AND members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their members goals" ON public.member_goals
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.id = member_goals.member_id
        AND members.user_id = auth.uid()
    )
  );
