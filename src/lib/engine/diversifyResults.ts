import type { RankedProduct } from "@/types/engine";

/**
 * Score tier threshold: products within this score difference are considered
 * "similar enough" that diversity re-ranking can reorder them.
 * A product at 85% will never be moved below a product at 79% (diff > 0.05).
 */
const TIER_THRESHOLD = 0.05;

/**
 * Similarity between two ranked results.
 *
 * Weights (sum = 1.0):
 *   0.60 — shared products (exact product overlap)
 *   0.25 — shared brand (any product in a shares brand with any in b)
 *   0.15 — nutrient Jaccard (overlap of matched nutrient node IDs)
 */
function similarity(a: RankedProduct, b: RankedProduct): number {
  // Shared-products component (Jaccard on product ID sets)
  const aIds = new Set(a.products.map((p) => p.id));
  const bIds = new Set(b.products.map((p) => p.id));
  const idIntersection = [...aIds].filter((id) => bIds.has(id)).length;
  const idUnion = new Set([...aIds, ...bIds]).size;
  const productSim = idUnion > 0 ? idIntersection / idUnion : 0;

  // Shared-brand component (any product in a shares a non-null brand with any in b)
  const aBrands = new Set(a.products.map((p) => p.brand).filter(Boolean) as string[]);
  const bBrands = new Set(b.products.map((p) => p.brand).filter(Boolean) as string[]);
  const brandOverlap = [...aBrands].some((br) => bBrands.has(br)) ? 1 : 0;

  // Nutrient Jaccard
  const aNuts = new Set(a.matchedNutrientNodeIds);
  const bNuts = new Set(b.matchedNutrientNodeIds);
  const nutIntersection = [...aNuts].filter((n) => bNuts.has(n)).length;
  const nutUnion = new Set([...aNuts, ...bNuts]).size;
  const nutSim = nutUnion > 0 ? nutIntersection / nutUnion : 0;

  return 0.6 * productSim + 0.25 * brandOverlap + 0.15 * nutSim;
}

/**
 * Tiered MMR (Maximal Marginal Relevance) re-ranking.
 *
 * Groups products into score tiers (within TIER_THRESHOLD of each other),
 * then applies MMR diversity re-ranking WITHIN each tier. Products never
 * move across tiers — a higher-scored product always appears before a
 * lower-scored one if their score difference exceeds the threshold.
 *
 * @param items   Already-sorted candidates (best score first)
 * @param lambda  0–1; higher = closer to original ranking within each tier
 * @param topN    How many items to return
 */
export function diversifyResults(
  items: RankedProduct[],
  lambda: number,
  topN: number = items.length,
): RankedProduct[] {
  if (lambda >= 0.99 || items.length <= 1) return items.slice(0, topN);

  // Group into score tiers
  const tiers: RankedProduct[][] = [];
  let currentTier: RankedProduct[] = [];
  let tierTopScore = -Infinity;

  for (const item of items) {
    if (currentTier.length === 0) {
      tierTopScore = item.score;
      currentTier.push(item);
    } else if (tierTopScore - item.score <= TIER_THRESHOLD) {
      currentTier.push(item);
    } else {
      tiers.push(currentTier);
      currentTier = [item];
      tierTopScore = item.score;
    }
  }
  if (currentTier.length > 0) tiers.push(currentTier);

  // Apply MMR within each tier, accumulating selected items across tiers
  // so inter-tier diversity is also considered
  const allSelected: RankedProduct[] = [];

  for (const tier of tiers) {
    if (allSelected.length >= topN) break;

    if (tier.length <= 1) {
      allSelected.push(...tier);
      continue;
    }

    // MMR within this tier
    const candidates = [...tier];
    const tierSelected: RankedProduct[] = [];

    while (tierSelected.length < candidates.length && allSelected.length + tierSelected.length < topN) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < candidates.length; i++) {
        if (tierSelected.includes(candidates[i])) continue;

        const relevance = candidates[i].score;
        const allPrev = [...allSelected, ...tierSelected];
        const maxSim = allPrev.length === 0
          ? 0
          : Math.max(...allPrev.map((s) => similarity(s, candidates[i])));

        const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      tierSelected.push(candidates[bestIdx]);
      candidates.splice(bestIdx, 1);
    }

    allSelected.push(...tierSelected);
  }

  return allSelected.slice(0, topN);
}
