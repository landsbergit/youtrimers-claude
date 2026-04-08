-- Normalize all ontology display names to Title Case using initcap().
-- initcap() capitalizes the first letter after any non-alphanumeric character,
-- which means apostrophes get an unwanted capital (e.g. "Men'S Health").
-- The second statement patches that specific pattern.

UPDATE ontology
SET display_name = initcap(display_name)
WHERE type = 'goals';

-- Fix initcap artefact: 'S → 's  (e.g. "Men'S Health" → "Men's Health")
UPDATE ontology
SET display_name = regexp_replace(display_name, '''S(\s|$)', '''s\1', 'g')
WHERE type = 'goals'
  AND display_name ~ '''S(\s|$)';
