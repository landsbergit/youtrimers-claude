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
  goalIds: string[]; // ontology node UUIDs of selected goals
  // future: age?: number;
  // future: gender?: string;             // ontology node UUID
  // future: currentSupplementIds?: string[];
  // future: approachTagIds?: string[];   // e.g. VEGAN, ORGANIC
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
}

export interface FiredRule {
  ruleId: string;
  ruleName: string;
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
  weight: number;
  contributingRuleIds: string[];
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
  amountPerServing: number | null;
  amountUnit: string | null;
}

export interface ProductWithIngredients {
  id: number;
  productName: string;
  imageUrl: string | null;
  productUrl: string | null;
  normalizedDosageForm: string | null;
  normalizedTags: string[];
  costUsd: number | null;
  ingredients: ProductIngredient[];
}

// ── Scoring output ─────────────────────────────────────────────────────────────

export interface RankedProduct {
  product: ProductWithIngredients;
  score: number; // 0–1
  matchedNutrientNodeIds: string[];
  missedNutrientNodeIds: string[];
  scoreBreakdown: Record<string, number>; // nutrientNodeId → contribution
}
