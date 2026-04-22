import type { RankedProduct, ProductWithIngredients } from "@/types/engine";

/**
 * Acceptance threshold — a candidate must pass at least this many axes.
 * With 8 axes total, passing ≥ 6 allows ≤ 2 differing parameters.
 */
const MIN_AXES_PASSING = 6;

/** Relative tolerance for price axes (±25% is considered "similar"). */
const PRICE_TOLERANCE = 0.25;

/** Minimum Jaccard / ratio thresholds per axis. */
const BRAND_RATIO_MIN = 0.5;
const COVERED_JACCARD_MIN = 0.6;
const EXTRA_JACCARD_MIN = 0.5;

/** Score ≥ this is considered "exactly the same" on that axis. */
const SAME_THRESHOLD = 0.99;

/** Per-axis scores are in [0, 1]. */
export interface AxisBreakdown {
  pricePerServing: number;
  totalPrice: number;
  dosageForm: number;
  brand: number;
  bundleSize: number;
  coveredIngredients: number;
  qualityTier: number;
  extraIngredients: number;
}

export type AxisKey = keyof AxisBreakdown;

export interface AxisPasses {
  pricePerServing: boolean;
  totalPrice: boolean;
  dosageForm: boolean;
  brand: boolean;
  bundleSize: boolean;
  coveredIngredients: boolean;
  qualityTier: boolean;
  extraIngredients: boolean;
}

export interface SimilarityExplanation {
  /** Short text for the pill (e.g. "Different brand", "Very similar"). */
  summary: string;
  /** Human-readable detail lines for each bucket. */
  same: string[];
  similar: string[];
  different: string[];
}

export interface SimilarCandidate {
  ranked: RankedProduct;
  similarityScore: number;      // 0..1, mean of axis scores
  passingAxes: number;          // count of axes above their pass threshold
  axes: AxisBreakdown;
  passes: AxisPasses;
  explanation: SimilarityExplanation;
}

// ── Axis helpers ──────────────────────────────────────────────────────────────

/** Shape: 1.0 at exact match, 0.5 at ±25% (the threshold), 0 at ±50%+. */
function priceAxisScore(anchor: number, candidate: number): number {
  if (anchor <= 0 || candidate <= 0) return 0;
  const delta = Math.abs(anchor - candidate) / anchor;
  return Math.max(0, 1 - delta / (PRICE_TOLERANCE * 2));
}

function bundleCostPerServing(products: ProductWithIngredients[]): number {
  return products.reduce((s, p) => s + p.costUsd / p.servingsPerContainer, 0);
}

function bundleTotalCost(products: ProductWithIngredients[]): number {
  return products.reduce((s, p) => s + p.costUsd, 0);
}

/** Ratio of dosage forms that match position-by-position when sorted — used as both score and pass signal. */
function dosageFormAxis(
  a: ProductWithIngredients[],
  b: ProductWithIngredients[],
): { score: number; passes: boolean } {
  if (a.length !== b.length) return { score: 0, passes: false };
  const aForms = a.map((p) => p.normalizedDosageForm ?? "").sort();
  const bForms = b.map((p) => p.normalizedDosageForm ?? "").sort();
  let matches = 0;
  for (let i = 0; i < aForms.length; i++) {
    if (aForms[i] === bForms[i]) matches++;
  }
  const score = aForms.length > 0 ? matches / aForms.length : 1;
  // Pass: all positions match.
  return { score, passes: matches === aForms.length };
}

/** |A ∩ B| / max(|A|, |B|) — handles singles and bundles uniformly. */
function brandAxis(
  a: ProductWithIngredients[],
  b: ProductWithIngredients[],
): { score: number; passes: boolean } {
  const aBrands = new Set(a.map((p) => p.brand ?? "").filter(Boolean));
  const bBrands = new Set(b.map((p) => p.brand ?? "").filter(Boolean));
  if (aBrands.size === 0 && bBrands.size === 0) return { score: 1, passes: true };
  if (aBrands.size === 0 || bBrands.size === 0) return { score: 0, passes: false };
  const intersection = [...aBrands].filter((x) => bBrands.has(x)).length;
  const score = intersection / Math.max(aBrands.size, bBrands.size);
  return { score, passes: score >= BRAND_RATIO_MIN };
}

function jaccard(aArr: string[], bArr: string[]): number {
  const a = new Set(aArr);
  const b = new Set(bArr);
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

// Placeholder ordering — higher = better. Update to the real enum when quality_tier lands.
const QUALITY_TIER_RANK: Record<string, number> = {
  BUDGET: 1,
  STANDARD: 2,
  PREMIUM: 3,
};

function tierRank(tier: string | null | undefined): number {
  if (!tier) return 0;
  return QUALITY_TIER_RANK[tier] ?? 0;
}

/**
 * Candidate must be "similar to or better" than anchor.
 * Sort both bundles' tiers ascending (worst-first), then require
 * candidate[i] ≥ anchor[i] at every position.
 *
 * When quality_tier is missing on either side, this axis is a no-op (passes, score 1.0).
 */
function qualityTierAxis(
  a: ProductWithIngredients[],
  b: ProductWithIngredients[],
): { score: number; passes: boolean } {
  const aHasTier = a.some((p) => p.qualityTier);
  const bHasTier = b.some((p) => p.qualityTier);
  if (!aHasTier || !bHasTier) return { score: 1, passes: true };
  if (a.length !== b.length) return { score: 0, passes: false };

  const aRanks = a.map((p) => tierRank(p.qualityTier)).sort((x, y) => x - y);
  const bRanks = b.map((p) => tierRank(p.qualityTier)).sort((x, y) => x - y);

  let allEqual = true;
  for (let i = 0; i < aRanks.length; i++) {
    if (bRanks[i] < aRanks[i]) return { score: 0, passes: false };
    if (bRanks[i] !== aRanks[i]) allEqual = false;
  }
  return { score: allEqual ? 1 : 0.75, passes: true };
}

// ── Explanation helpers ──────────────────────────────────────────────────────

const SHORT_LABEL: Record<AxisKey, string> = {
  pricePerServing: "price/serving",
  totalPrice: "total price",
  dosageForm: "form",
  brand: "brand",
  bundleSize: "bundle size",
  coveredIngredients: "coverage",
  qualityTier: "quality",
  extraIngredients: "extras",
};

const FULL_LABEL: Record<AxisKey, string> = {
  pricePerServing: "price per serving",
  totalPrice: "total price",
  dosageForm: "dosage form",
  brand: "brand",
  bundleSize: "bundle size",
  coveredIngredients: "nutrient coverage",
  qualityTier: "quality tier",
  extraIngredients: "extra ingredients",
};

/**
 * Minor descriptive fields surfaced in the tooltip/pill but NOT part of the
 * 8-axis acceptance rubric. Priority order drives which shows first in the pill.
 */
type MinorField = "servingsPerContainer" | "flavor" | "expirationDate" | "packaging";

const MINOR_FIELD_ORDER: MinorField[] = [
  "servingsPerContainer",
  "flavor",
  "expirationDate",
  "packaging",
];

const MINOR_SHORT_LABEL: Record<MinorField, string> = {
  servingsPerContainer: "servings",
  flavor: "flavor",
  expirationDate: "expiration",
  packaging: "packaging",
};

function money(v: number): string {
  return `$${v.toFixed(2)}`;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function joinForms(products: ProductWithIngredients[]): string {
  return products
    .map((p) => (p.normalizedDosageForm ?? "?").toLowerCase())
    .join(", ");
}

function joinBrands(products: ProductWithIngredients[]): string {
  return products.map((p) => p.brand ?? "?").join(", ");
}

function bundleSizeLabel(n: number): string {
  return n === 1 ? "single" : `bundle of ${n}`;
}

function tierList(products: ProductWithIngredients[]): string {
  return products.map((p) => p.qualityTier ?? "?").join(", ");
}

// ── Minor-field helpers ───────────────────────────────────────────────────

/** YYYY-MM for display; drops the day so small differences don't look noisy. */
function formatMonth(iso: string): string {
  return iso.slice(0, 7); // "2027-05-15" → "2027-05"
}

/** Whole-month difference between two ISO YYYY-MM-DD dates (a - b). */
function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (!ay || !am || !by || !bm) return 0;
  return (ay - by) * 12 + (am - bm);
}

/** Returns an array of [field, formatted line] for minor fields where the
 *  candidate differs from the anchor. Fields where either side lacks data
 *  are skipped entirely. Ordered by MINOR_FIELD_ORDER. */
function collectMinorDiffs(
  anchor: RankedProduct,
  candidate: RankedProduct,
): { field: MinorField; line: string }[] {
  const a = anchor.products[0];
  const b = candidate.products[0];
  // Minor diffs compare the primary (first) product in each bundle — the other
  // products are described by the major axes. For singles this is just "the product".
  const out: { field: MinorField; line: string }[] = [];

  // Servings per container
  if (
    a.servingsPerContainer != null &&
    b.servingsPerContainer != null &&
    a.servingsPerContainer !== b.servingsPerContainer
  ) {
    const direction = b.servingsPerContainer > a.servingsPerContainer ? "More" : "Fewer";
    out.push({
      field: "servingsPerContainer",
      line: `${direction} servings: ${a.servingsPerContainer} → ${b.servingsPerContainer}`,
    });
  }

  // Flavor
  if (a.flavor && b.flavor && a.flavor.toLowerCase() !== b.flavor.toLowerCase()) {
    out.push({
      field: "flavor",
      line: `Different flavor: ${a.flavor} → ${b.flavor}`,
    });
  }

  // Expiration date — compare at YYYY-MM granularity
  if (a.expirationDate && b.expirationDate) {
    const diff = monthDiff(a.expirationDate, b.expirationDate);
    if (diff !== 0) {
      const absMonths = Math.abs(diff);
      const unit = absMonths === 1 ? "month" : "months";
      // diff > 0 means anchor is later → candidate is earlier
      const direction = diff > 0 ? "earlier" : "later";
      out.push({
        field: "expirationDate",
        line: `Expires ${absMonths} ${unit} ${direction}: ${formatMonth(a.expirationDate)} → ${formatMonth(b.expirationDate)}`,
      });
    }
  }

  // Packaging
  if (a.packaging && b.packaging && a.packaging.toLowerCase() !== b.packaging.toLowerCase()) {
    out.push({
      field: "packaging",
      line: `Different packaging: ${a.packaging} → ${b.packaging}`,
    });
  }

  // Sort by configured priority
  out.sort(
    (x, y) => MINOR_FIELD_ORDER.indexOf(x.field) - MINOR_FIELD_ORDER.indexOf(y.field),
  );
  return out;
}

/** Produces one detail line per axis, slotted into same/similar/different buckets. */
function buildExplanation(
  anchor: RankedProduct,
  candidate: RankedProduct,
  axes: AxisBreakdown,
  passes: AxisPasses,
): SimilarityExplanation {
  const a = anchor.products;
  const b = candidate.products;
  const anchorCps = bundleCostPerServing(a);
  const candCps = bundleCostPerServing(b);
  const anchorTotal = bundleTotalCost(a);
  const candTotal = bundleTotalCost(b);

  const same: string[] = [];
  const similar: string[] = [];
  const different: string[] = [];

  const bucketFor = (axis: AxisKey): "same" | "similar" | "different" => {
    if (!passes[axis]) return "different";
    if (axes[axis] >= SAME_THRESHOLD) return "same";
    return "similar";
  };

  const push = (axis: AxisKey, line: string) => {
    const bucket = bucketFor(axis);
    if (bucket === "same") same.push(line);
    else if (bucket === "similar") similar.push(line);
    else different.push(line);
  };

  // ── Price per serving ────────────────────────────────────────────────────
  {
    const bucket = bucketFor("pricePerServing");
    if (bucket === "same") {
      push("pricePerServing", `Same price per serving (${money(anchorCps)})`);
    } else {
      const delta = candCps - anchorCps;
      const direction = delta > 0 ? "Higher" : "Lower";
      push(
        "pricePerServing",
        `${direction} price per serving by ${money(Math.abs(delta))} (${money(anchorCps)} → ${money(candCps)})`,
      );
    }
  }

  // ── Total price ──────────────────────────────────────────────────────────
  {
    const bucket = bucketFor("totalPrice");
    if (bucket === "same") {
      push("totalPrice", `Same total price (${money(anchorTotal)})`);
    } else {
      const delta = candTotal - anchorTotal;
      const direction = delta > 0 ? "Higher" : "Lower";
      push(
        "totalPrice",
        `${direction} total price by ${money(Math.abs(delta))} (${money(anchorTotal)} → ${money(candTotal)})`,
      );
    }
  }

  // ── Dosage form ──────────────────────────────────────────────────────────
  {
    const aForms = joinForms(a);
    const bForms = joinForms(b);
    if (passes.dosageForm) {
      push("dosageForm", `Same dosage form${a.length > 1 ? "s" : ""} (${aForms})`);
    } else {
      push(
        "dosageForm",
        `Different dosage form${a.length > 1 || b.length > 1 ? "s" : ""}: ${aForms} → ${bForms}`,
      );
    }
  }

  // ── Brand ────────────────────────────────────────────────────────────────
  {
    const aBrands = joinBrands(a);
    const bBrands = joinBrands(b);
    if (axes.brand >= SAME_THRESHOLD) {
      push("brand", `Same brand${a.length > 1 ? "s" : ""} (${aBrands})`);
    } else if (passes.brand) {
      push("brand", `Partial brand match: ${aBrands} → ${bBrands}`);
    } else {
      push("brand", `Different brand${a.length > 1 || b.length > 1 ? "s" : ""}: ${aBrands} → ${bBrands}`);
    }
  }

  // ── Bundle size ──────────────────────────────────────────────────────────
  {
    if (passes.bundleSize) {
      push("bundleSize", `Same bundle size (${bundleSizeLabel(a.length)})`);
    } else {
      push(
        "bundleSize",
        `Different bundle size: ${bundleSizeLabel(a.length)} → ${bundleSizeLabel(b.length)}`,
      );
    }
  }

  // ── Covered ingredients (nutrient coverage) ──────────────────────────────
  {
    if (axes.coveredIngredients >= SAME_THRESHOLD) {
      push("coveredIngredients", "Same nutrient coverage");
    } else {
      push("coveredIngredients", `${pct(axes.coveredIngredients)} nutrient-coverage overlap`);
    }
  }

  // ── Quality tier ─────────────────────────────────────────────────────────
  {
    const aHas = a.some((p) => p.qualityTier);
    const bHas = b.some((p) => p.qualityTier);
    if (!aHas || !bHas) {
      // Skip this axis entirely when data is missing — don't add noise.
    } else if (axes.qualityTier >= SAME_THRESHOLD) {
      push("qualityTier", `Same quality tier (${tierList(a)})`);
    } else if (passes.qualityTier) {
      // Score 0.75 — upgrade
      push("qualityTier", `Upgraded quality tier: ${tierList(a)} → ${tierList(b)}`);
    } else {
      push("qualityTier", `Lower quality tier: ${tierList(a)} → ${tierList(b)}`);
    }
  }

  // ── Extra ingredients ────────────────────────────────────────────────────
  {
    if (axes.extraIngredients >= SAME_THRESHOLD) {
      push("extraIngredients", "Same extra ingredients");
    } else {
      push("extraIngredients", `${pct(axes.extraIngredients)} extra-ingredient overlap`);
    }
  }

  // ── Minor diffs — informational, appended to the Different bucket ────────
  const minorDiffs = collectMinorDiffs(anchor, candidate);
  for (const md of minorDiffs) different.push(md.line);

  // ── Summary text for the pill ────────────────────────────────────────────
  // Difference sequence = major differing axes (existing priority), then minor
  // fields in their priority order. Pill shows the top 2 labels.
  const differingAxes: AxisKey[] = [];
  (Object.keys(axes) as AxisKey[]).forEach((k) => {
    if (!passes[k]) differingAxes.push(k);
  });

  const pillLabels: string[] = [
    ...differingAxes.map((k) => SHORT_LABEL[k]),
    ...minorDiffs.map((m) => MINOR_SHORT_LABEL[m.field]),
  ];

  let summary: string;
  if (pillLabels.length === 0) {
    summary = "Very similar";
  } else {
    summary = `Different ${pillLabels.slice(0, 2).join(" · ")}`;
  }

  return { summary, same, similar, different };
}

/** Exported for tooltip use. */
export { FULL_LABEL };

// ── Core ─────────────────────────────────────────────────────────────────────

function anchorKey(rp: RankedProduct): string {
  return [...rp.products.map((p) => p.id)].sort((a, b) => a - b).join("-");
}

/**
 * Score a single candidate's similarity to the anchor.
 * Returns null if candidate is the anchor itself (by product-ID multiset).
 */
function scoreCandidate(
  anchor: RankedProduct,
  candidate: RankedProduct,
): SimilarCandidate | null {
  if (anchorKey(anchor) === anchorKey(candidate)) return null;

  const a = anchor.products;
  const b = candidate.products;

  const anchorCps = bundleCostPerServing(a);
  const candCps = bundleCostPerServing(b);
  const anchorTotal = bundleTotalCost(a);
  const candTotal = bundleTotalCost(b);

  const pricePerServingScore = priceAxisScore(anchorCps, candCps);
  const totalPriceScore = priceAxisScore(anchorTotal, candTotal);
  const pricePerServingPasses =
    Math.abs(anchorCps - candCps) / anchorCps <= PRICE_TOLERANCE;
  const totalPricePasses =
    Math.abs(anchorTotal - candTotal) / anchorTotal <= PRICE_TOLERANCE;

  const dosage = dosageFormAxis(a, b);
  const brand = brandAxis(a, b);

  const bundleSizePasses = a.length === b.length;
  const bundleSizeScore = bundleSizePasses ? 1 : 0;

  const coveredJ = jaccard(
    anchor.matchedNutrientNodeIds,
    candidate.matchedNutrientNodeIds,
  );
  const extraJ = jaccard(
    anchor.extraIngredientNames,
    candidate.extraIngredientNames,
  );

  const quality = qualityTierAxis(a, b);

  const axes: AxisBreakdown = {
    pricePerServing: pricePerServingScore,
    totalPrice: totalPriceScore,
    dosageForm: dosage.score,
    brand: brand.score,
    bundleSize: bundleSizeScore,
    coveredIngredients: coveredJ,
    qualityTier: quality.score,
    extraIngredients: extraJ,
  };

  const passes: AxisPasses = {
    pricePerServing: pricePerServingPasses,
    totalPrice: totalPricePasses,
    dosageForm: dosage.passes,
    brand: brand.passes,
    bundleSize: bundleSizePasses,
    coveredIngredients: coveredJ >= COVERED_JACCARD_MIN,
    qualityTier: quality.passes,
    extraIngredients: extraJ >= EXTRA_JACCARD_MIN,
  };

  const passingAxes = Object.values(passes).reduce(
    (n, f) => n + (f ? 1 : 0),
    0,
  );

  const axisValues = Object.values(axes);
  const similarityScore =
    axisValues.reduce((s, v) => s + v, 0) / axisValues.length;

  const explanation = buildExplanation(anchor, candidate, axes, passes);

  return { ranked: candidate, similarityScore, passingAxes, axes, passes, explanation };
}

/**
 * Find products similar to the anchor within a pool of already-ranked products.
 *
 * Accepts candidates passing ≥ 6 of 8 axes (≤ 2 differing parameters).
 * Sorts accepted results by overall similarity score descending.
 * Excludes the anchor itself — the UI is expected to pin it separately.
 */
export function findSimilar(
  anchor: RankedProduct,
  pool: RankedProduct[],
): SimilarCandidate[] {
  const scored: SimilarCandidate[] = [];
  for (const candidate of pool) {
    const result = scoreCandidate(anchor, candidate);
    if (result && result.passingAxes >= MIN_AXES_PASSING) {
      scored.push(result);
    }
  }
  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored;
}
