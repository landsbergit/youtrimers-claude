// TypeScript types for the rule engine pipeline.
// These types flow from DB → engine functions → hooks → UI components.

export type ActionType =
  | "require_nutrient"
  | "avoid_nutrient"
  | "prefer_tag"
  | "avoid_tag"
  | "prefer_form";

export type ConflictStrategy = "accumulate" | "override" | "cap" | "avoid";

// ── Input ──────────────────────────────────────────────────────────────────────

/**
 * The member's profile as consumed by the engine.
 * For MVP only goalIds is populated; future fields are listed for extensibility.
 */
export interface MemberProfile {
  // ── Section 1: Goals ──────────────────────────────────────────────────────
  goalIds: string[]; // ontology node UUIDs of selected goals

  // ── Section 2: Profile ────────────────────────────────────────────────────
  /** "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null (unknown) */
  gender: string | null;
  /** Ontology node_name of the selected reproductive status, e.g. "PREGNANCY". null = none. */
  reproductiveStatus: string | null;
  birthYear: number | null;
  birthMonth: number | null; // 1-indexed; null when not provided

  // ── Section 3: Preferences ────────────────────────────────────────────────
  /** Leaf-level node_names of accepted dosage forms. Empty = no filter. */
  acceptedDosageFormNames: string[];
  /** node_names of selected religious certifications (e.g. "KOSHER", "HALAL").
   *  Empty = no filter. Non-empty = products must carry ALL selected tags. */
  religiousPreferences: string[];

  // ── Approach ──────────────────────────────────────────────────────────────
  qualityWeight: number; // 0 = rank by price, 1 = rank by match quality, default 0.5
  maxBundleSize: number; // 1 = singles only, 2 = pairs, 3 = triplets. Default 2.

  // future: foodRestrictions?: string[];     // e.g. VEGAN, GLUTEN_FREE
  // future: foodPreferences?: string[];      // e.g. ORGANIC, NON_GMO
  // future: healthConditionIds?: string[];   // ontology node UUIDs
  // future: medicationIds?: string[];        // ontology node UUIDs
  // future: currentSupplementIds?: number[]; // product IDs

  // ── Section 2: Profile — Body Size / Measurements ─────────────────────────
  /** Categorical body size shortcut. Collected now; engine use is future. */
  bodySize: "LOW" | "MEDIUM" | "HIGH" | null;
  /** Height in cm (always metric). Collected now; engine use is future. */
  heightCm: number | null;
  /** Weight in kg (always metric). Collected now; engine use is future. */
  weightKg: number | null;
}

// ── Rule data (from DB via RPC) ────────────────────────────────────────────────

export interface RuleAction {
  actionId: string;
  actionType: ActionType;
  nutrientNodeId?: string;
  nutrientDisplayName?: string;
  tagNodeId?: string;
  formNodeId?: string;
  minDose?: number | null;
  maxDose?: number | null;
  preferredDose?: number | null;
  unit?: string | null;
  dosePriority: number;
  /** Only meaningful for avoid_nutrient actions. */
  enforceLevel: 'requirement' | 'recommendation';
}

export interface FiredRule {
  ruleId: string;
  ruleName: string;
  description: string | null;
  triggerNodeId: string;
  priority: number;
  conflictStrategy: ConflictStrategy;
  actions: RuleAction[];
}

// ── Engine internals ───────────────────────────────────────────────────────────

/**
 * A single nutrient requirement produced by consolidating all fired rules.
 * weight = 1 / sourcePriority so higher-priority rules contribute more to scoring.
 */
export interface NutrientRequirement {
  nutrientNodeId: string;
  nutrientDisplayName: string | null;
  minDose: number | null;
  maxDose: number | null;
  preferredDose: number | null;
  unit: string | null;
  isRequired: boolean; // false = "avoid this nutrient"
  /** For avoid entries: 'requirement' = hard filter (product excluded entirely);
   *  'recommendation' = soft penalty (score × 0.5). */
  enforceLevel: 'requirement' | 'recommendation';
  weight: number;
  contributingRuleIds: string[];
  /** Human-readable explanations from each contributing rule's description field. */
  contributingRuleDescriptions: string[];
}

/**
 * The output of consolidateRules(): everything the scorer needs.
 * Named ConsolidatedRules (not Profile) to avoid confusion with MemberProfile.
 */
export interface ConsolidatedRules {
  requirements: NutrientRequirement[];
  preferredTagNodeIds: string[];
  avoidedTagNodeIds: string[];
  preferredFormNodeIds: string[];
  firedRuleIds: string[];
}

// ── Product data ───────────────────────────────────────────────────────────────

export interface ProductIngredient {
  ingredientId: number;
  ontologyNodeId: string; // UUID from ontology; empty string if unlinked
  ingredientName: string; // normalized_ingredient text, for display
  amountPerServing: number | null;
  amountUnit: string | null;
}

export interface ProductWithIngredients {
  id: number;
  productName: string;
  brand: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  normalizedDosageForm: string | null;
  normalizedTags: string[];
  costUsd: number;           // always positive — products without valid price are excluded from catalog
  servingsPerContainer: number; // always positive
  ingredients: ProductIngredient[];
}

// ── Scoring output ─────────────────────────────────────────────────────────────

export interface RankedProduct {
  /** One product for singles; two or three for bundles. */
  products: ProductWithIngredients[];
  score: number; // 0–1
  matchedNutrientNodeIds: string[];
  missedNutrientNodeIds: string[];
  extraIngredientNames: string[]; // linked ingredients not covering any requirement
  scoreBreakdown: Record<string, number>; // nutrientNodeId → contribution
}
