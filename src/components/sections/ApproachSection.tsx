import { useState, useRef } from "react";
import { Info } from "lucide-react";
import { useRecommendationContext } from "@/context/RecommendationContext";

// The three discrete positions and their qualityWeight values
const DISCRETE_OPTIONS = [
  { label: "Budget", value: 0.1 },
  { label: "Balanced", value: 0.5 },
  { label: "Quality", value: 0.9 },
] as const;

const PRICE_TOOLTIP =
  "Price is measured as cost per serving, so a large bottle that lasts longer " +
  "compares fairly against a smaller one.";

const QUALITY_TOOLTIP =
  "Quality reflects how well a product's ingredients match your required nutrients, " +
  "and how beneficial the specific forms of those nutrients are " +
  "(e.g. active forms like P5P for B6 score higher than basic forms like pyridoxine HCl).";

// Snap a continuous value to the nearest discrete option
function snapToDiscrete(value: number): number {
  return DISCRETE_OPTIONS.reduce((nearest, opt) =>
    Math.abs(opt.value - value) < Math.abs(nearest - value) ? opt.value : nearest,
    DISCRETE_OPTIONS[0].value
  );
}

// ── Small tooltip wrapper ──────────────────────────────────────────────────────

function TooltipLabel({ text, tooltip }: { text: string; tooltip: string }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const show = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 100); };

  return (
    <span className="relative inline-flex items-center gap-1 select-none">
      <span className="text-sm font-medium text-foreground">{text}</span>
      <button
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`About ${text}`}
      >
        <Info size={13} />
      </button>
      {open && (
        <div
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-xl border border-border bg-popover shadow-xl p-3 text-xs text-muted-foreground leading-relaxed"
        >
          {tooltip}
        </div>
      )}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ApproachSection() {
  const { qualityWeight, setQualityWeight, saveSection } = useRecommendationContext();

  const [isPrecise, setIsPrecise] = useState(false);

  const handleDiscreteSelect = (value: number) => {
    setQualityWeight(value);
    saveSection("approach");
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQualityWeight(Number(e.target.value) / 100);
    saveSection("approach");
  };

  const switchToPrecise = () => setIsPrecise(true);

  const switchToDiscrete = () => {
    setQualityWeight(snapToDiscrete(qualityWeight));
    setIsPrecise(false);
  };

  const activeDiscrete = DISCRETE_OPTIONS.find((o) => o.value === qualityWeight);

  return (
    <section id="approach" className="px-4 pt-8 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2
          className="font-heading text-foreground text-3xl mb-3 cursor-default"
          title="Choose how to balance price and supplement quality when ranking matches."
        >
          Approach
        </h2>

        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">Sort Products by Price and Quality</span>

          <TooltipLabel text="Price" tooltip={PRICE_TOOLTIP} />

          {isPrecise ? (
            /* ── Continuous slider ── */
            <div className="flex-1 min-w-[140px]">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(qualityWeight * 100)}
                onChange={handleSliderChange}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
          ) : (
            /* ── Discrete 3-button control ── */
            <div className="flex rounded-lg border border-border overflow-hidden">
              {DISCRETE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleDiscreteSelect(opt.value)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0 border-border ${
                    qualityWeight === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <TooltipLabel text="Quality" tooltip={QUALITY_TOOLTIP} />

          {isPrecise ? (
            <button
              type="button"
              onClick={switchToDiscrete}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 whitespace-nowrap"
            >
              Less precision
            </button>
          ) : (
            <button
              type="button"
              onClick={switchToPrecise}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 whitespace-nowrap"
            >
              More precision
            </button>
          )}

          {isPrecise && (
            <span className="text-xs text-muted-foreground">
              {Math.round(qualityWeight * 100)}% quality
              {activeDiscrete ? ` · ${activeDiscrete.label}` : ""}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
