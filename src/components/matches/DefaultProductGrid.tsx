import { useMemo } from "react";
import type { ProductWithIngredients } from "@/types/engine";
import { applyDemographicFilter, getMatchingAgeTag } from "@/lib/engine/applyDemographicFilter";
import { applyFoodRestrictionFilter } from "@/lib/engine/applyFoodRestrictionFilter";
import { applyReligiousFilter } from "@/lib/engine/applyReligiousFilter";
import { ProductCard } from "./ProductCard";

/**
 * Demographic groups to sample from, in display order.
 * Each product is assigned to the FIRST matching group.
 */
const DEMOGRAPHIC_GROUPS = [
  { tag: "FEMALE", label: "Women" },
  { tag: "MALE",   label: "Men" },
  { tag: "SENIOR", label: "Seniors" },
  { tag: "ADULT",  label: "Adults" },
  { tag: "TEEN",   label: "Teens" },
  { tag: "CHILD",  label: "Children" },
  { tag: "BABY",   label: "Baby" },
];

/**
 * Pick n random items from an array (Fisher-Yates partial shuffle).
 */
function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
}

interface DefaultProductGridProps {
  catalog: ProductWithIngredients[];
  maxDisplay: number;
  gender: string | null;
  reproductiveStatus: string | null;
  birthYear: number | null;
  birthMonth: number | null;
  religiousPreferences: string[];
  foodRestrictions: string[];
  foodPreferences: string[];
}

/**
 * Shows a default set of products before any goals are selected.
 * Distributes N products across demographic groups (Male, Female, Senior, etc.)
 * with random selection within each group.
 */
export function DefaultProductGrid({
  catalog,
  maxDisplay,
  gender,
  reproductiveStatus,
  birthYear,
  birthMonth,
  religiousPreferences,
  foodRestrictions,
  foodPreferences,
}: DefaultProductGridProps) {

  const products = useMemo(() => {
    // Apply existing filters (gender hard exclusion, age preferred exclusion, etc.)
    let filtered = applyDemographicFilter(catalog, gender, reproductiveStatus, birthYear, birthMonth);
    filtered = applyReligiousFilter(filtered, religiousPreferences);
    filtered = applyFoodRestrictionFilter(filtered, foodRestrictions);

    // Group products by demographic tag and shuffle each pool
    const pools = new Map<string, ProductWithIngredients[]>();
    const used = new Set<number>();

    for (const group of DEMOGRAPHIC_GROUPS) {
      const matching = filtered.filter((p) => p.normalizedTags.includes(group.tag));
      pools.set(group.tag, pickRandom(matching, matching.length)); // shuffle
    }

    // Interleave: round-robin across groups
    // Round 1: one from each group (positions 1–7)
    // Round 2: another from each group (positions 8–14)
    // etc. until N products are filled
    const result: ProductWithIngredients[] = [];
    const groupCount = DEMOGRAPHIC_GROUPS.length;
    const maxRounds = Math.ceil(maxDisplay / groupCount);
    const cursors = new Map<string, number>(); // track position per group
    for (const g of DEMOGRAPHIC_GROUPS) cursors.set(g.tag, 0);

    for (let round = 0; round < maxRounds && result.length < maxDisplay; round++) {
      for (const group of DEMOGRAPHIC_GROUPS) {
        if (result.length >= maxDisplay) break;
        const pool = pools.get(group.tag) ?? [];
        let cursor = cursors.get(group.tag) ?? 0;

        // Find next unused product from this group
        while (cursor < pool.length && used.has(pool[cursor].id)) cursor++;
        if (cursor < pool.length) {
          result.push(pool[cursor]);
          used.add(pool[cursor].id);
          cursor++;
        }
        cursors.set(group.tag, cursor);
      }
    }

    // Fill remaining slots from untagged/other products if groups didn't fill N
    if (result.length < maxDisplay) {
      const remaining = filtered.filter((p) => !used.has(p.id));
      const extra = pickRandom(remaining, maxDisplay - result.length);
      result.push(...extra);
    }

    // Compute demographic match score per product.
    // Score reflects how well the product matches the personalization fields
    // that have been filled in. Only filled fields contribute to the score.
    const genderTag = gender === "FEMALE" ? "FEMALE" : gender === "MALE" ? "MALE" : null;
    const ageTag = birthYear ? getMatchingAgeTag(birthYear, birthMonth) : null;

    // Count how many demographic dimensions are active
    const activeDimensions = (genderTag ? 1 : 0) + (ageTag ? 1 : 0);

    return result.map((p) => {
      const tags = new Set(p.normalizedTags ?? []);

      if (activeDimensions === 0) {
        // No personalization — all products score 50% (neutral)
        return { product: p, score: 0.5 };
      }

      // Score each active dimension: 1 = match, 0.5 = untagged (neutral), 0 = mismatch
      let total = 0;

      if (genderTag) {
        if (tags.has(genderTag)) total += 1.0;              // explicit match
        else if (tags.has("MALE") || tags.has("FEMALE")) total += 0; // opposite gender
        else total += 0.5;                                   // untagged = neutral
      }

      if (ageTag) {
        if (tags.has(ageTag)) total += 1.0;                  // explicit match
        else if (tags.has("BABY") || tags.has("CHILD") || tags.has("TEEN") || tags.has("ADULT") || tags.has("SENIOR")) total += 0; // wrong age
        else total += 0.5;                                    // untagged = neutral
      }

      // Compute matched preference and restriction tags
      const prefSet = new Set(foodPreferences);
      const restrictSet = new Set(foodRestrictions);
      const relSet = new Set(religiousPreferences);
      const matchedPreferenceTags = [...prefSet].filter((t) => tags.has(t));
      const matchedRestrictionFreeTags = [...restrictSet].filter((t) => tags.has(t));
      const matchedReligiousTags = [...relSet].filter((t) => tags.has(t));

      return { product: p, score: total / activeDimensions, matchedPreferenceTags, matchedRestrictionFreeTags, matchedReligiousTags };
    }).sort((a, b) => b.score - a.score);
  }, [catalog, maxDisplay, gender, reproductiveStatus, birthYear, birthMonth, religiousPreferences, foodRestrictions, foodPreferences]);

  const emptyNutrientNames = useMemo(() => new Map<string, string>(), []);
  const emptyNutrientDescs = useMemo(() => new Map<string, string>(), []);

  if (products.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8">
        No products available. Try adjusting your filters.
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground text-sm mb-4">
        Popular supplements across categories. Select a goal to see personalized matches.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map(({ product, score, matchedPreferenceTags, matchedRestrictionFreeTags, matchedReligiousTags }, idx) => (
          <ProductCard
            key={product.id}
            rank={idx + 1}
            rankedProduct={{
              products: [product],
              score,
              matchedNutrientNodeIds: [],
              missedNutrientNodeIds: [],
              extraIngredientNames: [],
              scoreBreakdown: {},
              matchedPreferenceTags,
              matchedRestrictionFreeTags,
              matchedReligiousTags,
            }}
            nutrientNames={emptyNutrientNames}
            nutrientDescriptions={emptyNutrientDescs}
          />
        ))}
      </div>
    </>
  );
}
