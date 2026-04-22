import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SimilarityExplanation } from "@/lib/engine/findSimilar";

interface SimilarityPillProps {
  explanation: SimilarityExplanation;
}

/**
 * Floating pill placed on top-left of a similar-mode card.
 * Shows a short summary ("Different brand", "Very similar", etc.)
 * and expands into a Different / Similar / Same breakdown on hover.
 */
export function SimilarityPill({ explanation }: SimilarityPillProps) {
  const { summary, same, similar, different } = explanation;

  const hasBody = same.length > 0 || similar.length > 0 || different.length > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="absolute -top-2 left-4 z-10 inline-flex items-center rounded-full bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold cursor-help"
            tabIndex={0}
          >
            {summary}
          </span>
        </TooltipTrigger>
        {hasBody && (
          <TooltipContent className="max-w-sm rounded-xl p-3 text-left">
            <div className="space-y-2.5 text-xs">
              {different.length > 0 && (
                <Section label="Different" lines={different} />
              )}
              {similar.length > 0 && (
                <Section label="Similar" lines={similar} />
              )}
              {same.length > 0 && (
                <Section label="Same" lines={same} />
              )}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function Section({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div>
      <p className="font-semibold mb-1">{label}</p>
      <ul className="space-y-0.5 pl-3">
        {lines.map((line, i) => (
          <li key={i} className="list-disc marker:text-muted-foreground/60">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
