import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const FOOD_RESTRICTIONS_ROOT_ID = "65181588-1165-4492-969d-55f2475db705";

export interface FoodRestrictionNode {
  id: string;
  nodeName: string;
  displayName: string;
}

/**
 * Fetches all leaf nodes under the FOOD_RESTRICTIONS ontology node.
 * Currently: Gluten Free, Lactose Free, Nut Free, Shellfish Free,
 *            Soy Free, Sugar Free, Vegan, Vegetarian.
 */
export function useFoodRestrictionNodes() {
  return useQuery<FoodRestrictionNode[]>({
    queryKey: ["foodRestrictionNodes"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<FoodRestrictionNode[]> => {
      const { data: pairs, error: e1 } = await supabase.rpc("get_nutrient_descendants", {
        p_node_ids: [FOOD_RESTRICTIONS_ROOT_ID],
      });
      if (e1) throw new Error(e1.message);

      const descendantIds = [
        ...new Set(
          (pairs ?? [])
            .map((r: { descendant_id: string }) => r.descendant_id)
            .filter((id: string) => id !== FOOD_RESTRICTIONS_ROOT_ID),
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
