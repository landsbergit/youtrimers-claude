-- Rule engine tables: rules, rule_actions, member_recommendations.

-- ── rules ─────────────────────────────────────────────────────────────────────
-- One rule is triggered by one ontology node (e.g. a goal like BONE_HEALTH).
-- A single goal node can have multiple rules (different priorities / strategies).

CREATE TABLE public.rules (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name         TEXT        NOT NULL UNIQUE,
  description       TEXT,
  -- Which kind of profile input triggers this rule.
  -- 'goal' is the only type for MVP; future: 'condition' | 'demographic' | 'medication'
  trigger_type      TEXT        NOT NULL DEFAULT 'goal',
  trigger_node_id   UUID        NOT NULL REFERENCES public.ontology(id),
  -- Lower integer = higher priority. Used for conflict resolution.
  priority          INTEGER     NOT NULL DEFAULT 100,
  -- How this rule's dose requirements combine with others for the same nutrient.
  -- 'accumulate' = take max(min_doses); 'override' = this rule wins outright;
  -- 'cap' = this rule sets an upper limit; 'avoid' = this rule suppresses a nutrient.
  conflict_strategy TEXT        NOT NULL DEFAULT 'accumulate',
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  authored_by       TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rules_trigger  ON public.rules(trigger_node_id);
CREATE INDEX idx_rules_active   ON public.rules(is_active);
CREATE INDEX idx_rules_type     ON public.rules(trigger_type);

ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active rules"
  ON public.rules FOR SELECT USING (is_active = true);

CREATE TRIGGER update_rules_updated_at
  BEFORE UPDATE ON public.rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── rule_actions ───────────────────────────────────────────────────────────────
-- One action = one nutrient/tag/form requirement produced by one rule.
-- A rule for BONE_HEALTH might produce actions for VITAMIN_D, CALCIUM, MAGNESIUM.

CREATE TABLE public.rule_actions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          UUID        NOT NULL REFERENCES public.rules(id) ON DELETE CASCADE,
  -- Polymorphic action type:
  -- 'require_nutrient' | 'avoid_nutrient' | 'prefer_tag' | 'avoid_tag' | 'prefer_form'
  action_type      TEXT        NOT NULL DEFAULT 'require_nutrient',
  -- Only one of the three node FKs is set per row, depending on action_type.
  nutrient_node_id UUID        REFERENCES public.ontology(id),  -- type = 'nutrients'
  tag_node_id      UUID        REFERENCES public.ontology(id),  -- type = 'tags'
  form_node_id     UUID        REFERENCES public.ontology(id),  -- type = 'dosage_form'
  -- Dose fields. All nullable: NULL means "mere presence is sufficient" (MVP default).
  min_dose         NUMERIC,
  max_dose         NUMERIC,
  preferred_dose   NUMERIC,
  unit             TEXT,       -- 'mg' | 'mcg' | 'IU' | 'g'
  -- Tiebreaker when multiple rules require the same nutrient at different doses.
  -- Lower integer = this rule's preferred_dose is used.
  dose_priority    INTEGER     NOT NULL DEFAULT 100,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ra_rule     ON public.rule_actions(rule_id);
CREATE INDEX idx_ra_nutrient ON public.rule_actions(nutrient_node_id);
CREATE INDEX idx_ra_type     ON public.rule_actions(action_type);

ALTER TABLE public.rule_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rule actions"
  ON public.rule_actions FOR SELECT USING (true);

-- ── member_recommendations ─────────────────────────────────────────────────────
-- One row per engine run. Serves as both audit trail and cache.
-- ranked_product_ids is the ordered result; score_breakdown stores per-product
-- detail for future "why this product?" explanations.

CREATE TABLE public.member_recommendations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL when the user is anonymous (session_fingerprint used instead).
  member_id             UUID        REFERENCES public.members(id) ON DELETE SET NULL,
  -- SHA-256 of sorted goal_ids + date for anonymous deduplication.
  session_fingerprint   TEXT,
  -- Input snapshot
  goal_ids              UUID[]      NOT NULL,
  -- Output
  fired_rule_ids        UUID[]      NOT NULL DEFAULT '{}',
  -- JSON snapshot of NutrientRequirement[] at the time of the run.
  nutrient_requirements JSONB       NOT NULL DEFAULT '{}',
  -- Ordered array of products.id values (integer PKs).
  ranked_product_ids    INTEGER[]   NOT NULL DEFAULT '{}',
  -- { "<product_id>": { score, matchedNutrients[], missedNutrients[] } }
  score_breakdown       JSONB       NOT NULL DEFAULT '{}',
  engine_version        TEXT        NOT NULL DEFAULT '1.0',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mr_member  ON public.member_recommendations(member_id);
CREATE INDEX idx_mr_session ON public.member_recommendations(session_fingerprint);
CREATE INDEX idx_mr_created ON public.member_recommendations(created_at DESC);

ALTER TABLE public.member_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own member recommendations"
  ON public.member_recommendations FOR SELECT USING (
    member_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_recommendations.member_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert recommendations"
  ON public.member_recommendations FOR INSERT WITH CHECK (true);
