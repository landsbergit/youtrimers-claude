import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const HEALTH_CONDITIONS_ROOT    = "49cc7029-6ac3-49e4-bbfc-5812752e8b5b";
const CONDITIONS_BY_ORGANS_ID   = "b20ff344-4f7f-4ad7-92bd-e38b2d18a2b9";
const CONDITIONS_BY_SYSTEMS_ID  = "71f38e38-b49d-4013-8729-3ad4213df927";
const GLANDS_ID                 = "094ebfd8-6183-471e-b921-04a9e5643ff1"; // 0 children — hidden

export interface ConditionLeaf {
  id: string;
  nodeName: string;
  displayName: string;
}

export interface ConditionGroup {
  id: string;
  nodeName: string;
  displayName: string;
  conditions: ConditionLeaf[];
  branch: "organs" | "systems";
}

export interface HealthConditionTree {
  groups: ConditionGroup[];
  /** Flat deduplicated list of all selectable conditions — used for search. */
  allLeaves: ConditionLeaf[];
}

export function useHealthConditionNodes() {
  return useQuery<HealthConditionTree>({
    queryKey: ["healthConditionNodes"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<HealthConditionTree> => {
      // 1. All descendants of HEALTH_CONDITIONS root
      const { data: pairs, error: e1 } = await supabase.rpc("get_nutrient_descendants", {
        p_node_ids: [HEALTH_CONDITIONS_ROOT],
      });
      if (e1) throw new Error(e1.message);

      const descendantIds = [
        ...new Set(
          (pairs ?? [])
            .map((r: { descendant_id: string }) => r.descendant_id)
            .filter((id: string) => id !== HEALTH_CONDITIONS_ROOT),
        ),
      ] as string[];

      if (descendantIds.length === 0) return { groups: [], allLeaves: [] };

      // 2. Full node data
      const { data: nodes, error: e2 } = await supabase
        .from("ontology")
        .select("id, node_name, display_name, parent_id")
        .in("id", descendantIds);
      if (e2) throw new Error(e2.message);

      const allNodes = nodes ?? [];
      const nodeById = new Map(allNodes.map((n) => [n.id, n]));

      // 3. Parent → children map
      const childrenOf = new Map<string, string[]>();
      for (const n of allNodes) {
        if (n.parent_id) {
          const arr = childrenOf.get(n.parent_id) ?? [];
          arr.push(n.id);
          childrenOf.set(n.parent_id, arr);
        }
      }

      // 4. Recursively collect leaf condition nodes
      function collectLeaves(nodeId: string): ConditionLeaf[] {
        const children = childrenOf.get(nodeId) ?? [];
        if (children.length === 0) {
          const n = nodeById.get(nodeId);
          if (!n) return [];
          return [{
            id: n.id,
            nodeName: n.node_name ?? n.id,
            displayName: (n.display_name ?? n.node_name ?? n.id)
              .replace(/\b\w/g, (c: string) => c.toUpperCase()),
          }];
        }
        return children.flatMap(collectLeaves)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
      }

      // 5. Build organ groups (skip GLANDS and any group with 0 conditions)
      const organNodeIds = (childrenOf.get(CONDITIONS_BY_ORGANS_ID) ?? [])
        .filter((id) => id !== GLANDS_ID);

      const organGroups: ConditionGroup[] = organNodeIds
        .map((id) => {
          const n = nodeById.get(id);
          if (!n) return null;
          const conditions = collectLeaves(id);
          if (conditions.length === 0) return null;
          return {
            id,
            nodeName: n.node_name ?? id,
            displayName: (n.display_name ?? n.node_name ?? id)
              .replace(/\b\w/g, (c: string) => c.toUpperCase()),
            conditions,
            branch: "organs" as const,
          };
        })
        .filter(Boolean) as ConditionGroup[];

      // 6. Build system groups
      const systemNodeIds = childrenOf.get(CONDITIONS_BY_SYSTEMS_ID) ?? [];

      const systemGroups: ConditionGroup[] = systemNodeIds
        .map((id) => {
          const n = nodeById.get(id);
          if (!n) return null;
          const conditions = collectLeaves(id);
          if (conditions.length === 0) return null;
          // Shorten "X System" → "X" for display
          const rawName = (n.display_name ?? n.node_name ?? id);
          const displayName = rawName
            .replace(/\s+System$/i, "")
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          return {
            id,
            nodeName: n.node_name ?? id,
            displayName,
            conditions,
            branch: "systems" as const,
          };
        })
        .filter(Boolean) as ConditionGroup[];

      const groups = [...organGroups, ...systemGroups];

      // 7. Flat deduplicated leaf list for search
      const seenIds = new Set<string>();
      const allLeaves: ConditionLeaf[] = [];
      for (const g of groups) {
        for (const c of g.conditions) {
          if (!seenIds.has(c.id)) {
            seenIds.add(c.id);
            allLeaves.push(c);
          }
        }
      }
      allLeaves.sort((a, b) => a.displayName.localeCompare(b.displayName));

      return { groups, allLeaves };
    },
  });
}
