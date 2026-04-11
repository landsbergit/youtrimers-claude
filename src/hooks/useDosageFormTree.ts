import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const DOSAGE_FORM_ROOT_ID = "a870f46e-4e2b-483a-8ce4-a6dc34851c6f";

export interface DosageFormLeaf {
  id: string;
  /** Matches products.normalized_dosage_form, e.g. "CAPSULE" */
  nodeName: string;
  displayName: string;
}

export interface DosageFormCategory {
  id: string;
  displayName: string;
  parentId: string;
  /**
   * All leaf descendants (recursive). When the category is itself a leaf
   * (no children in the ontology), this array contains one entry with the
   * category's own data and selfLeaf is also set.
   */
  leaves: DosageFormLeaf[];
  /**
   * Set when the category node is itself a leaf (no Level-3+ children).
   * Signals the UI to render a direct checkbox instead of a category header.
   */
  selfLeaf?: DosageFormLeaf;
}

export interface DosageFormGroup {
  id: string;
  displayName: string;
  categories: DosageFormCategory[];
  /** Set when the Level-1 node is itself a leaf (e.g. Packets). */
  selfLeaf?: DosageFormLeaf;
}

export interface DosageFormTree {
  groups: DosageFormGroup[];
  allLeaves: DosageFormLeaf[];
}

// ── Age-bracket default leaf node_names ───────────────────────────────────────

const AGE_BRACKET_PATTERNS: { maxAgeMonths: number; patterns: string[] }[] = [
  { maxAgeMonths: 12,  patterns: ["LIQUID", "SPRAY", "TEA_BAG"] },
  { maxAgeMonths: 48,  patterns: ["WAFER", "LOZENGE", "GUMMY", "NUGGETS", "PELLET", "STRIP", "BAR", "POWDER", "CHEWABLE"] },
  { maxAgeMonths: 156, patterns: ["WAFER", "LOZENGE", "GUMMY", "NUGGETS", "PELLET", "STRIP", "BAR", "POWDER", "CHEWABLE", "SOFTGEL"] },
];
const DEFAULT_PATTERNS = ["CAPLET", "CAPSULE", "SOFTGEL"];

/**
 * Returns the leaf node_names that should be selected by default for a member
 * of the given age (in months). Matches against ontology node_names using
 * substring inclusion so partial matches still qualify.
 */
export function getDefaultDosageFormNames(
  ageMonths: number,
  allLeaves: DosageFormLeaf[],
): string[] {
  const bracket = AGE_BRACKET_PATTERNS.find((b) => ageMonths < b.maxAgeMonths);
  const patterns = bracket?.patterns ?? DEFAULT_PATTERNS;
  return allLeaves
    .filter((l) => patterns.some((p) => l.nodeName.toUpperCase().includes(p)))
    .map((l) => l.nodeName);
}

/** Computes the member's age in months from birth year and month (1-indexed). */
export function computeAgeInMonths(birthYear: number, birthMonth: number): number {
  const now = new Date();
  return (now.getFullYear() - birthYear) * 12 + (now.getMonth() + 1 - birthMonth);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches and structures the dosage form ontology subtree.
 *
 * Tree shape:
 *   Level-1 = groups   (Non Solid Oral, Solid Oral, Packets …)
 *   Level-2 = categories (Liquid Group, Mouth-Held, Capsules, Softgel …)
 *   Level-3+ = leaves  (Capsule, Softgel, Lozenge, ml, Spray …)
 *
 * Some Level-2 nodes are themselves leaves (CAPSULE, SOFTGEL). These are
 * detected and surfaced via DosageFormCategory.selfLeaf so the UI can render
 * them as plain checkboxes rather than category headers with child lists.
 *
 * Leaf collection is done recursively so deeper subtrees (e.g. Other Liquid
 * Types → Spray / Tea Bag) are handled correctly.
 */
export function useDosageFormTree() {
  return useQuery<DosageFormTree>({
    queryKey: ["dosageFormTree"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<DosageFormTree> => {
      // 1. All descendants of the root (including root itself)
      const { data: pairs, error: e1 } = await supabase.rpc("get_nutrient_descendants", {
        p_node_ids: [DOSAGE_FORM_ROOT_ID],
      });
      if (e1) throw new Error(e1.message);

      const descendantIds = [
        ...new Set(
          (pairs ?? [])
            .map((r: { descendant_id: string }) => r.descendant_id)
            .filter((id: string) => id !== DOSAGE_FORM_ROOT_ID),
        ),
      ] as string[];

      if (descendantIds.length === 0) return { groups: [], allLeaves: [] };

      // 2. Full node data for every descendant
      const { data: nodes, error: e2 } = await supabase
        .from("ontology")
        .select("id, node_name, display_name, parent_id")
        .in("id", descendantIds);
      if (e2) throw new Error(e2.message);

      const allNodes = nodes ?? [];

      // 3. Build helpers
      const nodeById = new Map(allNodes.map((n) => [n.id, n]));

      // children map: parent_id → child ids
      const childrenOf = new Map<string, string[]>();
      for (const n of allNodes) {
        if (n.parent_id) {
          const arr = childrenOf.get(n.parent_id) ?? [];
          arr.push(n.id);
          childrenOf.set(n.parent_id, arr);
        }
      }

      // Recursively collect all leaf descendants of a node.
      // A leaf = a node that has no children in the current subtree.
      function collectLeaves(nodeId: string): DosageFormLeaf[] {
        const children = childrenOf.get(nodeId) ?? [];
        if (children.length === 0) {
          const n = nodeById.get(nodeId);
          if (!n) return [];
          return [{
            id: n.id,
            nodeName: n.node_name ?? n.id,
            displayName: n.display_name ?? n.node_name ?? n.id,
          }];
        }
        return children
          .flatMap(collectLeaves)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
      }

      // 4. Level-1 nodes = direct children of root
      const level1 = (childrenOf.get(DOSAGE_FORM_ROOT_ID) ?? [])
        .map((id) => nodeById.get(id)!)
        .filter(Boolean)
        .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));

      // 5. Build groups
      const groups: DosageFormGroup[] = level1.map((g) => {
        const groupChildren = childrenOf.get(g.id) ?? [];
        const isGroupLeaf = groupChildren.length === 0;

        if (isGroupLeaf) {
          const selfLeaf: DosageFormLeaf = {
            id: g.id,
            nodeName: g.node_name ?? g.id,
            displayName: g.display_name ?? g.node_name ?? g.id,
          };
          return { id: g.id, displayName: g.display_name ?? g.node_name ?? g.id, selfLeaf, categories: [] };
        }

        // Level-2 categories
        const categories: DosageFormCategory[] = groupChildren
          .map((cid) => nodeById.get(cid)!)
          .filter(Boolean)
          .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""))
          .map((c) => {
            const leaves = collectLeaves(c.id);
            const isCatLeaf = (childrenOf.get(c.id) ?? []).length === 0;
            const selfLeaf: DosageFormLeaf | undefined = isCatLeaf
              ? { id: c.id, nodeName: c.node_name ?? c.id, displayName: c.display_name ?? c.node_name ?? c.id }
              : undefined;
            return {
              id: c.id,
              displayName: c.display_name ?? c.node_name ?? c.id,
              parentId: c.parent_id!,
              leaves,
              selfLeaf,
            };
          });

        return {
          id: g.id,
          displayName: g.display_name ?? g.node_name ?? g.id,
          categories,
        };
      });

      // 6. Deduplicated flat list of all leaves
      const seenIds = new Set<string>();
      const allLeaves: DosageFormLeaf[] = [];
      for (const g of groups) {
        const candidates = g.selfLeaf
          ? [g.selfLeaf]
          : g.categories.flatMap((c) => c.leaves);
        for (const l of candidates) {
          if (!seenIds.has(l.id)) {
            seenIds.add(l.id);
            allLeaves.push(l);
          }
        }
      }

      return { groups, allLeaves };
    },
  });
}
