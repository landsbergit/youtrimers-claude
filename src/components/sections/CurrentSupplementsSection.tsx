import { useState } from "react";
import { Check } from "lucide-react";
import { useRecommendationContext } from "@/context/RecommendationContext";
import { useAuth } from "@/hooks/useAuth";
import { useMemberCurrentSupplements } from "@/hooks/useMemberCurrentSupplements";
import { SupplementSearch } from "@/components/supplements/SupplementSearch";
import { CurrentSupplementCard } from "@/components/supplements/CurrentSupplementCard";

export default function CurrentSupplementsSection() {
  const { saveSection } = useRecommendationContext();
  const { user } = useAuth();
  const { supplements, addSupplement, removeSupplement, saveSupplements, saving } =
    useMemberCurrentSupplements();

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const alreadyAddedIds = new Set(supplements.map((s) => s.productId));

  const handleSave = async () => {
    setSaveError(null);
    const { error } = await saveSupplements();
    if (error) { setSaveError(error.message); return; }
    saveSection("supplements");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <section id="supplements" className="px-4 pt-8 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
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

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Save Supplements"}
            </button>

            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <Check size={14} strokeWidth={3} />
                Saved{user ? " to your account" : " locally"}
              </span>
            )}

            {saveError && (
              <span className="text-sm text-destructive">{saveError}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
