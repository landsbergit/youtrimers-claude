import { useState, useRef } from "react";
import { ExternalLink, Package, Check, ShoppingCart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RankedProduct } from "@/types/engine";
import { useCart } from "@/context/CartContext";
import { MatchScoreBar } from "./MatchScoreBar";
import { NutrientMatchPill } from "./NutrientMatchPill";

interface BundleCardProps {
  rank: number;
  rankedProduct: RankedProduct;
  nutrientNames: Map<string, string>;
  nutrientDescriptions: Map<string, string>;
}

export function BundleCard({ rank, rankedProduct, nutrientNames, nutrientDescriptions }: BundleCardProps) {
  const { products, score, matchedNutrientNodeIds, missedNutrientNodeIds, extraIngredientNames, matchedPreferenceTags, matchedRestrictionFreeTags, matchedReligiousTags } = rankedProduct;
  const { isInCart, addToCart } = useCart();
  const allInCart = products.every((p) => isInCart(p.id));

  const handleAddBundle = () => {
    for (const p of products) {
      addToCart({
        productId: p.id,
        productName: p.productName,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
        costUsd: p.costUsd,
        servingsPerContainer: p.servingsPerContainer,
        normalizedDosageForm: p.normalizedDosageForm,
      });
    }
  };

  const [popupIndex, setPopupIndex] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const openPopup = (i: number) => {
    clearTimeout(closeTimer.current);
    setPopupIndex(i);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setPopupIndex(null), 80);
  };

  const allNutrients = [
    ...matchedNutrientNodeIds.map((id) => ({ id, matched: true })),
    ...missedNutrientNodeIds.map((id) => ({ id, matched: false })),
  ].slice(0, 6);

  const combinedCostPerServing = products.reduce(
    (sum, p) => sum + p.costUsd / p.servingsPerContainer,
    0,
  );
  const combinedTotal = products.reduce((sum, p) => sum + p.costUsd, 0);

  return (
    <div
      className={`rounded-xl border p-4 transition-colors h-full flex flex-col ${
        allInCart
          ? "bg-[#E3EFE9] border-[#22A68C]"
          : "bg-card border-border hover:border-primary/40"
      }`}
    >
      {/* Header row: rank + bundle label + images + score */}
      <div className="flex items-start gap-3">
        {/* Stacked thumbnails with hover-zoom popup */}
        <div className="flex-shrink-0 flex items-center">
          {products.map((p, i) => (
            <div
              key={p.id}
              className="relative"
              style={{ marginLeft: i > 0 ? "-8px" : 0, zIndex: popupIndex === i ? 60 : products.length - i }}
            >
              <div
                className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border cursor-zoom-in"
                onMouseEnter={p.imageUrl ? () => openPopup(i) : undefined}
                onMouseLeave={p.imageUrl ? scheduleClose : undefined}
              >
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.productName}
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[9px]">
                    No img
                  </div>
                )}
              </div>

              {/* Enlarged popup */}
              {popupIndex === i && p.imageUrl && (
                <div
                  className="absolute -top-8 left-14 z-50 w-80 h-80 rounded-xl border border-border bg-card shadow-2xl p-2"
                  onMouseEnter={() => openPopup(i)}
                  onMouseLeave={scheduleClose}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.productName}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Score + bundle badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">
              #{rank}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-xs font-medium text-primary">
              <Package size={10} />
              Bundle · {products.length} products
            </span>
          </div>
          <MatchScoreBar score={score} />
        </div>
      </div>

      {/* Per-product rows with per-product tags and ingredients */}
      <div className="mt-3 space-y-3 flex-1">
        {products.map((p, i) => {
          const cps = (p.costUsd / p.servingsPerContainer).toFixed(2);
          const productTags = new Set(p.normalizedTags ?? []);

          // Per-product preference tags
          const prodPrefTags = matchedPreferenceTags.filter((tag) => productTags.has(tag));
          // Per-product restriction "Free" tags
          const prodFreeTags = matchedRestrictionFreeTags.filter((tag) => productTags.has(tag));
          const prodReligiousTags = matchedReligiousTags.filter((tag) => productTags.has(tag));

          return (
            <div key={p.id}>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-4 flex-shrink-0 mt-0.5">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-medium text-foreground leading-snug truncate">
                            {p.productName}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs rounded-full px-4 py-2">
                          <p>{p.productName}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {p.productUrl && (
                      <a
                        href={p.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5"
                        aria-label="View product"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">${cps}/serving</span>
                    {" · "}${p.costUsd.toFixed(2)}/bottle
                    {p.normalizedDosageForm && (
                      <span className="ml-1 capitalize">
                        · {p.normalizedDosageForm.toLowerCase()}
                      </span>
                    )}
                  </p>
                  {/* Per-product tags */}
                  {(prodPrefTags.length > 0 || prodFreeTags.length > 0 || prodReligiousTags.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {prodPrefTags.map((tag) => (
                        <span
                          key={`pref-${tag}`}
                          className="inline-flex items-center rounded-full bg-[#E8A838]/10 border border-[#E8A838]/30 px-2.5 py-0.5 text-xs font-medium text-[#B07D1A]"
                        >
                          {tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      ))}
                      {prodFreeTags.map((tag) => (
                        <span
                          key={`free-${tag}`}
                          className="inline-flex items-center rounded-full bg-[#11192A]/5 border border-[#11192A]/20 px-2.5 py-0.5 text-xs font-medium text-[#11192A]/70"
                        >
                          {tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      ))}
                      {prodReligiousTags.map((tag) => (
                        <span
                          key={`rel-${tag}`}
                          className="inline-flex items-center rounded-full bg-primary/10 border border-primary/30 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Combined price summary */}
      <div className="mt-3 rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>Combined</span>
        <span>
          <span className="font-medium text-foreground">
            ${combinedCostPerServing.toFixed(2)}/serving
          </span>
          {" · "}${combinedTotal.toFixed(2)} total
        </span>
      </div>

      {/* Bundle-level nutrient match pills */}
      {allNutrients.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {allNutrients.map(({ id, matched }) => (
              <NutrientMatchPill
                key={id}
                label={nutrientNames.get(id) ?? id}
                matched={matched}
                tooltip={nutrientDescriptions.get(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Single bundle cart control — pushed to bottom */}
      <div className="mt-3 pt-3 border-t border-border">
        {allInCart ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Check size={12} strokeWidth={3} />
            Bundle in cart
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAddBundle}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <ShoppingCart size={13} />
            Add to cart
          </button>
        )}
      </div>
    </div>
  );
}
