import { useEffect, useMemo, useState } from "react";
import { useRecommendationContext, SECTION_ORDER, PERSONALIZE_SECTION_ORDER, SECTION_LABELS, type SectionKey } from "@/context/RecommendationContext";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useProductCatalog } from "@/hooks/useProductCatalog";
import { ProductCard } from "@/components/matches/ProductCard";
import { BundleCard } from "@/components/matches/BundleCard";
import { ProductCardSkeleton } from "@/components/matches/ProductCardSkeleton";
import { SimilarityPill } from "@/components/matches/SimilarityPill";
import { diversifyResults } from "@/lib/engine/diversifyResults";
import { findSimilar } from "@/lib/engine/findSimilar";
import { getMatchingAgeTag } from "@/lib/engine/applyDemographicFilter";
import { CheckCircle2, Circle, ChevronRight, AlertTriangle, ArrowLeft } from "lucide-react";

const DISCRETE_LABELS: { value: number; label: string }[] = [
  { value: 0.1, label: "Budget" },
  { value: 0.5, label: "Balanced" },
  { value: 0.9, label: "Quality" },
];

function approachLabel(qualityWeight: number): string {
  const match = DISCRETE_LABELS.find((d) => d.value === qualityWeight);
  if (match) return match.label;
  return `${Math.round(qualityWeight * 100)}% quality`;
}

const PAGE_SIZE = 16;
const SIMILAR_PAGE_SIZE = 8;
const MAX_PAGES = 5;
const MAX_DISPLAY = PAGE_SIZE * MAX_PAGES;

export default function MatchesSection() {
  const {
    goalIds,
    qualityWeight,
    maxBundleSize,
    diversityWeight,
    savedSections,
    acceptedDosageFormNames,
    foodPreferences,
    foodRestrictions,
    gender,
    reproductiveStatus,
    birthYear,
    birthMonth,
    religiousPreferences,
    bodySize,
    heightCm,
    weightKg,
    similarAnchor,
    setSimilarAnchor,
  } = useRecommendationContext();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Reset paging whenever similar-mode is entered or exited
  useEffect(() => {
    setDisplayCount(similarAnchor ? SIMILAR_PAGE_SIZE : PAGE_SIZE);
  }, [similarAnchor]);

  const { data: result, isLoading: isRecommending } = useRecommendations({
    goalIds,
    qualityWeight,
    maxBundleSize,
    acceptedDosageFormNames,
    gender,
    reproductiveStatus,
    birthYear,
    birthMonth,
    religiousPreferences,
    foodPreferences,
    foodRestrictions,
    bodySize,
    heightCm,
    weightKg,
  });

  // Preload catalog
  useProductCatalog();

  // Build a display-name lookup from the consolidated requirements
  const nutrientNames = useMemo(() => {
    const map = new Map<string, string>();
    if (result?.consolidatedRules.requirements) {
      for (const req of result.consolidatedRules.requirements) {
        map.set(req.nutrientNodeId, req.nutrientDisplayName ?? req.nutrientNodeId);
      }
    }
    return map;
  }, [result]);

  // Build a tooltip-text lookup: nutrientNodeId → joined rule descriptions
  const nutrientDescriptions = useMemo(() => {
    const map = new Map<string, string>();
    if (result?.consolidatedRules.requirements) {
      for (const req of result.consolidatedRules.requirements) {
        if (req.contributingRuleDescriptions.length > 0) {
          map.set(
            req.nutrientNodeId,
            req.contributingRuleDescriptions
              .map((d, i) => (req.contributingRuleDescriptions.length > 1 ? `${i + 1}. ${d}` : d))
              .join("\n\n"),
          );
        }
      }
    }
    return map;
  }, [result]);

  // MMR diversity re-ranking — pure display transform, no query re-fetch
  // lambda: 1 = Focused (pure relevance), 0 = Diverse. We invert diversityWeight so
  // that higher diversityWeight = more diversity = lower lambda.
  const lambda = 1 - diversityWeight;
  const MAX_DIVERSITY_POOL = 200; // cap diversity re-ranking to avoid O(n²) on full catalog
  const rankedProducts = useMemo(() => {
    const raw = result?.rankedProducts ?? [];
    const pool = raw.slice(0, MAX_DIVERSITY_POOL);
    return diversifyResults(pool, lambda, pool.length);
  }, [result, lambda]);

  // Similar mode: filter the ranked pool to candidates similar to the anchor.
  // Pool = full scored list (already has hard filters applied upstream).
  const similarCandidates = useMemo(() => {
    if (!similarAnchor) return [];
    const pool = result?.rankedProducts ?? [];
    return findSimilar(similarAnchor, pool);
  }, [similarAnchor, result]);

  const inSimilarMode = similarAnchor != null;
  const displayLength = inSimilarMode ? similarCandidates.length : rankedProducts.length;
  const pageSize = inSimilarMode ? SIMILAR_PAGE_SIZE : PAGE_SIZE;

  const allSectionsSaved = PERSONALIZE_SECTION_ORDER.every((s) => savedSections.has(s));
  const hasGoals = goalIds.length > 0;
  const ageTag = birthYear ? getMatchingAgeTag(birthYear, birthMonth) : null;

  const anchorName = similarAnchor
    ? similarAnchor.products.length > 1
      ? `${similarAnchor.products[0].productName} + ${similarAnchor.products.length - 1} more`
      : similarAnchor.products[0].productName
    : "";

  return (
    <div id="matches">
        <h2
          className="font-heading text-foreground text-3xl mb-3 cursor-default"
          title="Supplements matched to your personal profile."
        >
          {inSimilarMode ? "Similar products" : "Matches"}
        </h2>

        {/* Similar-mode banner: back link + anchor name */}
        {inSimilarMode && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <button
              type="button"
              onClick={() => setSimilarAnchor(null)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors text-left"
            >
              <ArrowLeft size={14} className="flex-shrink-0" />
              <span>
                <span className="whitespace-nowrap">Back to</span>{" "}
                <span className="whitespace-nowrap">original list</span>
              </span>
            </button>
            <p className="text-sm text-muted-foreground truncate">
              Showing products similar to: <span className="text-foreground font-medium">{anchorName}</span>
            </p>
          </div>
        )}

        {/* Dosage form fallback warning */}
        {result?.dosageFormFallback && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-warning" />
            <span>
              No products matched your dosage form preferences — showing all forms instead.{" "}
              <a href="#preferences" className="underline underline-offset-2 hover:opacity-80">
                Update preferences
              </a>
            </span>
          </div>
        )}

        {/* Content */}
        {isRecommending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : displayLength === 0 && !inSimilarMode ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              No matching products found for your current goals. Try adding more
              goals or check back as we expand our catalog.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pinned anchor in similar mode */}
              {inSimilarMode && similarAnchor && (() => {
                const key = `anchor-${similarAnchor.products.map((p) => p.id).join("-")}`;
                const isBundle = similarAnchor.products.length > 1;
                return (
                  <div className="md:col-span-2 relative">
                    <span className="absolute -top-2 left-4 z-10 inline-flex items-center rounded-full bg-[#E8A838]/10 border border-[#E8A838]/30 text-[#B07D1A] px-3 py-0.5 text-xs font-semibold">
                      Original
                    </span>
                    {isBundle ? (
                      <BundleCard
                        key={key}
                        rank={0}
                        rankedProduct={similarAnchor}
                        nutrientNames={nutrientNames}
                        nutrientDescriptions={nutrientDescriptions}
                        hasGoals={hasGoals}
                        gender={gender}
                        ageTag={ageTag}
                        allSelectedPreferences={foodPreferences}
                        allSelectedRestrictions={foodRestrictions}
                        allSelectedReligious={religiousPreferences}
                        hideFindSimilar
                      />
                    ) : (
                      <ProductCard
                        key={key}
                        rank={0}
                        rankedProduct={similarAnchor}
                        nutrientNames={nutrientNames}
                        nutrientDescriptions={nutrientDescriptions}
                        hasGoals={hasGoals}
                        gender={gender}
                        ageTag={ageTag}
                        allSelectedPreferences={foodPreferences}
                        allSelectedRestrictions={foodRestrictions}
                        allSelectedReligious={religiousPreferences}
                        hideFindSimilar
                      />
                    )}
                  </div>
                );
              })()}

              {inSimilarMode
                ? similarCandidates.slice(0, displayCount).map((cand, idx) => {
                    const rp = cand.ranked;
                    const key = rp.products.map((p) => p.id).join("-");
                    const isBundle = rp.products.length > 1;
                    const cardProps = {
                      rank: idx + 1,
                      rankedProduct: rp,
                      nutrientNames,
                      nutrientDescriptions,
                      hasGoals,
                      gender,
                      ageTag,
                      allSelectedPreferences: foodPreferences,
                      allSelectedRestrictions: foodRestrictions,
                      allSelectedReligious: religiousPreferences,
                      hideFindSimilar: true,
                    };
                    return (
                      <div key={key} className="relative">
                        <SimilarityPill explanation={cand.explanation} />
                        {isBundle ? <BundleCard {...cardProps} /> : <ProductCard {...cardProps} />}
                      </div>
                    );
                  })
                : rankedProducts.slice(0, displayCount).map((rp, idx) => {
                    const key = rp.products.map((p) => p.id).join("-");
                    const isBundle = rp.products.length > 1;
                    return isBundle ? (
                      <BundleCard
                        key={key}
                        rank={idx + 1}
                        rankedProduct={rp}
                        nutrientNames={nutrientNames}
                        nutrientDescriptions={nutrientDescriptions}
                        hasGoals={hasGoals}
                        gender={gender}
                        ageTag={ageTag}
                        allSelectedPreferences={foodPreferences}
                        allSelectedRestrictions={foodRestrictions}
                        allSelectedReligious={religiousPreferences}
                      />
                    ) : (
                      <ProductCard
                        key={key}
                        rank={idx + 1}
                        rankedProduct={rp}
                        nutrientNames={nutrientNames}
                        nutrientDescriptions={nutrientDescriptions}
                        hasGoals={hasGoals}
                        gender={gender}
                        ageTag={ageTag}
                        allSelectedPreferences={foodPreferences}
                        allSelectedRestrictions={foodRestrictions}
                        allSelectedReligious={religiousPreferences}
                      />
                    );
                  })}
            </div>

            {/* Empty similar-mode hint (under the pinned anchor) */}
            {inSimilarMode && displayLength === 0 && (
              <p className="mt-6 text-sm text-muted-foreground text-center">
                No other products in the catalog are similar enough to this one.
              </p>
            )}

            <div className="flex items-center gap-4 mt-6">
              <p className="text-muted-foreground text-sm">
                {inSimilarMode
                  ? (displayCount >= displayLength
                      ? `Showing all ${displayLength} similar ${displayLength === 1 ? "product" : "products"}.`
                      : `Showing ${displayCount} of ${displayLength} similar products.`)
                  : `Showing top ${Math.min(displayLength, displayCount)} matches.`}
              </p>
              {displayCount < Math.min(displayLength, MAX_DISPLAY) && (
                <button
                  type="button"
                  onClick={() => setDisplayCount((c) => Math.min(c + pageSize, MAX_DISPLAY, displayLength))}
                  className="text-sm text-primary underline underline-offset-2 hover:text-primary/70 transition-colors"
                >
                  More products
                </button>
              )}
              {displayCount > pageSize && (
                <button
                  type="button"
                  onClick={() => setDisplayCount(pageSize)}
                  className="text-sm text-primary underline underline-offset-2 hover:text-primary/70 transition-colors"
                >
                  Less
                </button>
              )}
            </div>
          </>
        )}
    </div>
  );
}

// ── Personalization progress ───────────────────────────────────────────────────

function PersonalizationProgress({ savedSections }: { savedSections: Set<SectionKey> }) {
  const { selectedGoals, qualityWeight, acceptedDosageFormNames } = useRecommendationContext();
  const savedCount = PERSONALIZE_SECTION_ORDER.filter((s) => savedSections.has(s)).length;

  function sectionSummary(s: SectionKey): React.ReactNode {
    if (!savedSections.has(s)) return null;

    if (s === "goals") {
      if (selectedGoals.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedGoals.map((g) => (
            <span
              key={g.id}
              className="inline-block rounded-full border border-success/40 bg-success/10 text-success px-2 py-0.5 text-xs"
            >
              {g.display_name}
            </span>
          ))}
        </div>
      );
    }

    if (s === "preferences" && acceptedDosageFormNames.length > 0) {
      return (
        <p className="mt-1 text-xs text-muted-foreground">
          {acceptedDosageFormNames.length} dosage form{acceptedDosageFormNames.length !== 1 ? "s" : ""} selected
        </p>
      );
    }

    if (s === "approach") {
      return (
        <p className="mt-1 text-xs text-muted-foreground">
          {approachLabel(qualityWeight)}
        </p>
      );
    }

    return null;
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground">Your Personalization</p>
        <span className="text-xs text-muted-foreground">{savedCount} / {PERSONALIZE_SECTION_ORDER.length} saved</span>
      </div>

      <div className="space-y-4">
        {PERSONALIZE_SECTION_ORDER.map((s) => {
          const done = savedSections.has(s);
          const summary = sectionSummary(s);
          return (
            <a
              key={s}
              href={`#${s}`}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors group ${
                done
                  ? "border-success/30 bg-success/5 hover:bg-success/10"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <span className="mt-0.5 flex-shrink-0">
                {done
                  ? <CheckCircle2 size={15} className="text-success" />
                  : <Circle size={15} className="text-muted-foreground" />}
              </span>

              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                  {SECTION_LABELS[s]}
                </span>
                {summary}
                {!done && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Not saved yet</p>
                )}
              </div>

              <ChevronRight size={14} className="flex-shrink-0 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
