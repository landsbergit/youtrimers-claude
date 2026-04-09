import type {
  ConsolidatedRules,
  ProductWithIngredients,
  RankedProduct,
} from "@/types/engine";
import { meetsThreshold } from "./unitNormalizer";

const MIN_SCORE_THRESHOLD = 0.1;
const TAG_BONUS = 0.05;
const TAG_PENALTY = 0.25;
const OVERDOSE_MULTIPLIER = 0.7;
const AVOID_NUTRIENT_MULTIPLIER = 0.5;

/**
 * Score every product against the consolidated rules and return a ranked list.
 *
 * Scoring is presence-based when dose data is absent (MVP default):
 *   score = Σ(weight_i × present_i) / Σ(weight_i)
 *
 * When amount_per_serving + amount_unit are both present for an ingredient,
 * dose-based satisfaction replaces the binary present/absent value automatically.
 *
 * @param nutrientDescendants  Map from required-nutrient UUID → Set of all
 *   acceptable descendant UUIDs (including itself). When provided, a product
 *   ingredient matches a requirement if its ontology node is ANY descendant of
 *   the required node (e.g. VITAMIN_D3 satisfies a VITAMIN_D requirement).
 */
export function scoreProducts(
  products: ProductWithIngredients[],
  consolidatedRules: ConsolidatedRules,
  nutrientDescendants?: Map<string, Set<string>>
): RankedProduct[] {
  const required = consolidatedRules.requirements.filter((r) => r.isRequired);
  const avoided = consolidatedRules.requirements.filter((r) => !r.isRequired);

  if (required.length === 0) return [];

  const totalWeight = required.reduce((sum, r) => sum + r.weight, 0);

  const scored: RankedProduct[] = [];

  for (const product of products) {
    // Build a lookup: ontologyNodeId → ingredient (for O(1) access)
    const ingredientByNodeId = new Map<string, typeof product.ingredients[0]>();
    for (const ing of product.ingredients) {
      if (ing.ontologyNodeId) {
        ingredientByNodeId.set(ing.ontologyNodeId, ing);
      }
    }

    const matchedNutrientNodeIds: string[] = [];
    const missedNutrientNodeIds: string[] = [];
    const breakdown: Record<string, number> = {};
    let weightedScore = 0;

    for (const req of required) {
      // Hierarchy-aware lookup: match the exact node OR any of its descendants
      const acceptableIds = nutrientDescendants?.get(req.nutrientNodeId)
        ?? new Set([req.nutrientNodeId]);
      let ingredient: typeof product.ingredients[0] | undefined;
      for (const nodeId of acceptableIds) {
        ingredient = ingredientByNodeId.get(nodeId);
        if (ingredient) break;
      }
      let satisfaction = 0;

      if (ingredient) {
        const hasDoseData =
          ingredient.amountPerServing != null && ingredient.amountUnit != null;

        if (!hasDoseData || req.preferredDose == null) {
          // Presence-based (MVP default)
          satisfaction = 1.0;
          matchedNutrientNodeIds.push(req.nutrientNodeId);
        } else {
          // Dose-based: check against preferred dose first, then min dose
          const amount = ingredient.amountPerServing!;
          const unit = ingredient.amountUnit!;

          if (req.preferredDose != null) {
            const ratio = meetsThreshold(amount, unit, req.preferredDose, req.unit ?? unit)
              ? 1.0
              : amount / (req.preferredDose * 1000); // rough ratio, same unit assumed
            satisfaction = Math.min(ratio, 1.0);
          } else if (req.minDose != null) {
            satisfaction = meetsThreshold(amount, unit, req.minDose, req.unit ?? unit)
              ? 1.0
              : 0.5; // partial credit if present but under min
          }

          // Overdose penalty
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

    // Avoid-nutrient penalties
    for (const avoid of avoided) {
      const avoidIds = nutrientDescendants?.get(avoid.nutrientNodeId)
        ?? new Set([avoid.nutrientNodeId]);
      const hasAvoided = [...avoidIds].some((id) => ingredientByNodeId.has(id));
      if (hasAvoided) {
        coverageScore *= AVOID_NUTRIENT_MULTIPLIER;
      }
    }

    // Tag bonuses / penalties
    // products.normalizedTags are node_names (text); we resolve against avoided/preferred
    // which are ontology UUIDs. For now we skip tag scoring until the product catalog
    // exposes tag ontology IDs. The mechanism is in place for when it's wired up.
    // TODO: resolve normalizedTags text → UUID for full tag scoring

    const finalScore = Math.max(0, Math.min(1, coverageScore));

    if (finalScore >= MIN_SCORE_THRESHOLD) {
      scored.push({
        product,
        score: finalScore,
        matchedNutrientNodeIds,
        missedNutrientNodeIds,
        scoreBreakdown: breakdown,
      });
    }
  }

  // Sort descending by score; ties broken by number of matched nutrients
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.matchedNutrientNodeIds.length - a.matchedNutrientNodeIds.length;
  });

  return scored;
}
