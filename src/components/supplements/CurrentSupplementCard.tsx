import { useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import type { CurrentSupplement } from "@/hooks/useMemberCurrentSupplements";

interface CurrentSupplementCardProps {
  supplement: CurrentSupplement;
  onRemove: (productId: number) => void;
}

export function CurrentSupplementCard({ supplement, onRemove }: CurrentSupplementCardProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [titleExpanded, setTitleExpanded] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const openPopup = () => {
    clearTimeout(closeTimer.current);
    setPopupOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setPopupOpen(false), 80);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
      <div className="flex gap-4">
        {/* Product image with hover zoom */}
        <div className="relative flex-shrink-0">
          <div
            className="w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border cursor-zoom-in"
            onMouseEnter={supplement.imageUrl ? openPopup : undefined}
            onMouseLeave={supplement.imageUrl ? scheduleClose : undefined}
          >
            {supplement.imageUrl ? (
              <img
                src={supplement.imageUrl}
                alt={supplement.productName}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                No img
              </div>
            )}
          </div>

          {popupOpen && supplement.imageUrl && (
            <div
              className="absolute -top-8 left-20 z-50 w-80 h-80 rounded-xl border border-border bg-card shadow-2xl p-2"
              onMouseEnter={openPopup}
              onMouseLeave={scheduleClose}
            >
              <img
                src={supplement.imageUrl}
                alt={supplement.productName}
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              onClick={() => setTitleExpanded((v) => !v)}
              className={`text-sm font-medium text-foreground leading-snug cursor-pointer select-none ${
                titleExpanded ? "" : "line-clamp-2"
              }`}
            >
              {supplement.productName}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {supplement.productUrl && (
                <a
                  href={supplement.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="View product"
                >
                  <ExternalLink size={14} />
                </a>
              )}
              <button
                type="button"
                onClick={() => onRemove(supplement.productId)}
                aria-label="Remove supplement"
                className="text-muted-foreground hover:text-destructive transition-colors rounded p-0.5 hover:bg-destructive/10"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {supplement.brand && (
            <p className="text-xs text-muted-foreground mt-0.5">{supplement.brand}</p>
          )}

          <p className="text-xs text-muted-foreground mt-1">
            {supplement.costUsd != null && (
              <span className="font-medium text-foreground">
                ${supplement.costUsd.toFixed(2)}
                <span className="font-normal text-muted-foreground"> total</span>
              </span>
            )}
            {supplement.normalizedDosageForm && (
              <span className={supplement.costUsd != null ? " · " : ""}>
                {supplement.normalizedDosageForm.charAt(0).toUpperCase() +
                  supplement.normalizedDosageForm.slice(1).toLowerCase()}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
