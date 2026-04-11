import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const FOOD_PREFERENCES_ROOT_ID = "c4b146b8-754d-4d70-84c2-e871ae843f0b";

export interface FoodPreferenceNode {
  id: string;
  nodeName: string;   // e.g. "ORGANIC" — matches ontology node_name
  displayName: string;
}

/**
 * Fetches all leaf nodes under the FOOD_PREFERENCES ontology node.
 * Currently: ORGANIC, NON_GMO, WHOLE_FOOD.
 */
export function useFoodPreferenceNodes() {
  return useQuery<FoodPreferenceNode[]>({
    queryKey: ["foodPreferenceNodes"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<FoodPreferenceNode[]> => {
      const { data: pairs, error: e1 } = await supabase.rpc("get_nutrient_descendants", {
        p_node_ids: [FOOD_PREFERENCES_ROOT_ID],
      });
      if (e1) throw new Error(e1.message);

      const descendantIds = [
        ...new Set(
          (pairs ?? [])
            .map((r: { descendant_id: string }) => r.descendant_id)
            .filter((id: string) => id !== FOOD_PREFERENCES_ROOT_ID),
        ),
      ] as string[];

      if (descendantIds.length === 0) return [];

      const { data: nodes, error: e2 } = await supabase
        .from("ontology")
        .select("id, node_name, display_name, parent_id")
        .in("id", descendantIds);
      if (e2) throw new Error(e2.message);

      const allNodes = nodes ?? [];
      const hasChildrenSet = new Set(allNodes.map((n) => n.parent_id).filter(Boolean));

      return allNodes
        .filter((n) => !hasChildrenSet.has(n.id))
        .map((n) => ({
          id: n.id,
          nodeName: n.node_name ?? n.id,
          displayName: n.display_name ?? n.node_name ?? n.id,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
  });
}
