You are about to add a new field to the member profile. This touches multiple files
in a specific order. Work through this checklist sequentially — do not skip steps.

## Step 1 — Decide the data shape
- What is the field name and TypeScript type?
- Where does the data come from? (ontology hook / free input / toggle)
- Should it affect the engine immediately, or is it "saved but not yet wired"?

## Step 2 — Add to MemberProfile (src/types/engine.ts)
Add the field to the `MemberProfile` interface with a comment indicating which section
it belongs to (Goals / Profile / Preferences / Approach).
If not yet used by the engine, add a `// future:` comment instead of an active field.

## Step 3 — Add to RecommendationContext (src/context/RecommendationContext.tsx)
- Add state + setter following the existing pattern
- Read initial value from localStorage on mount (use a `youtrimers_` prefixed key)
- Setter must also persist to localStorage
- Add the field and setter to the context interface AND the Provider value object
- Add the localStorage key to the CLAUDE.md key table

## Step 4 — Add UI to the relevant section component
- Profile fields → `src/components/sections/ProfileSection.tsx`
- Preference fields → `src/components/sections/PreferencesSection.tsx`
- In `handleSave`, call the context setter for the new field
- localStorage write should happen via the context setter (not directly in the component)

## Step 5 — Add to useRecommendations queryKey (src/hooks/useRecommendations.ts)
Even if the field isn't used in the engine yet, add it to the queryKey array so that
future engine changes automatically trigger a re-run when the field changes.

## Step 6 — Wire into the engine (if applicable now)
Decide where in the pipeline the field acts:
- Hard exclusion before scoring → add to `applyDemographicFilter.ts` or a new filter
- Scoring bonus/penalty → add to `scoreProducts.ts`
- Rule trigger → new `trigger_type` in rules table + consolidateRules.ts

## Step 7 — Pass from MatchesSection (src/components/sections/MatchesSection.tsx)
Destructure the new field from `useRecommendationContext()` and add it to the
`MemberProfile` object passed to `useRecommendations()`.

## Step 8 — Database (if the field needs Supabase persistence)
- Create migration `supabase/migrations/0NN_description.sql`
- Add table type to `src/types/database.ts`
- Create `src/hooks/useMemberXxx.ts` following the localStorage + Supabase delete/re-insert pattern
- Run `npx supabase db push` (answer Y)
- Update CLAUDE.md localStorage key table

## Verification checklist
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Field initializes correctly from localStorage on page reload
- [ ] Saving the section updates the context and triggers a Matches re-run
- [ ] Logged-in users: data survives logout + login (stored in Supabase)
