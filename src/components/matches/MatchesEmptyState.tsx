import { Target } from "lucide-react";
import { SECTION_IDS, SECTION_LABELS, type SectionKey } from "@/context/RecommendationContext";

interface MatchesEmptyStateProps {
  /** Sections that have already been saved */
  savedSections: Set<SectionKey>;
}

const ALL_SECTIONS: SectionKey[] = ["goals", "profile", "supplements", "approach"];

/**
 * Shown in the Matches section when no personalization has started.
 * Provides jump-links to all 4 personalization sections.
 */
export function MatchesEmptyState({ savedSections }: MatchesEmptyStateProps) {
  const unsaved = ALL_SECTIONS.filter((s) => !savedSections.has(s));

  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Target size={28} className="text-primary" />
      </div>
      <h3 className="font-heading text-xl text-foreground mb-2">
        Start personalizing to see your matches
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-8">
        Tell us about your health goals and profile so we can recommend the right
        supplements for you.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {unsaved.map((section) => (
          <a
            key={section}
            href={`#${SECTION_IDS[section]}`}
            className="rounded-lg border border-primary/40 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            {SECTION_LABELS[section]} →
          </a>
        ))}
      </div>
    </div>
  );
}
