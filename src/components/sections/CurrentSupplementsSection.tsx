import { useEffect, useRef } from "react";
import { useRecommendationContext } from "@/context/RecommendationContext";
import { useMemberCurrentSupplements } from "@/hooks/useMemberCurrentSupplements";
import { SupplementSearch } from "@/components/supplements/SupplementSearch";
import { CurrentSupplementCard } from "@/components/supplements/CurrentSupplementCard";

export default function CurrentSupplementsSection() {
  const { saveSection } = useRecommendationContext();
  const { supplements, addSupplement, removeSupplement, saveSupplements } =
    useMemberCurrentSupplements();

  const alreadyAddedIds = new Set(supplements.map((s) => s.productId));

  // Auto-save supplements when they change
  const autoSaveRef = useRef(false);
  useEffect(() => {
    if (!autoSaveRef.current) { autoSaveRef.current = true; return; }
    const t = setTimeout(() => { saveSupplements(); saveSection("supplements"); }, 800);
    return () => clearTimeout(t);
  }, [saveSupplements, saveSection]);

  return (
    <div id="supplements">
        <h2
          className="font-heading text-foreground text-3xl mb-3 cursor-default"
          title="Add supplements you are currently taking so we can account for them in your recommendations."
        >
          Review
        </h2>

        <div className="max-w-xl space-y-6">
          {/* Search bar */}
          <SupplementSearch alreadyAddedIds={alreadyAddedIds} onAdd={addSupplement} />

          {/* Added supplements */}
          {supplements.length > 0 && (
            <div className="space-y-3">
              {supplements.map((s) => (
                <CurrentSupplementCard
                  key={s.productId}
                  supplement={s}
                  onRemove={removeSupplement}
                />
              ))}
            </div>
          )}

          {supplements.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No supplements added yet. Search above to add your first one.
            </p>
          )}
        </div>
    </div>
  );
}
