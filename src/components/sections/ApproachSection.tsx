import { useState } from "react";
import { Info, Tag, Shuffle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRecommendationContext } from "@/context/RecommendationContext";

// The three discrete positions and their qualityWeight values
const DISCRETE_OPTIONS = [
  { label: "Price", value: 0.1 },
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative inline-flex items-center select-none cursor-default pr-2">
          <span className="text-sm font-medium text-foreground">{text}</span>
          <Info size={10} className="absolute -top-1 -right-0.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const DIVERSITY_OPTIONS: { value: number; label: string; title: string }[] = [
  { value: 0, label: "Focused", title: "Show the highest-scoring results (no diversity re-ranking)" },
  { value: 0.5, label: "Balanced", title: "Balance relevance with variety" },
  { value: 1, label: "Diverse", title: "Maximise variety across brands and nutrients" },
];

export default function ApproachSection() {
  const { qualityWeight, setQualityWeight, diversityWeight, setDiversityWeight, saveSection } = useRecommendationContext();

  const [isPrecise, setIsPrecise] = useState(false);
  const [showDiversitySlider, setShowDiversitySlider] = useState(false);
  const activeDiversityOption = DIVERSITY_OPTIONS.find((o) => o.value === diversityWeight) ?? null;

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
    <div id="approach">
      <TooltipProvider delayDuration={300}>
        {/* ── Price / Quality ── */}
        <div className="space-y-1.5 mt-2">
          <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
            <Tag size={16} className="text-[#22A68C] flex-shrink-0" />
            Sort Products by{" "}
            <TooltipLabel text="Price" tooltip={PRICE_TOOLTIP} />
            {" "}&amp;{" "}
            <TooltipLabel text="Quality" tooltip={QUALITY_TOOLTIP} />
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            {isPrecise ? (
              <>
                <div className="flex-1 min-w-[120px]">
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
                <span className="text-xs text-muted-foreground">
                  {Math.round(qualityWeight * 100)}% quality
                  {activeDiscrete ? ` · ${activeDiscrete.label}` : ""}
                </span>
                <button
                  type="button"
                  onClick={switchToDiscrete}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors whitespace-nowrap"
                >
                  Simplify
                </button>
              </>
            ) : (
              <>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {DISCRETE_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => handleDiscreteSelect(opt.value)}
                      className={`min-w-[60px] px-2.5 py-1 text-xs font-medium transition-colors border-r last:border-r-0 border-border ${
                        qualityWeight === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={switchToPrecise}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors whitespace-nowrap"
                >
                  Refine
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Diversity ── */}
        <div className="space-y-1.5 mt-4">
          <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
            <Shuffle size={16} className="text-[#22A68C] flex-shrink-0" />
            Diversity
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            {showDiversitySlider ? (
              <>
                <span className="text-xs text-muted-foreground w-14 text-right">
                  {activeDiversityOption?.label ?? `${Math.round(diversityWeight * 100)}%`}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={diversityWeight}
                  onChange={(e) => { setDiversityWeight(Number(e.target.value)); saveSection("approach"); }}
                  className="w-28 accent-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nearest = DIVERSITY_OPTIONS.reduce((best, opt) =>
                      Math.abs(opt.value - diversityWeight) < Math.abs(best.value - diversityWeight) ? opt : best
                    );
                    setDiversityWeight(nearest.value);
                    setShowDiversitySlider(false);
                  }}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Simplify
                </button>
              </>
            ) : (
              <>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {DIVERSITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.title}
                      onClick={() => { setDiversityWeight(opt.value); saveSection("approach"); }}
                      className={`min-w-[60px] px-2.5 py-1 text-xs font-medium transition-colors border-r last:border-r-0 border-border whitespace-nowrap ${
                        diversityWeight === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiversitySlider(true)}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Refine
                </button>
              </>
            )}
          </div>
        </div>

      </TooltipProvider>
    </div>
  );
}
