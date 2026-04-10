import { Check, X } from "lucide-react";

interface NutrientMatchPillProps {
  label: string;
  matched: boolean;
}

/**
 * Small pill showing whether a required nutrient is present in the product.
 */
export function NutrientMatchPill({ label, matched }: NutrientMatchPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
        matched
          ? "border-success/40 bg-success/10 text-success"
          : "border-border bg-muted/50 text-muted-foreground line-through"
      }`}
    >
      {matched ? (
        <Check size={10} strokeWidth={3} />
      ) : (
        <X size={10} strokeWidth={3} />
      )}
      {label}
    </span>
  );
}
