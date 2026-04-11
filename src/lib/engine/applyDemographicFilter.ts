import type { ProductWithIngredients } from "@/types/engine";

// ── Age bracket helpers ───────────────────────────────────────────────────────

function ageInMonths(birthYear: number, birthMonth: number | null): number {
  const now = new Date();
  // Use mid-year (6) when month is unknown — gives a median estimate.
  const month = birthMonth ?? 6;
  return (now.getFullYear() - birthYear) * 12 + (now.getMonth() + 1 - month);
}

// ── Tag exclusion logic ───────────────────────────────────────────────────────

/**
 * Hard-excludes products whose `normalizedTags` are incompatible with the
 * member's demographic profile. Returns a new filtered array; never mutates.
 *
 * Rules (all conjunctive — a product is excluded if ANY of its tags is in the
 * excluded set):
 *
 *   Gender = MALE          → exclude FEMALE, PRENATAL, POSTNATAL
 *   Gender = FEMALE        → exclude MALE
 *                            exclude PRENATAL unless reproductiveStatus === "PREGNANCY"
 *                            exclude POSTNATAL unless reproductiveStatus === "PREGNANCY"
 *                            (note: "trying to conceive" not yet an ontology status;
 *                             update this condition when it is added)
 *
 *   Baby   (< 12 mo)       → exclude CHILD, TEEN, ADULT, SENIOR
 *   Child  (1–12 yr)       → exclude TEEN, ADULT, SENIOR
 *   Teen   (13–17 yr)      → exclude BABY, ADULT, SENIOR
 *   Adult  (18–59 yr)      → exclude BABY, CHILD, TEEN, SENIOR
 *   Senior (60+ yr)        → exclude BABY, CHILD, TEEN
 *                            (seniors CAN see ADULT-tagged products)
 *
 * If gender or birthYear is unknown, the corresponding exclusions are skipped.
 * Products with no tags, or none of the excluded tags, are always kept.
 */
export function applyDemographicFilter(
  products: ProductWithIngredients[],
  gender: string | null,
  reproductiveStatus: string | null,
  birthYear: number | null,
  birthMonth: number | null,
): ProductWithIngredients[] {
  const excluded = new Set<string>();

  // ── Gender ────────────────────────────────────────────────────────────────
  if (gender === "MALE") {
    excluded.add("FEMALE");
    excluded.add("PRENATAL");
    excluded.add("POSTNATAL");
  } else if (gender === "FEMALE") {
    excluded.add("MALE");
    if (reproductiveStatus !== "PREGNANCY") {
      excluded.add("PRENATAL");
      excluded.add("POSTNATAL");
    }
  }
  // OTHER / PREFER_NOT_TO_SAY / null → no gender-based exclusions.

  // ── Age ───────────────────────────────────────────────────────────────────
  if (birthYear !== null) {
    const months = ageInMonths(birthYear, birthMonth);

    if (months < 12) {
      // Baby
      excluded.add("CHILD");
      excluded.add("TEEN");
      excluded.add("ADULT");
      excluded.add("SENIOR");
    } else if (months < 156) {
      // Child (1–12 yr)
      excluded.add("TEEN");
      excluded.add("ADULT");
      excluded.add("SENIOR");
    } else if (months < 216) {
      // Teen (13–17 yr)
      excluded.add("BABY");
      excluded.add("ADULT");
      excluded.add("SENIOR");
    } else if (months < 720) {
      // Adult (18–59 yr)
      excluded.add("BABY");
      excluded.add("CHILD");
      excluded.add("TEEN");
      excluded.add("SENIOR");
    } else {
      // Senior (60+ yr) — may still see ADULT products
      excluded.add("BABY");
      excluded.add("CHILD");
      excluded.add("TEEN");
    }
  }

  if (excluded.size === 0) return products;

  return products.filter(
    (p) => !p.normalizedTags.some((tag) => excluded.has(tag)),
  );
}
