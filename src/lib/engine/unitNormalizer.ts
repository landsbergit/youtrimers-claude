// Converts nutrient amounts to a canonical unit (micrograms, mcg) for comparison.
// Used by scoreProducts when amount_per_serving and amount_unit are both present.
// Presence-based scoring (MVP) bypasses this entirely.

type Unit = "mg" | "mcg" | "ug" | "g" | "IU" | "iu";

// Conversion factors to mcg (micrograms).
const TO_MCG: Record<string, number> = {
  mcg: 1,
  ug: 1,
  mg: 1_000,
  g: 1_000_000,
};

// IU conversions vary by nutrient. Keys are ontology node_names.
// Source: standard pharmacopeial definitions.
const IU_TO_MCG: Record<string, number> = {
  VITAMIN_A: 0.3,      // 1 IU retinol = 0.3 mcg
  RETINOL: 0.3,
  VITAMIN_D: 0.025,    // 1 IU = 0.025 mcg (25 ng)
  VITAMIN_D3: 0.025,
  VITAMIN_D2: 0.025,
  VITAMIN_E: 670,      // 1 IU dl-alpha-tocopherol = 670 mcg
  VITAMIN_E_NATURAL: 910, // 1 IU d-alpha-tocopherol = 910 mcg
  BETA_CAROTENE: 0.6,  // 1 IU beta-carotene = 0.6 mcg
};

/**
 * Normalise `amount` in `unit` to micrograms (mcg).
 * Returns null if the conversion is unknown (caller should fall back to presence-based).
 */
export function toMcg(
  amount: number,
  unit: string,
  nutrientNodeName?: string
): number | null {
  const u = unit.toLowerCase() as Unit;

  if (u === "iu") {
    if (!nutrientNodeName) return null;
    const factor = IU_TO_MCG[nutrientNodeName.toUpperCase()];
    return factor != null ? amount * factor : null;
  }

  const factor = TO_MCG[u];
  return factor != null ? amount * factor : null;
}

/**
 * Return true if two amounts (potentially in different units) satisfy
 * amount >= threshold. Falls back to raw comparison when normalisation fails.
 */
export function meetsThreshold(
  amount: number,
  amountUnit: string,
  threshold: number,
  thresholdUnit: string,
  nutrientNodeName?: string
): boolean {
  const amountMcg = toMcg(amount, amountUnit, nutrientNodeName);
  const thresholdMcg = toMcg(threshold, thresholdUnit, nutrientNodeName);

  if (amountMcg != null && thresholdMcg != null) {
    return amountMcg >= thresholdMcg;
  }
  // Same unit — compare directly
  if (amountUnit.toLowerCase() === thresholdUnit.toLowerCase()) {
    return amount >= threshold;
  }
  // Cannot compare; treat as not meeting threshold
  return false;
}
