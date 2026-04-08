-- Ontology table: a tree of nodes (nutrients, dosage forms, tags, etc.)
CREATE TABLE public.ontology (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name    text        NOT NULL UNIQUE,
  parent_id    uuid        REFERENCES public.ontology(id) ON DELETE SET NULL,
  aliases      text[]      NOT NULL DEFAULT '{}',
  display_name text        NOT NULL,
  type         text        NOT NULL,  -- highest ancestor below ROOT (e.g. NUTRIENTS, DOSAGE_FORM, TAGS)
  is_leaf      boolean     NOT NULL DEFAULT true,
  is_active    boolean     NOT NULL DEFAULT true,
  sort_order   integer     NOT NULL DEFAULT 0,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_ontology_type     ON public.ontology(type);
CREATE INDEX idx_ontology_parent   ON public.ontology(parent_id);
CREATE INDEX idx_ontology_active   ON public.ontology(is_active);
CREATE INDEX idx_ontology_aliases  ON public.ontology USING GIN(aliases);

-- Ontology is read-only for everyone (managed by admins only)
ALTER TABLE public.ontology ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ontology" ON public.ontology FOR SELECT USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_ontology_updated_at
  BEFORE UPDATE ON public.ontology
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
