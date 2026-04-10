import type {
  ConsolidatedRules,
  NutrientRequirement,
  ProductIngredient,
  ProductWithIngredients,
  RankedProduct,
} from "@/types/engine";
import { meetsThreshold } from "./unitNormalizer";

const MIN_SCORE_THRESHOLD = 0.1;
const TAG_BONUS = 0.05;
const TAG_PENALTY = 0.25;
const OVERDOSE_MULTIPLIER = 0.7;
const AVOID_NUTRIENT_MULTIPLIER = 0.5;
const FOCUS_WEIGHT = 0.08;

/** Top-N singles by overall coverage score included in the bundle candidate pool. */
const BUNDLE_POOL_OVERALL_PAIR = 20;
const BUNDLE_POOL_OVERALL_TRIPLET = 10;
/** Top-K specialists per required nutrient added to the pool on top of the overall pool. */
const BUNDLE_POOL_PER_NUTRIENT = 5;

// ── Internal scoring helper ────────────────────────────────────────────────────

/**
 * Score a merged ingredient map against consolidated requirements.
 * Works identically for single products (map from one product) and bundles
 * (map merged from 2–3 products — "present" means present in ANY product).
 */
function scoreIngredientMap(
  ingredientByNodeId: Map<string, ProductIngredient>,
  required: NutrientRequirement[],
  avoided: NutrientRequirement[],
  totalWeight: number,
  nutrientDescendants: Map<string, Set<string>> | undefined,
): {
  coverageScore: number;
  matchedNutrientNodeIds: string[];
  missedNutrientNodeIds: string[];
  extraIngredientNames: string[];
  breakdown: Record<string, number>;
  /** True when a requirement-level avoid nutrient is present → caller must exclude this item. */
  hardAvoidViolated: boolean;
} {
  const matchedNutrientNodeIds: string[] = [];
  const missedNutrientNodeIds: string[] = [];
  const breakdown: Record<string, number> = {};
  let weightedScore = 0;
  const coveredIngredientNodeIds = new Set<string>();

  for (const req of required) {
    const acceptableIds =
      nutrientDescendants?.get(req.nutrientNodeId) ?? new Set([req.nutrientNodeId]);
    let ingredient: ProductIngredient | undefined;
    let matchedNodeId: string | undefined;
    for (const nodeId of acceptableIds) {
      ingredient = ingredientByNodeId.get(nodeId);
      if (ingredient) {
        matchedNodeId = nodeId;
        break;
      }
    }

    let satisfaction = 0;

    if (ingredient && matchedNodeId) {
      coveredIngredientNodeIds.add(matchedNodeId);
      const hasDoseData =
        ingredient.amountPerServing != null && ingredient.amountUnit != null;

      if (!hasDoseData || req.preferredDose == null) {
        satisfaction = 1.0;
        matchedNutrientNodeIds.push(req.nutrientNodeId);
      } else {
        const amount = ingredient.amountPerServing!;
        const unit = ingredient.amountUnit!;

        if (req.preferredDose != null) {
          const ratio = meetsThreshold(amount, unit, req.preferredDose, req.unit ?? unit)
            ? 1.0
            : amount / (req.preferredDose * 1000);
          satisfaction = Math.min(ratio, 1.0);
        } else if (req.minDose != null) {
          satisfaction = meetsThreshold(amount, unit, req.minDose, req.unit ?? unit)
            ? 1.0
            : 0.5;
        }

        if (
          req.maxDose != null &&
          meetsThreshold(amount, unit, req.maxDose, req.unit ?? unit) &&
          amount > req.maxDose
        ) {
          satisfaction *= OVERDOSE_MULTIPLIER;
        }

        if (satisfaction >= 0.5) {
          matchedNutrientNodeIds.push(req.nutrientNodeId);
        } else {
          missedNutrientNodeIds.push(req.nutrientNodeId);
        }
      }
    } else {
      missedNutrientNodeIds.push(req.nutrientNodeId);
    }

    const contribution = req.weight * satisfaction;
    weightedScore += contribution;
    breakdown[req.nutrientNodeId] = contribution;
  }

  let coverageScore = totalWeight > 0 ? weightedScore / totalWeight : 1.0;

  // Avoid-nutrient handling — split by enforce level:
  //   'requirement'   → hard filter: flag for exclusion (caller drops the item entirely)
  //   'recommendation' → soft penalty: multiply coverage score by 0.5
  let hardAvoidViolated = false;
  for (const avoid of avoided) {
    const avoidIds =
      nutrientDescendants?.get(avoid.nutrientNodeId) ?? new Set([avoid.nutrientNodeId]);
    const present = [...avoidIds].some((id) => ingredientByNodeId.has(id));
    if (!present) continue;

    if (avoid.enforceLevel === 'requirement') {
      hardAvoidViolated = true;
    } else {
      coverageScore *= AVOID_NUTRIENT_MULTIPLIER;
    }
  }

  // Focus penalty
  const extraIngredientNames: string[] = [];
  const linkedCount = ingredientByNodeId.size;
  if (linkedCount > 0) {
    for (const [nodeId, ing] of ingredientByNodeId) {
      if (!coveredIngredientNodeIds.has(nodeId)) {
        extraIngredientNames.push(ing.ingredientName || nodeId);
      }
    }
    const focusPenalty = FOCUS_WEIGHT * (extraIngredientNames.length / linkedCount);
    coverageScore *= 1 - focusPenalty;
  }

  return {
    coverageScore,
    matchedNutrientNodeIds,
    missedNutrientNodeIds,
    extraIngredientNames,
    breakdown,
    hardAvoidViolated,
  };
}

/** Build a merged ingredient map from an array of products (union — first occurrence wins). */
function mergeIngredientMaps(
  products: ProductWithIngredients[],
): Map<string, ProductIngredient> {
  const merged = new Map<string, ProductIngredient>();
  for (const p of products) {
    for (const ing of p.ingredients) {
      if (ing.ontologyNodeId && !merged.has(ing.ontologyNodeId)) {
        merged.set(ing.ontologyNodeId, ing);
      }
    }
  }
  return merged;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Score every product (and bundle combination) against the consolidated rules
 * and return a single ranked list sorted by blended score.
 *
 * @param maxBundleSize  1 = singles only, 2 = also generate pairs,
 *                       3 = also generate triplets. Default 2.
 */
export function scoreProducts(
  products: ProductWithIngredients[],
  consolidatedRules: ConsolidatedRules,
  nutrientDescendants?: Map<string, Set<string>>,
  qualityWeight = 0.5,
  maxBundleSize = 2,
): RankedProduct[] {
  const required = consolidatedRules.requirements.filter((r) => r.isRequired);
  const avoided = consolidatedRules.requirements.filter((r) => !r.isRequired);

  if (required.length === 0) return [];

  // Pre-compute cost-per-serving bounds from singles for price normalisation.
  let minCost = Infinity;
  let maxCost = -Infinity;
  if (qualityWeight < 1) {
    for (const p of products) {
      const c = p.costUsd / p.servingsPerContainer;
      if (c < minCost) minCost = c;
      if (c > maxCost) maxCost = c;
    }
  }

  const totalWeight = required.reduce((sum, r) => sum + r.weight, 0);

  // ── 1. Score all singles ────────────────────────────────────────────────────

  interface Candidate {
    productGroup: ProductWithIngredients[];
    coverageScore: number;
    matchedNutrientNodeIds: string[];
    missedNutrientNodeIds: string[];
    extraIngredientNames: string[];
    breakdown: Record<string, number>;
    hardAvoidViolated: boolean;
  }

  const singles: Candidate[] = [];

  for (const product of products) {
    const ingredientByNodeId = new Map<string, ProductIngredient>();
    for (const ing of product.ingredients) {
      if (ing.ontologyNodeId) ingredientByNodeId.set(ing.ontologyNodeId, ing);
    }

    const result = scoreIngredientMap(
      ingredientByNodeId,
      required,
      avoided,
      totalWeight,
      nutrientDescendants,
    );

    if (result.coverageScore > 0) {
      singles.push({ productGroup: [product], ...result });
    }
  }

  // ── 2. Generate bundle candidates ──────────────────────────────────────────

  const bundles: Candidate[] = [];

  if (maxBundleSize >= 2) {
    // ── Candidate pool ──────────────────────────────────────────────────────
    // Two pools are merged to avoid missing specialist products:
    //
    // Pool A — top-N by overall coverage score.
    //   Catches products that cover many requirements simultaneously.
    //
    // Pool B — top-K per required nutrient.
    //   Catches specialists (e.g. a pure Zinc product, or a Vit A+D combo)
    //   even when their overall score is low because they miss other nutrients.
    //   Without this pool a product like "Swanson Vitamins A & D" (covering 2/3
    //   requirements) would be excluded if ≥ POOL_OVERALL_PAIR products scored
    //   higher by covering all 3 requirements individually.

    const buildCandidatePool = (overallLimit: number): Candidate[] => {
      const bySingleCoverage = [...singles].sort(
        (a, b) => b.coverageScore - a.coverageScore,
      );

      const poolIds = new Set<number>();
      const pool: Candidate[] = [];

      // Pool A: overall top-N
      for (const c of bySingleCoverage.slice(0, overallLimit)) {
        poolIds.add(c.productGroup[0].id);
        pool.push(c);
      }

      // Pool B: focused, affordable specialists — one pool per required nutrient.
      //
      // Goal: find products that cover a specific required nutrient with as few
      // extra ingredients as possible and at a low cost. These are ideal bundle
      // partners because they add the missing nutrient without polluting the
      // combined ingredient profile or driving up the price.
      //
      // Sorting: extraIngredientNames.length ASC (most focused first),
      //          then costPerServing ASC (cheapest among equally focused).
      //
      // Products already in Pool A are excluded BEFORE slicing, so that
      // full-coverage products in Pool A can't crowd out genuine specialists.
      for (const req of required) {
        const acceptableIds =
          nutrientDescendants?.get(req.nutrientNodeId) ??
          new Set([req.nutrientNodeId]);

        const specialists = singles
          .filter(
            (c) =>
              !poolIds.has(c.productGroup[0].id) &&
              c.matchedNutrientNodeIds.some((nid) => acceptableIds.has(nid)),
          )
          .sort((a, b) => {
            const extraDiff =
              a.extraIngredientNames.length - b.extraIngredientNames.length;
            if (extraDiff !== 0) return extraDiff;
            const aCps =
              a.productGroup[0].costUsd / a.productGroup[0].servingsPerContainer;
            const bCps =
              b.productGroup[0].costUsd / b.productGroup[0].servingsPerContainer;
            return aCps - bCps;
          })
          .slice(0, BUNDLE_POOL_PER_NUTRIENT);

        for (const c of specialists) {
          poolIds.add(c.productGroup[0].id);
          pool.push(c);
        }
      }

      return pool;
    };

    const pairCandidates = buildCandidatePool(BUNDLE_POOL_OVERALL_PAIR);

    // Pairs
    for (let i = 0; i < pairCandidates.length; i++) {
      for (let j = i + 1; j < pairCandidates.length; j++) {
        const group = [
          pairCandidates[i].productGroup[0],
          pairCandidates[j].productGroup[0],
        ];
        const merged = mergeIngredientMaps(group);
        const result = scoreIngredientMap(
          merged, required, avoided, totalWeight, nutrientDescendants,
        );
        const bestSingleMatched = Math.max(
          pairCandidates[i].matchedNutrientNodeIds.length,
          pairCandidates[j].matchedNutrientNodeIds.length,
        );
        if (result.matchedNutrientNodeIds.length > bestSingleMatched) {
          bundles.push({ productGroup: group, ...result });
        }
      }
    }

    // Triplets
    if (maxBundleSize >= 3) {
      const tripletCandidates = buildCandidatePool(BUNDLE_POOL_OVERALL_TRIPLET);

      for (let i = 0; i < tripletCandidates.length; i++) {
        for (let j = i + 1; j < tripletCandidates.length; j++) {
          for (let k = j + 1; k < tripletCandidates.length; k++) {
            const group = [
              tripletCandidates[i].productGroup[0],
              tripletCandidates[j].productGroup[0],
              tripletCandidates[k].productGroup[0],
            ];
            const merged = mergeIngredientMaps(group);
            const result = scoreIngredientMap(
              merged, required, avoided, totalWeight, nutrientDescendants,
            );
            const bestSingleMatched = Math.max(
              tripletCandidates[i].matchedNutrientNodeIds.length,
              tripletCandidates[j].matchedNutrientNodeIds.length,
              tripletCandidates[k].matchedNutrientNodeIds.length,
            );
            if (result.matchedNutrientNodeIds.length > bestSingleMatched) {
              bundles.push({ productGroup: group, ...result });
            }
          }
        }
      }
    }
  }

  // ── 3. Apply price blending, filter, and sort ───────────────────────────────

  const all: RankedProduct[] = [];

  const applyBlend = (candidate: Candidate): RankedProduct | null => {
    // Hard requirement-level avoid violated — exclude entirely, never shown to user
    if (candidate.hardAvoidViolated) return null;

    let blendedScore = candidate.coverageScore;

    if (qualityWeight < 1 && maxCost > minCost) {
      const bundleCostPerServing = candidate.productGroup.reduce(
        (sum, p) => sum + p.costUsd / p.servingsPerContainer,
        0,
      );
      // Clamp to [0,1] — bundles always cost more than the catalog max single
      const priceScore = Math.max(
        0,
        1 - (bundleCostPerServing - minCost) / (maxCost - minCost),
      );
      blendedScore =
        qualityWeight * candidate.coverageScore + (1 - qualityWeight) * priceScore;
    }

    const finalScore = Math.max(0, Math.min(1, blendedScore));
    if (finalScore < MIN_SCORE_THRESHOLD) return null;

    return {
      products: candidate.productGroup,
      score: finalScore,
      matchedNutrientNodeIds: candidate.matchedNutrientNodeIds,
      missedNutrientNodeIds: candidate.missedNutrientNodeIds,
      extraIngredientNames: candidate.extraIngredientNames,
      scoreBreakdown: candidate.breakdown,
    };
  };

  for (const c of [...singles, ...bundles]) {
    const ranked = applyBlend(c);
    if (ranked) all.push(ranked);
  }

  all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.matchedNutrientNodeIds.length - a.matchedNutrientNodeIds.length;
  });

  return all;
}
