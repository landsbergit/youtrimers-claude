import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// UUID of the RELIGION_PERMISSIONS node (child of TAGS root, seeded in 004_ontology_seed.sql)
const RELIGION_PERMISSIONS_ROOT_ID = "b0e7cbf3-e0ab-4657-9676-40240692e5c2";

export interface ReligiousPreferenceNode {
  id: string;
  nodeName: string;    // e.g. "KOSHER" — matches product normalizedTags
  displayName: string; // e.g. "Kosher"
}

/**
 * Fetches all leaf nodes under the RELIGION_PERMISSIONS ontology node.
 * Currently: KOSHER, HALAL.
 * Used to populate checkboxes in PreferencesSection.
 */
export function useReligiousPreferenceNodes() {
  return useQuery<ReligiousPreferenceNode[]>({
    queryKey: ["religiousPreferenceNodes"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<ReligiousPreferenceNode[]> => {
      const { data: pairs, error: e1 } = await supabase.rpc("get_nutrient_descendants", {
        p_node_ids: [RELIGION_PERMISSIONS_ROOT_ID],
      });
      if (e1) throw new Error(e1.message);

      const descendantIds = [
        ...new Set(
          (pairs ?? [])
            .map((r: { descendant_id: string }) => r.descendant_id)
            .filter((id: string) => id !== RELIGION_PERMISSIONS_ROOT_ID),
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
