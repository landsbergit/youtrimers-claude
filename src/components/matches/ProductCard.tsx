import { useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { RankedProduct } from "@/types/engine";
import { useCart } from "@/context/CartContext";
import { MatchScoreBar } from "./MatchScoreBar";
import { NutrientMatchPill } from "./NutrientMatchPill";
import { ExtraIngredientsPill } from "./ExtraIngredientsPill";
import { AddToCartButton } from "./AddToCartButton";

interface ProductCardProps {
  rank: number;
  rankedProduct: RankedProduct;
  /** Map from ontology node UUID → display_name for labelling nutrient pills */
  nutrientNames: Map<string, string>;
  /** Map from ontology node UUID → tooltip text (joined rule descriptions) */
  nutrientDescriptions: Map<string, string>;
}

export function ProductCard({ rank, rankedProduct, nutrientNames, nutrientDescriptions }: ProductCardProps) {
  const { products, score, matchedNutrientNodeIds, missedNutrientNodeIds, extraIngredientNames } = rankedProduct;
  const product = products[0];
  const { isInCart } = useCart();
  const inCart = isInCart(product.id);
  const [popupOpen, setPopupOpen] = useState(false);
  const [titleExpanded, setTitleExpanded] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  // Show at most 6 nutrient pills to keep the card compact
  const allNutrients = [
    ...matchedNutrientNodeIds.map((id) => ({ id, matched: true })),
    ...missedNutrientNodeIds.map((id) => ({ id, matched: false })),
  ].slice(0, 6);

  const openPopup = () => {
    clearTimeout(closeTimer.current);
    setPopupOpen(true);
  };

  const scheduleClose = () => {
    // Small delay so moving from thumbnail → popup doesn't flicker
    closeTimer.current = setTimeout(() => setPopupOpen(false), 80);
  };

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      inCart
        ? "bg-[#E3EFE9] border-[#22A68C]"
        : "bg-card border-border hover:border-primary/40"
    }`}>
      <div className="flex gap-4">
        {/* Product image with hover zoom popup */}
        <div className="relative flex-shrink-0">
          <div
            className="w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border cursor-zoom-in"
            onMouseEnter={product.imageUrl ? openPopup : undefined}
            onMouseLeave={product.imageUrl ? scheduleClose : undefined}
          >
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.productName}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                No img
              </div>
            )}
          </div>

          {/* Enlarged popup — extends beyond card boundaries via z-50 */}
          {popupOpen && product.imageUrl && (
            <div
              className="absolute -top-8 left-20 z-50 w-80 h-80 rounded-xl border border-border bg-card shadow-2xl p-2"
              onMouseEnter={openPopup}
              onMouseLeave={scheduleClose}
            >
              <img
                src={product.imageUrl}
                alt={product.productName}
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Name + score */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">
                #{rank}
              </span>
              <p
                onClick={() => setTitleExpanded((v) => !v)}
                className={`text-sm font-medium text-foreground leading-snug min-h-[2.5rem] cursor-pointer select-none ${
                  titleExpanded ? "" : "line-clamp-2"
                }`}
              >
                {product.productName}
              </p>
            </div>
            {product.productUrl && (
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                aria-label="View product"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          <div className="mt-2">
            <MatchScoreBar score={score} />
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium text-foreground">
              ${(product.costUsd / product.servingsPerContainer).toFixed(2)}/serving
              <span className="font-normal"> · </span>
            </span>
            ${product.costUsd.toFixed(2)} total
            {product.normalizedDosageForm && (
              <span className="ml-2 capitalize">
                · {product.normalizedDosageForm.toLowerCase()}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Nutrient match pills + extra ingredients */}
      {(allNutrients.length > 0 || extraIngredientNames.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allNutrients.map(({ id, matched }) => (
            <NutrientMatchPill
              key={id}
              label={nutrientNames.get(id) ?? id}
              matched={matched}
              tooltip={nutrientDescriptions.get(id)}
            />
          ))}
          <ExtraIngredientsPill names={extraIngredientNames} />
        </div>
      )}

      {/* Cart control */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <AddToCartButton product={product} />
      </div>
    </div>
  );
}
