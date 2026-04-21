# Youtrimers — Claude Code Project Guide

## Purpose & Vision
Youtrimers is a **personalized supplement recommendation web app**. Members fill out a
multi-section profile (goals, demographics, health conditions, medications, current
supplements, dosage preferences) and receive a ranked stack of supplement products drawn
from a catalog of ~4,163 active iHerb products. Monetization is via iHerb affiliate links.

The core value proposition: explainable, ontology-driven matching — not generic
bestseller lists. Every recommendation traces back to a fired rule and a nutrient
requirement derived from the member's profile.

---

## Design Identity

### Character
- Calm, trustworthy, knowledgeable — health/wellness tone (not clinical, not aggressive)
- Reference brands: Calm app, Ritual vitamins, Care/of
- Generous whitespace, considered typography, premium feel
- Never use pure `#000000` or `#FFFFFF`

### Typography
| Role | Font | Tailwind class |
|---|---|---|
| Headings | Fraunces (serif, warm) | `font-heading` |
| Body / UI / Labels | Inter (clean, legible) | default |

### Color System
The UI uses **Tailwind CSS semantic tokens** — always use these, never hardcode hex.

| Token | Usage |
|---|---|
| `bg-background` / `text-foreground` | Page background, primary text |
| `bg-primary` / `text-primary-foreground` | CTAs, active states, buttons |
| `text-muted-foreground` / `bg-muted` | Secondary text, placeholders, skeletons |
| `border-border` | All borders and dividers |
| `text-destructive` | Errors, remove actions |
| `text-success` | Saved confirmation, positive states |
| `bg-popover` | Dropdowns, tooltips, popovers |
| `bg-primary/10`, `border-primary/30` | Selected pill backgrounds |

Underlying palette (for reference only — not used directly in code):
- Primary teal: `#22A68C` | Dark navy: `#11192A` | Warm off-white bg: `#F9F7F4`
- Pale mint accent: `#E3EFE9` | Warning amber: `#E8A838` | Error red: `#C95F4A`

### Component Conventions
- Rounded corners: `rounded-lg` for inputs/buttons, `rounded-xl` for cards/popovers, `rounded-full` for pills
- Focus ring: `focus:border-primary/60 focus:ring-1 focus:ring-primary/20`
- Transitions: `transition-colors` on all interactive elements
- Pill tags (selected items): `border border-primary/30 bg-primary/10 text-primary px-3 py-1 rounded-full`
- Section layout: `px-4 py-20 sm:px-6 lg:px-8` with `mx-auto max-w-7xl` inside
- Toast duration: default (4 s) for standard messages; `{ duration: 8000 }` for important limit/warning messages (e.g. max goals reached)

---

## Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite (SPA, no SSR) |
| Styling | Tailwind CSS + shadcn/ui components |
| Data fetching | @tanstack/react-query v5 |
| Backend / DB | Supabase (Postgres + RLS + Auth) |
| Auth | Supabase Auth — Google OAuth |
| Hosting | (TBD) |

**Working directory:** `C:\Users\User\Documents\NUTRIMERS_2026\Website\youtrimers`

---

## Recommendation Engine Pipeline

All engine code lives in `src/lib/engine/` and is **pure TypeScript** (no Supabase calls,
no side effects). The hook `useRecommendations` orchestrates the pipeline.

```
1. get_rules_for_goals RPC  →  FiredRule[]
   (all DB rules whose trigger_node_id matches a selected goal UUID)

2. consolidateRules()       →  ConsolidatedRules
   (merge conflicts by priority; accumulate nutrient requirements)

3. get_nutrient_descendants →  Map<ancestorId, Set<descendantId>>
   (so VITAMIN_D3 satisfies a VITAMIN_D requirement)

4. applyDemographicFilter() →  ProductWithIngredients[]  [HARD EXCLUSION]
   (remove products whose normalized_tags conflict with gender / age / reproductive status)

5. Dosage form pre-filter   →  ProductWithIngredients[]  [HARD EXCLUSION]
   (keep only products matching acceptedDosageFormNames; falls back to full set if 0 pass)

6. scoreProducts()          →  RankedProduct[]
   (weighted nutrient coverage; presence-based for MVP; bundles up to maxBundleSize)

7. persistAudit()           →  member_recommendations insert  [fire-and-forget]
```

**MemberProfile** (`src/types/engine.ts`) is the single input type to the engine.
Add new profile fields here first, then wire through context → hook → filter/scorer.

---

## Profile → Engine Data Flow

```
ProfileSection.handleSave()
  └─ writes localStorage keys
  └─ calls RecommendationContext setters  ← triggers re-run

RecommendationContext  (src/context/RecommendationContext.tsx)
  ├─ reads all profile fields from localStorage on mount
  ├─ exposes setters that also persist to localStorage
  └─ provides goalIds, gender, reproductiveStatus, birthYear/Month,
     acceptedDosageFormNames, qualityWeight, maxBundleSize, diversityWeight

MatchesSection
  └─ reads context → builds MemberProfile → passes to useRecommendations()

useRecommendations(profile: MemberProfile)   [React Query]
  └─ runs pipeline steps 1–7 above
  └─ queryKey includes all MemberProfile fields → auto-reruns on any change
```

---

## Ontology System

All domain knowledge lives in the `ontology` table:
`id UUID | node_name TEXT | display_name TEXT | parent_id UUID (nullable)`

**Key RPC:** `get_nutrient_descendants(p_node_ids uuid[])` returns
`{ancestor_id, descendant_id}` for every descendant (including the seed itself).
Use `.descendant_id` to collect IDs, then fetch full node records from `ontology`.

**Leaf detection:** a node is a leaf if it has no children in the subtree.
Standard pattern: build `childrenOf` Map from `parent_id`, then `collectLeaves(nodeId)`
recursively returns `[]` → node itself, or flattens children.

### Root Node UUIDs (permanent — never change)
| Node | UUID | Key children |
|---|---|---|
| GOALS | `d97520ed-5f06-48b0-ad50-f2745b478815` | BEAUTY_CATEGORY, FITNESS_CATEGORY, REPRODUCTIVE_CATEGORY, LONGEVITY_CATEGORY, COGNITIVE_CATEGORY, HEALTH_GOALS_CATEGORY |
| NUTRIENTS | `b2114720-4ff0-4ee3-b97d-32516eb3d596` |
| DOSAGE_FORM | `a870f46e-4e2b-483a-8ce4-a6dc34851c6f` |
| MEDICATIONS | `cbeab053-5abd-4f04-9e76-151986c35099` |
| HEALTH_CONDITIONS | `49cc7029-6ac3-49e4-bbfc-5812752e8b5b` |
| CONDITIONS_BY_ORGANS | `b20ff344-4f7f-4ad7-92bd-e38b2d18a2b9` |
| CONDITIONS_BY_SYSTEMS | `71f38e38-b49d-4013-8729-3ad4213df927` |
| TAGS | `5740d844-ddf6-42ee-8420-2e62d239020c` |
| FOOD_RESTRICTIONS | `65181588-1165-4492-969d-55f2475db705` |
| FOOD_PREFERENCES | `c4b146b8-754d-4d70-84c2-e871ae843f0b` |
| REPRODUCTIVE_STATUS | `3d01927d-0451-42c8-b773-3540a54994e1` |
| DEMOGRAPHICS | `c23c0b66-bb97-4e44-a62f-6a5ffce470c0` |
| BASIC_PROFILE | `37c15ac8-07db-4c87-a3b4-2dc45fd1fd4e` |
| LIFE_STYLE | `85277d69-4569-4fe8-9eb8-31f8cd5cbabb` |
| DIET | `594f6bc7-d09f-462d-b6c8-ecf1c6759b08` |
| GENETICS | `dc9ca6c3-afd2-44a5-8bf1-ace0ae9b6f3b` |
| SALTS | `e0ba69dd-13a6-4a66-8c76-2e3dc19dccaa` |
| IGNORE (deactivated) | `9b7fee04-1521-408e-8ae3-3cd8631ff90a` |

### Key Non-Root UUIDs
| Node | UUID |
|---|---|
| GLANDS (0 children — hidden in body map) | `094ebfd8-6183-471e-b921-04a9e5643ff1` |

---

## localStorage Keys
All prefixed `youtrimers_`. **Never rename** without updating context + all hooks.

| Key | Set by | Used by |
|---|---|---|
| `youtrimers_gender` | ProfileSection → context | applyDemographicFilter |
| `youtrimers_reproductive_status` | ProfileSection → context | applyDemographicFilter |
| `youtrimers_birth_year` | ProfileSection → context | age defaults, filter |
| `youtrimers_birth_month` | ProfileSection → context | age defaults, filter |
| `youtrimers_food_restrictions` | ProfileSection | (engine: future) |
| `youtrimers_food_prefs` | PreferencesSection | (engine: future) |
| `youtrimers_dosage_forms` | PreferencesSection → context | dosage form pre-filter |
| `youtrimers_dosage_saved` | PreferencesSection → context | blocks auto-defaults |
| `youtrimers_medications` | useMemberMedications | (engine: future) |
| `youtrimers_current_supplements` | useMemberCurrentSupplements | (engine: future) |
| `youtrimers_health_conditions` | useMemberHealthConditions | (engine: future) |
| `youtrimers_religious_preferences` | useMemberReligiousPreferences | applyReligiousFilter (hard exclusion) |
| `youtrimers_body_size` | ProfileSection → context | (engine: future) |
| `youtrimers_height_cm` | ProfileSection → context | (engine: future) — always metric |
| `youtrimers_weight_kg` | ProfileSection → context | (engine: future) — always metric |
| `youtrimers_use_imperial` | ProfileSection → context | display preference only; not sent to engine |

---

## Persistence Pattern (localStorage + Supabase)

Every member data list follows this pattern in its `useMemberXxx` hook:
1. **Init:** read from localStorage
2. **On login:** fetch from Supabase `members` table → overwrite localStorage (Supabase wins)
3. **`saveXxx()`:** write localStorage → if logged in: delete-all + re-insert to Supabase

Primary member lookup: `.eq("user_id", user.id).eq("is_primary", true).maybeSingle()`

---

## Page Sections (in order)

| # | Section ID | Component | Saved when |
|---|---|---|---|
| 1 | `#goals` | GoalsSection | "Save Goals" clicked |
| 2 | `#profile` | ProfileSection | "Save Profile" clicked |
| 3 | `#preferences` | PreferencesSection | "Save Preferences" clicked |
| 4 | `#supplements` | CurrentSupplementsSection | "Save Supplements" clicked |
| 5 | `#approach` | ApproachSection | slider / setting changes |
| — | `#matches` | MatchesSection | auto-runs; shows results |
| — | `#cart` | CartSection | — |

`SECTION_ORDER` in `RecommendationContext.tsx` must match this order.
After each save, auto-scroll to next unsaved section (or `#matches` when all done).

---

## Database Conventions

- **Migrations:** `supabase/migrations/NNN_description.sql` — next is `024_...`
- **Apply:** `npx supabase db push` (prompts Y/n — answer Y)
- **Type stubs:** `src/types/database.ts` — manually maintained; add table types for every new table
- **RLS pattern:** every member table uses:
  ```sql
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
  ```
- **Rules** are authored directly in Supabase Studio (table editor). No admin UI.
- **trigger_type** on rules: currently only `'goal'`. Future: `'demographic'`, `'condition'`.

---

## Supabase Connection
- **URL:** `https://hhbxnmsyxerwpxllghvy.supabase.co`
- **Anon key:** in `.env.local` as `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Direct REST query (for exploration):**
  ```
  curl "https://hhbxnmsyxerwpxllghvy.supabase.co/rest/v1/<table>?select=..." \
    -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>"
  ```

---

## Key Source Files

| File | Purpose |
|---|---|
| `src/types/engine.ts` | `MemberProfile`, `RankedProduct`, all engine types |
| `src/types/database.ts` | Supabase table types (manually maintained) |
| `src/context/RecommendationContext.tsx` | All profile state; section save tracking |
| `src/hooks/useRecommendations.ts` | Full engine pipeline orchestration |
| `src/hooks/useProductCatalog.ts` | Cached product + ingredients catalog |
| `src/lib/engine/consolidateRules.ts` | Rule merging and conflict resolution |
| `src/lib/engine/scoreProducts.ts` | Weighted scoring + bundle assembly |
| `src/lib/engine/applyDemographicFilter.ts` | Hard tag-based exclusion by gender/age |
| `src/lib/engine/diversifyResults.ts` | Diversity re-ranking |
| `src/components/sections/MatchesSection.tsx` | Recommendation display + progress UI |
| `src/components/sections/ProfileSection.tsx` | Gender, age, conditions, medications |
| `src/components/sections/PreferencesSection.tsx` | Dosage forms + food preferences |

---

## Environment & Tooling
- **Dev server:** `npm run dev`
- **Type check:** `npx tsc --noEmit`
- **No Python or jq installed** — use `node -e "..."` for inline scripting
- **Shell:** bash (Unix paths, forward slashes, even on Windows)
- **Migrations apply interactively** — must answer `Y` at the prompt

---

## Sensitive User Data — Phased Approach

Fields: **smoking status** and **genetics** (and any other sensitive personal data).

| Phase | Status | Policy |
|---|---|---|
| **Phase 1** (current) | Not collected | Sensitive fields are not displayed, not collected, not stored |
| **Phase 2** (post-launch) | Session-only | Collect in-session for engine use; **never persist** to database or localStorage. Requires legal review for IL + US, and possible coordination with iHerb affiliate program |
| **Phase 3** (future) | Full compliance | Add consent flows, privacy policy, data retention controls, and all regulations required in Israel and the US |

**Do not build smoking or genetics UI or engine wiring until Phase 2 is explicitly started.**
Phase 2 cannot begin until: affiliate program is live, site is active, and legal review is complete.

---

## Open TODOs (see memory files for details)

### Engine integration (ontology fields already in UI)
- **Health Conditions** → engine scoring (rules are ready, next priority)
- **Medications** → engine scoring/exclusion (after health conditions)
- **Food Restrictions** → hard exclusion filter (gluten free, vegan, etc.)
- **Food Preferences** → scoring bonus (organic, non-GMO, whole food)
- Engine integration for current supplements (covered nutrients → affect scoring, no exclusion)
- `diversityWeight` is in context but not yet wired into engine queryKey / scoreProducts

### New profile fields (UI + engine)
- **Height & weight** → add to BasicProfile section in ProfileSection (explicit instructions pending)
- **Pill size preference** — allow users to indicate preference for smaller pills (e.g., easy-to-swallow). Extract pill/tablet dimensions from iHerb product data where available. Use as a scoring factor or filter in the engine.
- **Time of day intake** — allow users to specify preferred intake time (morning, evening, with meals, etc.). Use to recommend products with compatible dosing instructions and flag potential timing conflicts (e.g., energizing supplements not recommended at night). Requires extracting dosing/timing info from product data.
- **LIFE_STYLE ontology branch** → exercise frequency, sleep, stress etc. (children TBD) — add UI + engine rules when ready
- **DIET ontology branch** → weekly food intake self-assessment → derive nutrient requirements per nutrient group — significant feature, design needed

### Data pipeline
- **Add "No Artificial Colors or Flavors" to ontology** — Add as a node under TAGS or FOOD_RESTRICTIONS. Extract from iHerb product descriptions/labels. Wire into food preferences or restrictions for scoring boost / filtering.
- Rebuild iHerb data extraction pipeline: minerals, non-vitamin nutrients, complete vitamin dose data (populates `product_ingredients.amount_per_serving` / `amount_unit` → unlocks dose-based scoring automatically)
- **HTML entities in product names** — `&amp;` and `&#174;` (®) not decoded in `3A_extract.py`; fix with `html.unescape()` on extracted product name
- **Low tag coverage (partially addressed)** — `batch_extract_tags.py` in `dataPrep_iHerb/` scans all scraped HTML pages for "Free" / preference labels (Gluten Free, Organic, Vegan, etc.) using regex and merges them into `products.normalized_tags` in Supabase. Run with `--dry-run` first to preview, then without for live update. Requires `SUPABASE_SERVICE_ROLE_KEY` in env. Does NOT remove existing tags — only appends new ones. Handles all hyphenated/non-hyphenated variants (e.g. "Non GMO", "Non-GMO", "non-gmo").
- **VEGETERIAN typo** in ontology node name (should be VEGETARIAN) — fix in Supabase ontology table and in Ontology.yaml source file
- **US-only products** — some iHerb products are geo-restricted and skipped during scraping from an Israeli IP; to capture them, connect Chrome to a US VPN before launching with `--remote-debugging-port=9222`, then run a targeted re-scrape of the missing product IDs

### Scoring & recommendations
- Scoring Phase 2: quality_tier bonus in scoreProducts.ts
- Bundle improvements: overlap penalty, dedup in UI, triplet price penalty
- "Explore Similar" feature on liked products in Matches

### UX & Content
- **Search medications by diseases** — allow users to find medications by searching for a disease/condition name, then select from medications commonly prescribed for that condition. Requires a disease-to-medication mapping (ontology or external API). Button placeholder already exists in ProfileSection Medications sub-section.
- **Explanation level selector** — let users choose how much detail they see (e.g. "Simple" / "Standard" / "Expert"). At the "Simple" level all copy should be plain language aimed at adults with no domain knowledge: no Latin names, no clinical jargon, short sentences. Applies to: nutrient tooltips, rule descriptions, product card explanations, and any other copy that currently assumes domain knowledge.

### Accessibility & Legal
- **Web accessibility (avoid legal risk)** — audit and implement WCAG 2.1 AA compliance before launch. Covers: keyboard navigation, screen reader support (ARIA labels), sufficient color contrast, focus indicators, alt text on images, and accessible form inputs. Required in both Israel (Equal Rights for Persons with Disabilities Law) and the US (ADA / Section 508).

### Design Decisions
- **Product cards: equal height per row (not masonry)** — Cards in the Matches grid use equal-height rows (CSS grid default stretch). This means shorter cards have empty space at the bottom, but the reading order is natural left-to-right (1,2 then 3,4). The alternative (CSS `columns` masonry) would eliminate empty space but changes the reading order to column-first (1,3,5 left; 2,4,6 right), which is confusing for ranked results. Decision: keep uniform row height for predictable reading order.

- **Default product display (no goals selected)** — When no goals are selected, the Matches section shows N products (default 16) sampled from demographic groups (Female, Male, Senior, Adult, Teen, Child, Baby) in round-robin order: positions 1–7 show one from each group, 8–14 another from each group, etc. Random selection within each group. All existing filters apply (gender hard exclusion, age preferred exclusion, religious, food restrictions). Remaining slots fill from untagged products. Component: `DefaultProductGrid.tsx`. When goals are selected, switches to the full engine pipeline.

- **Demographic engine behaviors** — Gender: hard-exclude opposite gender (existing) + 10% score boost for matching gender tag (disabled at quality-first, qualityWeight ≥ 0.9). Age: "preferred exclusion" — age-inappropriate products are filtered out, but if filtering leaves zero results the filter is bypassed (fallback). Both behaviors persist when goals are selected. Terminology: "preferred exclusion" = prefer not to show but show if nothing else available.

### Maintenance
- Delete test rule "test1" (needs service role key or SQL Editor)
- **Deactivate non-supplement products** — Audit and deactivate food/cosmetic products incorrectly marked as active supplements (e.g., Soy Sauce ID 14054). Run via SQL Editor: `UPDATE products SET is_active = false WHERE id IN (...)`. Consider adding a product-type column or automated detection in the data pipeline to prevent future occurrences.
