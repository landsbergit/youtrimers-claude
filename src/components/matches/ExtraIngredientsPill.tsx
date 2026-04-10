import { useState, useRef } from "react";

interface ExtraIngredientsPillProps {
  names: string[];
}

/**
 * Pill showing how many linked ingredients in a product go beyond the current
 * nutrient requirements. Hovering reveals the actual ingredient names.
 */
export function ExtraIngredientsPill({ names }: ExtraIngredientsPillProps) {
  if (names.length === 0) return null;

  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  };

  // Format names: replace underscores with spaces, title-case
  const formatted = names.map((n) =>
    n
      .split("|")[0]                          // take first part of pipe-separated names
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
  );

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors cursor-default"
      >
        +{names.length} other ingredient{names.length !== 1 ? "s" : ""}
      </button>

      {open && (
        <div
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-xl border border-border bg-popover shadow-xl p-3"
        >
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Additional ingredients
          </p>
          <ul className="space-y-0.5 max-h-48 overflow-y-auto">
            {formatted.map((name, i) => (
              <li key={i} className="text-xs text-foreground">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
