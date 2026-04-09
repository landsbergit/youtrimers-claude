import { useMemo } from "react";
import { useRecommendationContext, SECTION_ORDER, SECTION_LABELS, type SectionKey } from "@/context/RecommendationContext";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useProductCatalog } from "@/hooks/useProductCatalog";
import { ProductCard } from "@/components/matches/ProductCard";
import { ProductCardSkeleton } from "@/components/matches/ProductCardSkeleton";
import { MatchesEmptyState } from "@/components/matches/MatchesEmptyState";
import { CheckCircle2, Circle } from "lucide-react";

const MAX_DISPLAYED = 10;

export default function MatchesSection() {
  const { goalIds, savedSections } = useRecommendationContext();
  const hasAnySection = savedSections.size > 0;

  const { data: result, isLoading: isRecommending } = useRecommendations({
    goalIds,
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
        <h2 className="font-heading text-foreground text-3xl mb-1">Matches</h2>
        <p className="text-muted-foreground text-base mb-6">
          Supplements matched to your personal profile.
        </p>

        {/* Personalization progress bar */}
        {hasAnySection && !allSectionsSaved && (
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
              {rankedProducts.slice(0, MAX_DISPLAYED).map((rp, idx) => (
                <ProductCard
                  key={rp.product.id}
                  rank={idx + 1}
                  rankedProduct={rp}
                  nutrientNames={nutrientNames}
                />
              ))}
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

function PersonalizationProgress({
  savedSections,
}: {
  savedSections: Set<SectionKey>;
}) {
  const sections = SECTION_ORDER;
  const savedCount = savedSections.size;

  return (
    <div className="mb-8 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground">
          Profile completeness
        </p>
        <span className="text-sm text-muted-foreground">
          {savedCount} / {sections.length}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {sections.map((s) => {
          const done = savedSections.has(s);
          return (
            <a
              key={s}
              href={`#${s}`}
              className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors ${
                done
                  ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {done ? (
                <CheckCircle2 size={12} />
              ) : (
                <Circle size={12} />
              )}
              {SECTION_LABELS[s]}
            </a>
          );
        })}
      </div>
    </div>
  );
}
