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
/**
 * Returns the set of age tags to exclude given birth info.
 * Exported so other modules can compute the member's matching age tag.
 */
export function getAgeExcludedTags(birthYear: number, birthMonth: number | null): Set<string> {
  const excluded = new Set<string>();
  const months = ageInMonths(birthYear, birthMonth);

  if (months < 12) {
    excluded.add("CHILD"); excluded.add("TEEN"); excluded.add("ADULT"); excluded.add("SENIOR");
  } else if (months < 156) {
    excluded.add("TEEN"); excluded.add("ADULT"); excluded.add("SENIOR");
  } else if (months < 216) {
    excluded.add("BABY"); excluded.add("ADULT"); excluded.add("SENIOR");
  } else if (months < 720) {
    excluded.add("BABY"); excluded.add("CHILD"); excluded.add("TEEN"); excluded.add("SENIOR");
  } else {
    excluded.add("BABY"); excluded.add("CHILD"); excluded.add("TEEN");
  }
  return excluded;
}

/**
 * Returns the matching age tag for the member's age.
 */
export function getMatchingAgeTag(birthYear: number, birthMonth: number | null): string {
  const months = ageInMonths(birthYear, birthMonth);
  if (months < 12) return "BABY";
  if (months < 156) return "CHILD";
  if (months < 216) return "TEEN";
  if (months < 720) return "ADULT";
  return "SENIOR";
}

export function applyDemographicFilter(
  products: ProductWithIngredients[],
  gender: string | null,
  reproductiveStatus: string | null,
  birthYear: number | null,
  birthMonth: number | null,
): ProductWithIngredients[] {
  // ── Gender (hard exclusion) ──────────────────────────────────────────────
  const genderExcluded = new Set<string>();
  if (gender === "MALE") {
    genderExcluded.add("FEMALE"); genderExcluded.add("PRENATAL"); genderExcluded.add("POSTNATAL");
  } else if (gender === "FEMALE") {
    genderExcluded.add("MALE");
    if (reproductiveStatus !== "PREGNANCY") {
      genderExcluded.add("PRENATAL"); genderExcluded.add("POSTNATAL");
    }
  }

  let filtered = genderExcluded.size > 0
    ? products.filter((p) => !p.normalizedTags.some((tag) => genderExcluded.has(tag)))
    : products;

  // ── Age (preferred exclusion — fallback to unfiltered if result is empty) ─
  if (birthYear !== null) {
    const ageExcluded = getAgeExcludedTags(birthYear, birthMonth);
    if (ageExcluded.size > 0) {
      const ageFiltered = filtered.filter(
        (p) => !p.normalizedTags.some((tag) => ageExcluded.has(tag)),
      );
      // Preferred exclusion: use filtered result unless it's empty
      if (ageFiltered.length > 0) {
        filtered = ageFiltered;
      }
      // else: fall back to gender-filtered set (includes age-inappropriate products)
    }
  }

  return filtered;
}
