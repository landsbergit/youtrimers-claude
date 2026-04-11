import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { groupRpcRowsIntoFiredRules, consolidateRules } from "@/lib/engine/consolidateRules";
import { scoreProducts } from "@/lib/engine/scoreProducts";
import { applyDemographicFilter } from "@/lib/engine/applyDemographicFilter";
import { useProductCatalog } from "./useProductCatalog";
import type { MemberProfile, RankedProduct, ConsolidatedRules } from "@/types/engine";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes — rules change rarely

export interface RecommendationResult {
  rankedProducts: RankedProduct[];
  consolidatedRules: ConsolidatedRules;
  /** True when the dosage form filter produced zero results and was bypassed. */
  dosageFormFallback: boolean;
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
    queryKey: [
      "recommendations",
      [...goalIds].sort().join(","),
      profile.qualityWeight,
      profile.maxBundleSize,
      [...profile.acceptedDosageFormNames].sort().join(","),
      profile.gender ?? "",
      profile.reproductiveStatus ?? "",
      profile.birthYear ?? "",
      profile.birthMonth ?? "",
    ],
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

      // 4. Apply demographic hard-exclusion filter
      //    Runs before dosage-form filter so the form fallback logic operates
      //    on the already-demographically-filtered set.
      const demographicCatalog = applyDemographicFilter(
        catalog!,
        profile.gender,
        profile.reproductiveStatus,
        profile.birthYear,
        profile.birthMonth,
      );

      // 5. Apply dosage form pre-filter when preferences have been set
      let scoringCatalog = demographicCatalog;
      let dosageFormFallback = false;

      if (profile.acceptedDosageFormNames.length > 0) {
        const acceptedSet = new Set(profile.acceptedDosageFormNames);
        const filtered = demographicCatalog.filter(
          (p) => p.normalizedDosageForm === null || acceptedSet.has(p.normalizedDosageForm),
        );
        if (filtered.length > 0) {
          scoringCatalog = filtered;
        } else {
          // All products with a known form are excluded — fall back to full catalog
          dosageFormFallback = true;
        }
      }

      // 5. Score products
      const rankedProducts = scoreProducts(
        scoringCatalog, consolidated, nutrientDescendants,
        profile.qualityWeight, profile.maxBundleSize,
      );

      // 6. Persist audit trail (fire-and-forget — do not await)
      persistAudit(goalIds, consolidated, rankedProducts).catch((e) =>
        console.warn("[useRecommendations] audit insert failed:", e)
      );

      return { rankedProducts, consolidatedRules: consolidated, dosageFormFallback };
    },
  });
}

async function persistAudit(
  goalIds: string[],
  consolidated: ConsolidatedRules,
  ranked: RankedProduct[]
) {
  // For audit purposes, flatten bundle product IDs into the ranked list
  const rankedIds = ranked.flatMap((r) => r.products.map((p) => p.id));
  const breakdown: Record<string, unknown> = {};
  for (const r of ranked) {
    const key = r.products.map((p) => p.id).join("+");
    breakdown[key] = {
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
