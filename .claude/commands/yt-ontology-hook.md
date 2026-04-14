You are about to create a new ontology-backed React hook following the established
Youtrimers pattern. The user will describe what ontology subtree they want to expose.

**Standard pattern** (do NOT deviate — this keeps all hooks consistent):

```typescript
// 1. Call get_nutrient_descendants RPC with the root UUID
const { data: pairs } = await supabase.rpc("get_nutrient_descendants", {
  p_node_ids: [ROOT_UUID],
});

// 2. Collect all descendant IDs (exclude the root itself)
const descendantIds = [...new Set(
  (pairs ?? []).map(r => r.descendant_id).filter(id => id !== ROOT_UUID)
)];

// 3. Fetch full node data
const { data: nodes } = await supabase
  .from("ontology")
  .select("id, node_name, display_name, parent_id")
  .in("id", descendantIds);

// 4. Build parent → children map
const childrenOf = new Map<string, string[]>();
for (const n of nodes ?? []) {
  if (n.parent_id) {
    const arr = childrenOf.get(n.parent_id) ?? [];
    arr.push(n.id);
    childrenOf.set(n.parent_id, arr);
  }
}

// 5. Collect leaves recursively (leaf = no children in subtree)
function collectLeaves(nodeId: string): LeafType[] {
  const children = childrenOf.get(nodeId) ?? [];
  if (children.length === 0) {
    const n = nodeById.get(nodeId);
    if (!n) return [];
    return [{ id: n.id, nodeName: n.node_name ?? n.id, displayName: n.display_name ?? n.id }];
  }
  return children.flatMap(collectLeaves)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
```

**Checklist before writing the hook:**
1. What is the root node UUID? (check CLAUDE.md or query ontology table)
2. Should the hook return a flat list of leaves, a grouped tree, or both?
3. Should display names be title-cased? (use `.replace(/\b\w/g, c => c.toUpperCase())`)
4. Are there any nodes to skip? (e.g. GLANDS has 0 children — filter with `id !== SKIP_ID`)
5. What is the staleTime? (default 60 * 60 * 1000 = 1 hour for ontology data)
6. What is the queryKey? (use a short stable string, e.g. `["foodRestrictionNodes"]`)

**File location:** `src/hooks/use<Name>Nodes.ts`
**useQuery wrapper:** wrap the entire fetch in `useQuery<ReturnType>({ queryKey, staleTime, queryFn })`
**Export both** the hook and the leaf/group interface types so components can import them.

Now ask the user: what ontology subtree do you want to expose, and should it return
a flat list, a grouped structure, or both? Then implement it following the pattern above.
