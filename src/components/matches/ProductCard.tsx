import { ExternalLink } from "lucide-react";
import type { RankedProduct } from "@/types/engine";
import { MatchScoreBar } from "./MatchScoreBar";
import { NutrientMatchPill } from "./NutrientMatchPill";

interface ProductCardProps {
  rank: number;
  rankedProduct: RankedProduct;
  /** Map from ontology node UUID → display_name for labelling nutrient pills */
  nutrientNames: Map<string, string>;
}

export function ProductCard({ rank, rankedProduct, nutrientNames }: ProductCardProps) {
  const { product, score, matchedNutrientNodeIds, missedNutrientNodeIds } = rankedProduct;

  // Show at most 6 nutrient pills to keep the card compact
  const allNutrients = [
    ...matchedNutrientNodeIds.map((id) => ({ id, matched: true })),
    ...missedNutrientNodeIds.map((id) => ({ id, matched: false })),
  ].slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
      <div className="flex gap-4">
        {/* Product image */}
        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted border border-border">
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

        {/* Name + score */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">
                #{rank}
              </span>
              <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
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

          {product.costUsd != null && (
            <p className="text-xs text-muted-foreground mt-1">
              ${product.costUsd.toFixed(2)}
              {product.normalizedDosageForm && (
                <span className="ml-2 capitalize">
                  · {product.normalizedDosageForm.toLowerCase()}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Nutrient match pills */}
      {allNutrients.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allNutrients.map(({ id, matched }) => (
            <NutrientMatchPill
              key={id}
              label={nutrientNames.get(id) ?? id}
              matched={matched}
            />
          ))}
        </div>
      )}
    </div>
  );
}
