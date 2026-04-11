import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface MedicationNode {
  id: string;
  displayName: string;
  /** Display name of the parent category, e.g. "Diabetes Medications" */
  categoryName: string | null;
}

const MEDICATIONS_ROOT_ID = "cbeab053-5abd-4f04-9e76-151986c35099";

/**
 * Fetches all leaf nodes under the MEDICATIONS ontology node.
 * Leaf = a node that has no children of its own.
 * Results are cached for 30 minutes (medication ontology changes rarely).
 */
export function useMedicationNodes() {
  return useQuery({
    queryKey: ["medicationNodes"],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<MedicationNode[]> => {
      // 1. Get all descendants of MEDICATIONS via the existing RPC
      const { data: pairs, error: e1 } = await supabase.rpc("get_nutrient_descendants", {
        p_node_ids: [MEDICATIONS_ROOT_ID],
      });
      if (e1) throw new Error(e1.message);

      // 2. Collect unique descendant IDs (exclude the root itself)
      const descendantIds = [
        ...new Set(
          (pairs ?? [])
            .map((r: { descendant_id: string }) => r.descendant_id)
            .filter((id: string) => id !== MEDICATIONS_ROOT_ID),
        ),
      ] as string[];

      if (descendantIds.length === 0) return [];

      // 3. Fetch full node data for all descendants
      const { data: nodes, error: e2 } = await supabase
        .from("ontology")
        .select("id, display_name, parent_id")
        .in("id", descendantIds);
      if (e2) throw new Error(e2.message);

      // 4. Build a set of IDs that appear as parent_id (i.e. are not leaves)
      const hasChildrenSet = new Set(
        (nodes ?? []).map((n) => n.parent_id).filter(Boolean),
      );

      // 5. Build a display-name lookup for category labelling
      const displayMap = new Map((nodes ?? []).map((n) => [n.id, n.display_name as string]));

      // 6. Filter to leaves, attach category name, sort alphabetically
      return (nodes ?? [])
        .filter((n) => !hasChildrenSet.has(n.id))
        .map((n) => ({
          id: n.id,
          displayName: n.display_name ?? n.id,
          categoryName: n.parent_id ? (displayMap.get(n.parent_id) ?? null) : null,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
  });
}
