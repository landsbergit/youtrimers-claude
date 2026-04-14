import type { ProductWithIngredients } from "@/types/engine";

/**
 * Hard-excludes products that do not carry ALL of the member's required
 * religious certification tags.
 *
 * Rules:
 *   - religiousPreferences is empty  → no filter; return all products unchanged.
 *   - religiousPreferences = ["KOSHER"] → keep only products whose normalizedTags
 *     includes "KOSHER".
 *   - religiousPreferences = ["KOSHER", "HALAL"] → product must have BOTH tags.
 *
 * Products with no normalizedTags at all are excluded when a preference is set
 * (unverified products cannot be assumed to be certified).
 *
 * Never mutates the input array.
 */
export function applyReligiousFilter(
  products: ProductWithIngredients[],
  religiousPreferences: string[],
): ProductWithIngredients[] {
  if (religiousPreferences.length === 0) return products;

  return products.filter((p) =>
    religiousPreferences.every((name) => p.normalizedTags.includes(name)),
  );
}
