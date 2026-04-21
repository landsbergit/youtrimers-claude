import type { ProductWithIngredients } from "@/types/engine";

/**
 * Mapping from restriction node_name → banned ingredient keywords.
 * A product is hard-excluded if ANY of its ingredient names (pipe-separated)
 * contains ANY banned keyword (case-insensitive substring match).
 *
 * These keywords match against the `normalized_ingredient` field in the
 * ingredients table, which uses formats like "WHEY_PROTEIN" or
 * "FISH_OIL|OMEGA_3".
 */
const BANNED_INGREDIENT_KEYWORDS: Record<string, string[]> = {
  LACTOSE_FREE: [
    "WHEY", "CASEIN", "MILK", "LACTOSE", "LACTO",
  ],
  GLUTEN_FREE: [
    "WHEAT", "BARLEY", "RYE", "GLUTEN",
  ],
  SOY_FREE: [
    "SOY", "SOYBEAN",
  ],
  NUT_FREE: [
    "ALMOND", "WALNUT", "CASHEW", "PECAN", "PISTACHIO", "MACADAMIA",
    "HAZELNUT", "BRAZIL_NUT", "PEANUT", "TREE_NUT",
  ],
  SHELLFISH_FREE: [
    "SHELLFISH", "SHRIMP", "CRAB", "LOBSTER", "CHITOSAN",
  ],
  SUGAR_FREE: [
    // Sugar-free is about added sugars in the formulation — hard to detect
    // from nutritional ingredient names. Minimal exclusion for now.
  ],
  VEGAN: [
    "GELATIN", "FISH", "WHEY", "CASEIN", "MILK", "COLLAGEN",
    "BONE_BROTH", "LANOLIN", "BEESWAX", "HONEY", "SHELLAC",
    "COD_LIVER", "FISH_LIVER", "FISH_OIL",
  ],
  VEGETERIAN: [
    "GELATIN", "FISH", "FISH_OIL", "FISH_LIVER", "COD_LIVER",
    "COLLAGEN", "BONE_BROTH",
  ],
};

/**
 * Check if a product contains any banned ingredient for the given restrictions.
 * Matches keywords as substrings against the pipe-separated ingredient names.
 */
function hasBannedIngredient(
  product: ProductWithIngredients,
  bannedKeywords: string[],
): boolean {
  if (bannedKeywords.length === 0) return false;

  for (const ing of product.ingredients) {
    const name = ing.ingredientName.toUpperCase();
    for (const keyword of bannedKeywords) {
      if (name.includes(keyword)) return true;
    }
  }
  return false;
}

/**
 * Apply food restriction hard-exclusion filter.
 *
 * For each selected restriction:
 *   - Products containing banned ingredients are removed entirely.
 *   - The corresponding "X_FREE" tag is checked separately in scoring (not here).
 *
 * @returns Filtered product list with violating products removed.
 */
export function applyFoodRestrictionFilter(
  products: ProductWithIngredients[],
  foodRestrictions: string[],
): ProductWithIngredients[] {
  if (foodRestrictions.length === 0) return products;

  // Collect all banned keywords from all selected restrictions
  const allBannedKeywords: string[] = [];
  for (const restriction of foodRestrictions) {
    const keywords = BANNED_INGREDIENT_KEYWORDS[restriction];
    if (keywords) allBannedKeywords.push(...keywords);
  }

  if (allBannedKeywords.length === 0) return products;

  // Deduplicate
  const uniqueKeywords = [...new Set(allBannedKeywords)];

  return products.filter((p) => !hasBannedIngredient(p, uniqueKeywords));
}
