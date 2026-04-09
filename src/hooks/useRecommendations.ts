import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { groupRpcRowsIntoFiredRules, consolidateRules } from "@/lib/engine/consolidateRules";
import { scoreProducts } from "@/lib/engine/scoreProducts";
import { useProductCatalog } from "./useProductCatalog";
import type { MemberProfile, RankedProduct, ConsolidatedRules } from "@/types/engine";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes — rules change rarely

export interface RecommendationResult {
  rankedProducts: RankedProduct[];
  consolidatedRules: ConsolidatedRules;
}

/**
 * Orchestrates the full recommendation pipeline for a given member profile.
 *
 * Steps:
 *  1. Call get_rules_for_goals RPC → FiredRule[]
 *  2. consolidateRules → ConsolidatedRules
 *  3. scoreProducts (from cached catalog) → RankedProduct[]
 *  4. Fire-and-forget audit insert into member_recommendations
 *
 * Disabled when goalIds is empty.
 */
export function useRecommendations(profile: MemberProfile) {
  const { goalIds } = profile;
  const { data: catalog } = useProductCatalog();

  return useQuery({
    queryKey: ["recommendations", [...goalIds].sort().join(",")],
    staleTime: STALE_TIME,
    enabled: goalIds.length > 0 && catalog != null,
    queryFn: async (): Promise<RecommendationResult> => {
      // 1. Fetch matching rules via RPC
      const { data: rpcRows, error } = await supabase.rpc("get_rules_for_goals", {
        p_goal_ids: goalIds,
      });

      if (error) throw new Error(error.message);

      const firedRules = groupRpcRowsIntoFiredRules(rpcRows ?? []);

      // 2. Consolidate
      const consolidated = consolidateRules(firedRules);

      // 3. Expand each required nutrient to its full descendant set so that
      //    e.g. VITAMIN_D3 (child) satisfies a VITAMIN_D (parent) requirement.
      const nutrientNodeIds = consolidated.requirements.map((r) => r.nutrientNodeId);
      let nutrientDescendants: Map<string, Set<string>> | undefined;
      if (nutrientNodeIds.length > 0) {
        const { data: descRows } = await supabase.rpc("get_nutrient_descendants", {
          p_node_ids: nutrientNodeIds,
        });
        if (descRows) {
          nutrientDescendants = new Map();
          for (const row of descRows as { ancestor_id: string; descendant_id: string }[]) {
            const set = nutrientDescendants.get(row.ancestor_id) ?? new Set<string>();
            set.add(row.descendant_id);
            nutrientDescendants.set(row.ancestor_id, set);
          }
        }
      }

      // 4. Score products (catalog is guaranteed non-null because of `enabled` guard)
      const rankedProducts = scoreProducts(catalog!, consolidated, nutrientDescendants);

      // 4. Persist audit trail (fire-and-forget — do not await)
      persistAudit(goalIds, consolidated, rankedProducts).catch((e) =>
        console.warn("[useRecommendations] audit insert failed:", e)
      );

      return { rankedProducts, consolidatedRules: consolidated };
    },
  });
}

async function persistAudit(
  goalIds: string[],
  consolidated: ConsolidatedRules,
  ranked: RankedProduct[]
) {
  const rankedIds = ranked.map((r) => r.product.id);
  const breakdown: Record<string, unknown> = {};
  for (const r of ranked) {
    breakdown[String(r.product.id)] = {
      score: r.score,
      matched: r.matchedNutrientNodeIds,
      missed: r.missedNutrientNodeIds,
    };
  }

  await supabase.from("member_recommendations").insert({
    goal_ids: goalIds,
    fired_rule_ids: consolidated.firedRuleIds,
    nutrient_requirements: consolidated.requirements as unknown as Record<string, unknown>[],
    ranked_product_ids: rankedIds,
    score_breakdown: breakdown,
    engine_version: "1.0",
  });
}
