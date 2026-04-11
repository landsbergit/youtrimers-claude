import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ProductWithIngredients, ProductIngredient } from "@/types/engine";

const STALE_TIME = 10 * 60 * 1000; // 10 minutes — product catalog changes rarely
const PAGE_SIZE = 1000;

/**
 * Fetches the full active product catalog with ingredients linked to the ontology.
 * Only includes products whose ingredients have a resolved ontology_node_id —
 * these are the ones the rule engine can score.
 *
 * Results are React Query cached for 10 minutes.
 */
export function useProductCatalog() {
  return useQuery({
    queryKey: ["productCatalog"],
    staleTime: STALE_TIME,
    queryFn: async (): Promise<ProductWithIngredients[]> => {
      // Fetch all active products (paginated to stay within Supabase's default limits)
      const allProducts: ProductWithIngredients[] = [];
      let from = 0;

      while (true) {
        const { data: productRows, error: productError } = await supabase
          .from("products")
          .select(
            "id, product_name, brand, image_url, product_url, normalized_dosage_form, normalized_tags, cost_usd, servings_per_container"
          )
          .eq("is_active", true)
          .range(from, from + PAGE_SIZE - 1);

        if (productError) throw new Error(productError.message);
        if (!productRows || productRows.length === 0) break;

        const productIds = productRows.map((p) => p.id);

        // Fetch product_ingredients joined with ingredients for this batch
        const { data: ingredientRows, error: ingError } = await supabase
          .from("product_ingredients")
          .select(
            "product_id, ingredient_id, amount_per_serving, amount_unit, ingredients(ontology_node_id, normalized_ingredient, ontology(is_active))"
          )
          .in("product_id", productIds);

        if (ingError) throw new Error(ingError.message);

        // Group ingredients by product_id
        const ingByProduct = new Map<number, ProductIngredient[]>();
        for (const row of ingredientRows ?? []) {
          const ingRow = row.ingredients as {
            ontology_node_id: string | null;
            normalized_ingredient: string;
            ontology: { is_active: boolean } | null;
          } | null;
          const nodeId = ingRow?.ontology_node_id ?? "";
          if (!nodeId) continue; // skip unlinked ingredients
          if (ingRow?.ontology?.is_active === false) continue; // skip inactive nodes (e.g. IGNORE)

          const ing: ProductIngredient = {
            ingredientId: row.ingredient_id,
            ontologyNodeId: nodeId,
            ingredientName: ingRow?.normalized_ingredient ?? "",
            amountPerServing: row.amount_per_serving ?? null,
            amountUnit: row.amount_unit ?? null,
          };

          const list = ingByProduct.get(row.product_id) ?? [];
          list.push(ing);
          ingByProduct.set(row.product_id, list);
        }

        for (const p of productRows) {
          // Exclude products without a valid, positive cost per serving.
          const costUsd = p.cost_usd ?? null;
          const servings = p.servings_per_container ?? null;
          if (!costUsd || costUsd <= 0 || !servings || servings <= 0) continue;

          allProducts.push({
            id: p.id,
            productName: p.product_name,
            brand: p.brand ?? null,
            imageUrl: p.image_url ?? null,
            productUrl: p.product_url ?? null,
            normalizedDosageForm: p.normalized_dosage_form ?? null,
            normalizedTags: p.normalized_tags ?? [],
            costUsd,
            servingsPerContainer: servings,
            ingredients: ingByProduct.get(p.id) ?? [],
          });
        }

        if (productRows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return allProducts;
    },
  });
}
