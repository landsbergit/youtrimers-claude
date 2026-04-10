import { useState } from "react";
import { ExternalLink, Package } from "lucide-react";
import type { RankedProduct } from "@/types/engine";
import { useCart } from "@/context/CartContext";
import { MatchScoreBar } from "./MatchScoreBar";
import { NutrientMatchPill } from "./NutrientMatchPill";
import { ExtraIngredientsPill } from "./ExtraIngredientsPill";
import { AddToCartButton } from "./AddToCartButton";

interface BundleCardProps {
  rank: number;
  rankedProduct: RankedProduct;
  nutrientNames: Map<string, string>;
}

export function BundleCard({ rank, rankedProduct, nutrientNames }: BundleCardProps) {
  const { products, score, matchedNutrientNodeIds, missedNutrientNodeIds, extraIngredientNames } = rankedProduct;
  const { isInCart } = useCart();
  const allInCart = products.every((p) => isInCart(p.id));

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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
      className={`rounded-xl border p-4 transition-colors ${
        allInCart
          ? "bg-[#E3EFE9] border-[#22A68C]"
          : "bg-card border-border hover:border-primary/40"
      }`}
    >
      {/* Header row: rank + bundle label + images + score */}
      <div className="flex items-start gap-3">
        {/* Stacked thumbnails */}
        <div className="flex-shrink-0 flex items-center">
          {products.map((p, i) => (
            <div
              key={p.id}
              className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border"
              style={{ marginLeft: i > 0 ? "-8px" : 0, zIndex: products.length - i }}
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.productName}
                  className="w-full h-full object-contain p-0.5"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[9px]">
                  No img
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

      {/* Per-product rows */}
      <div className="mt-3 space-y-2.5">
        {products.map((p, i) => {
          const cps = (p.costUsd / p.servingsPerContainer).toFixed(2);
          const titleExpanded = expandedIndex === i;
          return (
            <div key={p.id} className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground w-4 flex-shrink-0 mt-0.5">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    onClick={() => setExpandedIndex(titleExpanded ? null : i)}
                    className={`text-sm font-medium text-foreground leading-snug min-h-[2.5rem] cursor-pointer select-none ${
                      titleExpanded ? "" : "line-clamp-2"
                    }`}
                  >
                    {p.productName}
                  </p>
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

      {/* Nutrient pills */}
      {(allNutrients.length > 0 || extraIngredientNames.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allNutrients.map(({ id, matched }) => (
            <NutrientMatchPill
              key={id}
              label={nutrientNames.get(id) ?? id}
              matched={matched}
            />
          ))}
          <ExtraIngredientsPill names={extraIngredientNames} />
        </div>
      )}

      {/* Per-product cart controls */}
      <div className="mt-3 pt-3 border-t border-border space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
              {p.productName}
            </span>
            <AddToCartButton product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
