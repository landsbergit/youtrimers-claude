import { Check, X } from "lucide-react";

interface NutrientMatchPillProps {
  label: string;
  matched: boolean;
  /** Tooltip text shown on hover — typically the rule description(s). Optional. */
  tooltip?: string;
}

/**
 * Small pill showing whether a required nutrient is present in the product.
 * If `tooltip` is provided, hovering reveals it in a floating callout above the pill.
 */
export function NutrientMatchPill({ label, matched, tooltip }: NutrientMatchPillProps) {
  const pill = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
        matched
          ? "border-success/40 bg-success/10 text-success"
          : "border-border bg-muted/50 text-muted-foreground line-through"
      } ${tooltip ? "cursor-help" : ""}`}
    >
      {matched ? (
        <Check size={10} strokeWidth={3} />
      ) : (
        <X size={10} strokeWidth={3} />
      )}
      {label}
    </span>
  );

  if (!tooltip) return pill;

  return (
    <span className="relative group/pill inline-flex">
      {pill}
      {/* Tooltip — appears above the pill on hover */}
      <span
        className="
          pointer-events-none
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          z-50 w-56
          rounded-lg border border-border bg-popover shadow-lg
          px-3 py-2 text-xs text-popover-foreground leading-relaxed
          opacity-0 group-hover/pill:opacity-100
          transition-opacity duration-150
          whitespace-pre-line
        "
      >
        {tooltip}
        {/* Arrow pointing down */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
      </span>
    </span>
  );
}
