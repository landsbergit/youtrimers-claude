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
/** Base preference boost per matching tag. Scaled down by qualityWeight. */
const PREFERENCE_BOOST = 0.15;
/** Boost for products carrying a "Free" tag matching a user restriction. */
const RESTRICTION_FREE_BOOST = 0.12;
/** Boost for products explicitly tagged for the member's gender. Disabled at quality-first. */
const GENDER_BOOST = 0.10;

export function scoreProducts(
  products: ProductWithIngredients[],
  consolidatedRules: ConsolidatedRules,
  nutrientDescendants?: Map<string, Set<string>>,
  qualityWeight = 0.5,
  maxBundleSize = 2,
  foodPreferences: string[] = [],
  foodRestrictions: string[] = [],
  gender: string | null = null,
  religiousPreferences: string[] = [],
): RankedProduct[] {
  const required = consolidatedRules.requirements.filter((r) => r.isRequired);
  const avoided = consolidatedRules.requirements.filter((r) => !r.isRequired);
  const hasRequirements = required.length > 0;

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
    if (!hasRequirements) {
      // No goals — 100% base score for all products
      singles.push({
        productGroup: [product],
        coverageScore: 1.0,
        matchedNutrientNodeIds: [],
        missedNutrientNodeIds: [],
        extraIngredientNames: [],
        breakdown: {},
        hardAvoidViolated: false,
      });
      continue;
    }

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

  // ── 2. Generate bundle candidates (only when goals provide requirements) ───

  const bundles: Candidate[] = [];

  if (hasRequirements && maxBundleSize >= 2) {
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

  // Pre-compute preference, restriction, and religious sets for fast lookup
  const prefSet = new Set(foodPreferences);
  const restrictionSet = new Set(foodRestrictions);
  const religiousSet = new Set(religiousPreferences);

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

    // ── Food preference boost ────────────────────────────────────────────────
    // Boost scales inversely with qualityWeight: at quality=0.1 → ~14%, quality=0.9 → ~7%
    // For bundles: full boost if ALL products match, 50% if only some match.
    const matchedPreferenceTags: string[] = [];
    if (prefSet.size > 0) {
      const perProductMatches = candidate.productGroup.map((p) => {
        const tags = new Set(p.normalizedTags ?? []);
        return [...prefSet].filter((pref) => tags.has(pref));
      });

      // Collect unique matched tags across all products in the bundle
      const allMatched = new Set<string>();
      for (const matches of perProductMatches) {
        for (const tag of matches) allMatched.add(tag);
      }
      for (const tag of allMatched) matchedPreferenceTags.push(tag);

      if (allMatched.size > 0) {
        const boostPerTag = PREFERENCE_BOOST * (1 - qualityWeight * 0.5);
        // Bundle ratio: 1.0 if all products match at least one pref tag, 0.5 if partial
        const productsWithMatch = perProductMatches.filter((m) => m.length > 0).length;
        const bundleRatio = productsWithMatch === candidate.productGroup.length ? 1.0 : 0.5;
        const totalBoost = boostPerTag * allMatched.size * bundleRatio;
        blendedScore *= 1 + totalBoost;
      }
    }

    // ── Food restriction "Free" tag boost ──────────────────────────────────
    // Products explicitly tagged "X_FREE" matching a selected restriction get a boost.
    const matchedRestrictionFreeTags: string[] = [];
    if (restrictionSet.size > 0) {
      const allTags = new Set<string>();
      for (const p of candidate.productGroup) {
        for (const tag of p.normalizedTags ?? []) allTags.add(tag);
      }
      for (const restriction of restrictionSet) {
        if (allTags.has(restriction)) {
          matchedRestrictionFreeTags.push(restriction);
        }
      }
      if (matchedRestrictionFreeTags.length > 0) {
        blendedScore *= 1 + RESTRICTION_FREE_BOOST * matchedRestrictionFreeTags.length;
      }
    }

    // ── Gender boost ──────────────────────────────────────────────────────
    // Boost products explicitly tagged for the member's gender.
    // Disabled when qualityWeight >= 0.9 (quality-first ignores gender label boost).
    if (gender && qualityWeight < 0.9) {
      const genderTag = gender === "FEMALE" ? "FEMALE" : gender === "MALE" ? "MALE" : null;
      if (genderTag) {
        const allTags = new Set<string>();
        for (const p of candidate.productGroup) {
          for (const tag of p.normalizedTags ?? []) allTags.add(tag);
        }
        if (allTags.has(genderTag)) {
          blendedScore *= 1 + GENDER_BOOST;
        }
      }
    }

    // ── Religious tag matching ─────────────────────────────────────────────
    const matchedReligiousTags: string[] = [];
    if (religiousSet.size > 0) {
      const allTags = new Set<string>();
      for (const p of candidate.productGroup) {
        for (const tag of p.normalizedTags ?? []) allTags.add(tag);
      }
      for (const rel of religiousSet) {
        if (allTags.has(rel)) matchedReligiousTags.push(rel);
      }
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
      matchedPreferenceTags,
      matchedRestrictionFreeTags,
      matchedReligiousTags,
    };
  };

  for (const c of [...singles, ...bundles]) {
    const ranked = applyBlend(c);
    if (ranked) all.push(ranked);
  }

  // Two-tier sort when food preferences are active:
  // Tier 1: products matching ANY preference tag (sorted by score)
  // Tier 2: products without preference tags (sorted by score)
  // At high qualityWeight the tier separation is softened via the score boost.
  all.sort((a, b) => {
    if (prefSet.size > 0) {
      const aHasPref = a.matchedPreferenceTags.length > 0 ? 1 : 0;
      const bHasPref = b.matchedPreferenceTags.length > 0 ? 1 : 0;
      if (aHasPref !== bHasPref) return bHasPref - aHasPref;
    }
    if (b.score !== a.score) return b.score - a.score;
    return b.matchedNutrientNodeIds.length - a.matchedNutrientNodeIds.length;
  });

  // Cap results to avoid sending thousands of products to the UI
  return all.slice(0, 200);
}
