import { useMemo } from "react";
import { useRecommendationContext, SECTION_ORDER, SECTION_LABELS, type SectionKey } from "@/context/RecommendationContext";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useProductCatalog } from "@/hooks/useProductCatalog";
import { ProductCard } from "@/components/matches/ProductCard";
import { BundleCard } from "@/components/matches/BundleCard";
import { ProductCardSkeleton } from "@/components/matches/ProductCardSkeleton";
import { MatchesEmptyState } from "@/components/matches/MatchesEmptyState";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

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

const MAX_DISPLAYED = 10;

export default function MatchesSection() {
  const { goalIds, qualityWeight, maxBundleSize, setMaxBundleSize, savedSections } =
    useRecommendationContext();
  const hasAnySection = savedSections.size > 0;

  const { data: result, isLoading: isRecommending } = useRecommendations({
    goalIds,
    qualityWeight,
    maxBundleSize,
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

  const allSectionsSaved = SECTION_ORDER.every((s) => savedSections.has(s));
  const rankedProducts = result?.rankedProducts ?? [];

  return (
    <section id="matches" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-heading text-foreground text-3xl mb-1">Matches</h2>
            <p className="text-muted-foreground text-base">
              Supplements matched to your personal profile.
            </p>
          </div>

          {/* Bundle size controller */}
          <BundleSizeControl value={maxBundleSize} onChange={setMaxBundleSize} />
        </div>

        {/* Personalization summary card */}
        {hasAnySection && (
          <PersonalizationProgress savedSections={savedSections} />
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
              {rankedProducts.slice(0, MAX_DISPLAYED).map((rp, idx) => {
                const key = rp.products.map((p) => p.id).join("-");
                const isBundle = rp.products.length > 1;
                return isBundle ? (
                  <BundleCard
                    key={key}
                    rank={idx + 1}
                    rankedProduct={rp}
                    nutrientNames={nutrientNames}
                  />
                ) : (
                  <ProductCard
                    key={key}
                    rank={idx + 1}
                    rankedProduct={rp}
                    nutrientNames={nutrientNames}
                  />
                );
              })}
            </div>
            <p className="text-muted-foreground text-sm mt-6">
              Showing top {Math.min(rankedProducts.length, MAX_DISPLAYED)} of{" "}
              {rankedProducts.length} matches.
              {!allSectionsSaved && " Complete your profile for more accurate results."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

// ── Bundle size control ────────────────────────────────────────────────────────

const BUNDLE_OPTIONS: { value: number; label: string; title: string }[] = [
  { value: 1, label: "1", title: "Single products only" },
  { value: 2, label: "2", title: "Pairs of products" },
  { value: 3, label: "3", title: "Up to 3 products" },
];

function BundleSizeControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs text-muted-foreground">Combine up to</span>
      <div className="flex items-center rounded-lg border border-border overflow-hidden">
        {BUNDLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`px-3.5 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0 border-border ${
              value === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Personalization progress ───────────────────────────────────────────────────

function PersonalizationProgress({ savedSections }: { savedSections: Set<SectionKey> }) {
  const { selectedGoals, qualityWeight } = useRecommendationContext();
  const savedCount = savedSections.size;

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
        <span className="text-xs text-muted-foreground">{savedCount} / {SECTION_ORDER.length} saved</span>
      </div>

      <div className="space-y-3">
        {SECTION_ORDER.map((s) => {
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
