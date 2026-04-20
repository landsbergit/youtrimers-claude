import { useMemo, useState } from "react";
import { useRecommendationContext, SECTION_ORDER, PERSONALIZE_SECTION_ORDER, SECTION_LABELS, type SectionKey } from "@/context/RecommendationContext";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useProductCatalog } from "@/hooks/useProductCatalog";
import { ProductCard } from "@/components/matches/ProductCard";
import { BundleCard } from "@/components/matches/BundleCard";
import { ProductCardSkeleton } from "@/components/matches/ProductCardSkeleton";
import { MatchesEmptyState } from "@/components/matches/MatchesEmptyState";
import { diversifyResults } from "@/lib/engine/diversifyResults";
import { CheckCircle2, Circle, ChevronRight, AlertTriangle } from "lucide-react";

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
const MAX_PAGES = 5;

export default function MatchesSection() {
  const {
    goalIds,
    qualityWeight,
    maxBundleSize,
    diversityWeight,
    savedSections,
    acceptedDosageFormNames,
    gender,
    reproductiveStatus,
    birthYear,
    birthMonth,
    religiousPreferences,
    bodySize,
    heightCm,
    weightKg,
  } = useRecommendationContext();
  const hasAnySection = savedSections.size > 0;
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

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
    bodySize,
    heightCm,
    weightKg,
  });

  // Preload the catalog while the user browses (non-blocking)
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
  const rankedProducts = useMemo(() => {
    const raw = result?.rankedProducts ?? [];
    return diversifyResults(raw, lambda, raw.length);
  }, [result, lambda]);

  const allSectionsSaved = PERSONALIZE_SECTION_ORDER.every((s) => savedSections.has(s));

  return (
    <div id="matches">
        <h2
          className="font-heading text-foreground text-3xl mb-3 cursor-default"
          title="Supplements matched to your personal profile."
        >
          Matches
        </h2>

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
        {!hasAnySection ? (
          <MatchesEmptyState savedSections={savedSections} />
        ) : isRecommending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : rankedProducts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              No matching products found for your current goals. Try adding more
              goals or check back as we expand our catalog.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rankedProducts.slice(0, displayCount).map((rp, idx) => {
                const key = rp.products.map((p) => p.id).join("-");
                const isBundle = rp.products.length > 1;
                return isBundle ? (
                  <BundleCard
                    key={key}
                    rank={idx + 1}
                    rankedProduct={rp}
                    nutrientNames={nutrientNames}
                    nutrientDescriptions={nutrientDescriptions}
                  />
                ) : (
                  <ProductCard
                    key={key}
                    rank={idx + 1}
                    rankedProduct={rp}
                    nutrientNames={nutrientNames}
                    nutrientDescriptions={nutrientDescriptions}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-6">
              <p className="text-muted-foreground text-sm">
                Showing top {Math.min(rankedProducts.length, displayCount)} matches.
              </p>
              {displayCount < Math.min(rankedProducts.length, PAGE_SIZE * MAX_PAGES) && (
                <button
                  type="button"
                  onClick={() => setDisplayCount((c) => Math.min(c + PAGE_SIZE, PAGE_SIZE * MAX_PAGES, rankedProducts.length))}
                  className="text-sm text-primary underline underline-offset-2 hover:text-primary/70 transition-colors"
                >
                  More products
                </button>
              )}
              {displayCount > PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() => setDisplayCount(PAGE_SIZE)}
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
