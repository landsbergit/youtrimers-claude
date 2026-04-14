Read the following files and produce a structured session-start status report:
- `C:\Users\User\.claude\projects\C--Users-User\memory\MEMORY.md`
- `C:\Users\User\.claude\projects\C--Users-User\memory\todo_current_supplements_engine.md`
- `C:\Users\User\.claude\projects\C--Users-User\memory\todo_scoring_phase2_quality.md`
- `C:\Users\User\.claude\projects\C--Users-User\memory\todo_bundles.md`
- `C:\Users\User\.claude\projects\C--Users-User\memory\todo_similar_matches.md`
- `C:\Users\User\.claude\projects\C--Users-User\memory\todo_db_admin.md`
- `src/types/engine.ts`
- `src/context/RecommendationContext.tsx` (first 70 lines only)
- `src/hooks/useRecommendations.ts`

Then produce a report with these sections:

## 1. Engine Pipeline — Current State
List the 7 pipeline steps from CLAUDE.md. For each, note whether it is fully implemented,
partially implemented, or not yet started. Flag any field in MemberProfile that is defined
but not yet wired into the engine (check useRecommendations.ts for what is actually used).

## 2. Profile Sections — What's Built
For each of the 5 sections (Goals, Profile, Preferences, Supplements, Approach), list:
- What fields are collected from the user
- Which fields are passed into MemberProfile / used by the engine
- Which fields are saved but not yet used by the engine

## 3. Open TODOs
List all TODO items from the memory files, grouped as:
- Engine / scoring improvements
- UI features
- Database / admin tasks

## 4. Next Best Action
Based on the above, suggest the single highest-value next piece of work — the thing
most likely to improve recommendation quality or complete an in-progress feature.
Keep this to 2–3 sentences.
