import type { RankedProduct } from "@/types/engine";

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
 * MMR (Maximal Marginal Relevance) re-ranking.
 *
 * At each step, pick the candidate that maximises:
 *   λ × relevance  −  (1 − λ) × maxSimilarityToSelected
 *
 * λ = diversityWeight:
 *   1.0 = pure relevance order (no diversity)
 *   0.0 = pure diversity (greedy farthest-first)
 *   0.5 = balanced (default)
 *
 * @param items        Already-sorted candidates (best score first)
 * @param lambda       0–1; higher = closer to original ranking
 * @param topN         How many items to return (re-ranks the whole list by default)
 */
export function diversifyResults(
  items: RankedProduct[],
  lambda: number,
  topN: number = items.length,
): RankedProduct[] {
  // λ = 1 means identity — skip computation
  if (lambda >= 0.99 || items.length <= 1) return items.slice(0, topN);

  const selected: RankedProduct[] = [];
  const candidates = [...items];

  while (selected.length < topN && candidates.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const relevance = candidates[i].score;

      const maxSim =
        selected.length === 0
          ? 0
          : Math.max(...selected.map((s) => similarity(s, candidates[i])));

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(candidates[bestIdx]);
    candidates.splice(bestIdx, 1);
  }

  return selected;
}
