import { useRef, useState } from "react";
import { ExternalLink, ZoomIn } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RankedProduct } from "@/types/engine";
import { useCart } from "@/context/CartContext";
import { useRecommendationContext } from "@/context/RecommendationContext";
import { MatchScoreBar } from "./MatchScoreBar";
import { NutrientMatchPill } from "./NutrientMatchPill";
import { ExtraIngredientsPill } from "./ExtraIngredientsPill";
import { AddToCartButton } from "./AddToCartButton";

interface ProductCardProps {
  rank: number;
  rankedProduct: RankedProduct;
  nutrientNames: Map<string, string>;
  nutrientDescriptions: Map<string, string>;
  hasGoals?: boolean;
  gender?: string | null;
  ageTag?: string | null;
  allSelectedPreferences?: string[];
  allSelectedRestrictions?: string[];
  allSelectedReligious?: string[];
  /** Hide the "Find similar" button (e.g. when already in similar mode). */
  hideFindSimilar?: boolean;
}

export function ProductCard({ rank, rankedProduct, nutrientNames, nutrientDescriptions, hasGoals, gender, ageTag, allSelectedPreferences, allSelectedRestrictions, allSelectedReligious, hideFindSimilar }: ProductCardProps) {
  const { products, score, matchedNutrientNodeIds, missedNutrientNodeIds, extraIngredientNames, matchedPreferenceTags, matchedRestrictionFreeTags, matchedReligiousTags } = rankedProduct;
  const product = products[0];
  const { isInCart } = useCart();
  const { setSimilarAnchor } = useRecommendationContext();
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
    <div className={`rounded-xl border p-4 transition-colors h-full flex flex-col ${
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
                className="w-full h-full object-contain rounded-lg"
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
              {rank > 0 && (
                <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">
                  #{rank}
                </span>
              )}
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p
                      onClick={() => setTitleExpanded((v) => !v)}
                      className={`text-sm font-medium text-foreground leading-snug cursor-pointer select-none ${
                        titleExpanded ? "" : "line-clamp-2"
                      }`}
                    >
                      {product.productName}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs rounded-full px-4 py-2">
                    <p>{product.productName}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
            <MatchScoreBar
              score={score}
              matchedNutrients={matchedNutrientNodeIds.map((id) => nutrientNames.get(id) ?? id)}
              missedNutrients={missedNutrientNodeIds.map((id) => nutrientNames.get(id) ?? id)}
              preferenceTags={matchedPreferenceTags}
              restrictionTags={matchedRestrictionFreeTags}
              religiousTags={matchedReligiousTags}
              hasGoals={hasGoals}
              gender={gender}
              ageTag={ageTag}
              allSelectedPreferences={allSelectedPreferences}
              allSelectedRestrictions={allSelectedRestrictions}
              allSelectedReligious={allSelectedReligious}
            />
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

      {/* Nutrient match pills + extra ingredients + preference tags */}
      <div className="mt-3 flex-1">
        {(allNutrients.length > 0 || extraIngredientNames.length > 0 || matchedPreferenceTags.length > 0 || matchedRestrictionFreeTags.length > 0 || matchedReligiousTags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {allNutrients.map(({ id, matched }) => (
              <NutrientMatchPill
                key={id}
                label={nutrientNames.get(id) ?? id}
                matched={matched}
                tooltip={nutrientDescriptions.get(id)}
              />
            ))}
            <ExtraIngredientsPill names={extraIngredientNames} />
            {matchedPreferenceTags.map((tag) => (
              <span
                key={`pref-${tag}`}
                className="inline-flex items-center rounded-full bg-[#E8A838]/10 border border-[#E8A838]/30 px-2.5 py-0.5 text-xs font-medium text-[#B07D1A]"
              >
                {tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            ))}
            {matchedRestrictionFreeTags.map((tag) => (
              <span
                key={`free-${tag}`}
                className="inline-flex items-center rounded-full bg-[#E8A838]/10 border border-[#E8A838]/30 px-2.5 py-0.5 text-xs font-medium text-[#B07D1A]"
              >
                {tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            ))}
            {matchedReligiousTags.map((tag) => (
              <span
                key={`rel-${tag}`}
                className="inline-flex items-center rounded-full bg-[#E8A838]/10 border border-[#E8A838]/30 px-2.5 py-0.5 text-xs font-medium text-[#B07D1A]"
              >
                {tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Cart control — pushed to bottom */}
      <div className={`mt-3 pt-3 border-t border-border flex items-center gap-2 ${hideFindSimilar ? "justify-end" : "justify-between"}`}>
        {!hideFindSimilar && (
          <button
            type="button"
            onClick={() => setSimilarAnchor(rankedProduct)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
            aria-label="Find similar products"
          >
            <ZoomIn size={13} />
            Find similar
          </button>
        )}
        <AddToCartButton product={product} />
      </div>
    </div>
  );
}
