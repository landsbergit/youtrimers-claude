import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const REPRODUCTIVE_STATUS_ROOT_ID = "3d01927d-0451-42c8-b773-3540a54994e1";

export interface ReproductiveStatusNode {
  id: string;
  nodeName: string;
  displayName: string;
}

/**
 * Fetches all leaf nodes under the REPRODUCTIVE_STATUS ontology node.
 * Currently: Breastfeeding, Postmenopausal, Pregnancy, Premenopausal.
 * Display names from the ontology are lowercase; the UI capitalises them.
 */
export function useReproductiveStatusNodes() {
  return useQuery<ReproductiveStatusNode[]>({
    queryKey: ["reproductiveStatusNodes"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<ReproductiveStatusNode[]> => {
      const { data: pairs, error: e1 } = await supabase.rpc("get_nutrient_descendants", {
        p_node_ids: [REPRODUCTIVE_STATUS_ROOT_ID],
      });
      if (e1) throw new Error(e1.message);

      const descendantIds = [
        ...new Set(
          (pairs ?? [])
            .map((r: { descendant_id: string }) => r.descendant_id)
            .filter((id: string) => id !== REPRODUCTIVE_STATUS_ROOT_ID),
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
          // Capitalise the first letter of each word
          displayName: (n.display_name ?? n.node_name ?? n.id)
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
  });
}
