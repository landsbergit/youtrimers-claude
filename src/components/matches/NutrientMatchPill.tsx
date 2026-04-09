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
          ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
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
