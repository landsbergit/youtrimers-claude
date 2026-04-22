import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MatchScoreBarProps {
  score: number; // 0–1
  /** Nutrient display names this product covers */
  matchedNutrients?: string[];
  /** Nutrient display names this product misses */
  missedNutrients?: string[];
  /** Food preference tags that boosted this product */
  preferenceTags?: string[];
  /** Restriction "Free" tags that boosted this product */
  restrictionTags?: string[];
  /** Religious tags matched */
  religiousTags?: string[];
  /** Whether goals are selected (nutrient scoring active) */
  hasGoals?: boolean;
  /** Member's gender if set */
  gender?: string | null;
  /** Member's age tag if set */
  ageTag?: string | null;
  /** All selected food preference tag names (to compute unmatched) */
  allSelectedPreferences?: string[];
  /** All selected food restriction tag names (to compute unmatched) */
  allSelectedRestrictions?: string[];
  /** All selected religious tag names (to compute unmatched) */
  allSelectedReligious?: string[];
}

function formatTag(tag: string): string {
  return tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTooltip({
  score,
  matchedNutrients = [],
  missedNutrients = [],
  preferenceTags = [],
  restrictionTags = [],
  religiousTags = [],
  hasGoals = false,
  gender,
  ageTag,
}: MatchScoreBarProps): string {
  const pct = Math.round(score * 100);
  const lines: string[] = [];

  if (hasGoals) {
    // General sentence
    const total = matchedNutrients.length + missedNutrients.length;
    if (total > 0) {
      lines.push(`${pct}% match — covers ${matchedNutrients.length} of ${total} required nutrients.`);
    } else {
      lines.push(`${pct}% match to your profile.`);
    }

    // Specific nutrients
    if (matchedNutrients.length > 0) {
      lines.push(`Covers: ${matchedNutrients.join(", ")}.`);
    }
    if (missedNutrients.length > 0) {
      lines.push(`Missing: ${missedNutrients.join(", ")}.`);
    }
  } else {
    // No goals — demographic/preference scoring only
    const profileParts: string[] = [];
    if (gender) profileParts.push(gender === "FEMALE" ? "Female" : gender === "MALE" ? "Male" : "");
    if (ageTag) profileParts.push(formatTag(ageTag));

    if (profileParts.filter(Boolean).length > 0) {
      lines.push(`${pct}% profile match based on: ${profileParts.filter(Boolean).join(", ")}.`);
    } else {
      lines.push(`${pct}% — no personalization applied yet.`);
    }
    lines.push("Select a health goal for nutrient-based scoring.");
  }

  // Boosts
  const boosts: string[] = [];
  if (preferenceTags.length > 0) boosts.push(...preferenceTags.map(formatTag));
  if (restrictionTags.length > 0) boosts.push(...restrictionTags.map(formatTag));
  if (religiousTags.length > 0) boosts.push(...religiousTags.map(formatTag));
  if (gender && hasGoals) {
    const genderLabel = gender === "FEMALE" ? "Female" : gender === "MALE" ? "Male" : "";
    if (genderLabel) boosts.push(genderLabel);
  }

  if (boosts.length > 0) {
    lines.push(`Boosted for: ${boosts.join(", ")}.`);
  }

  // Unmatched — what reduced the score
  const {
    allSelectedPreferences = [],
    allSelectedRestrictions = [],
    allSelectedReligious = [],
  } = arguments[0] as MatchScoreBarProps;

  const matchedPrefSet = new Set(preferenceTags);
  const matchedRestSet = new Set(restrictionTags);
  const matchedRelSet = new Set(religiousTags);

  const unmatched: string[] = [];
  for (const t of allSelectedPreferences) {
    if (!matchedPrefSet.has(t)) unmatched.push(formatTag(t));
  }
  for (const t of allSelectedRestrictions) {
    if (!matchedRestSet.has(t)) unmatched.push(formatTag(t));
  }
  for (const t of allSelectedReligious) {
    if (!matchedRelSet.has(t)) unmatched.push(formatTag(t));
  }

  if (unmatched.length > 0) {
    lines.push(`Not matched: ${unmatched.join(", ")}.`);
  }

  return lines.join("\n");
}

/**
 * A thin horizontal bar showing match quality with a descriptive tooltip.
 * Colour: green ≥ 0.7, amber 0.4–0.7, muted < 0.4.
 */
export function MatchScoreBar(props: MatchScoreBarProps) {
  const { score } = props;
  const pct = Math.round(score * 1000) / 10;

  const colour =
    pct >= 70
      ? "bg-success"
      : pct >= 40
      ? "bg-warning"
      : "bg-muted-foreground/40";

  const tooltipText = buildTooltip(props);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default">
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${colour}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground w-10 text-right">
              {pct}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-line">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
