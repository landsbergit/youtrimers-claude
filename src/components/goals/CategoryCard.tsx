import { useRef, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import type { Goal } from "@/types/goals";
import { GoalPillRow } from "./GoalPillRow";

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

interface CategoryCardProps {
  name: string;
  icon: React.ElementType;
  goals: Goal[];
  isExpanded: boolean;
  /** 2 on mobile/tablet, 3 on desktop */
  collapsedCount: number;
  isSelected: (id: string) => boolean;
  onToggleGoal: (goal: Goal) => void;
  onExpandToggle: () => void;
  onClickOutside: () => void;
}

/**
 * Displays a single goal category card.
 *
 * Collapsed: shows up to `collapsedCount` goals, then a "More..." button.
 * Expanded:  shows all goals in rows of EXPANDED_GOALS_PER_ROW, plus a "Less" button.
 * Clicking outside an expanded card collapses it.
 */
export function CategoryCard({
  name,
  icon: Icon,
  goals,
  isExpanded,
  collapsedCount,
  isSelected,
  onToggleGoal,
  onExpandToggle,
  onClickOutside,
}: CategoryCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasGoals = goals.length > 0;
  const showMore = hasGoals && goals.length > collapsedCount;
  const visibleGoals = isExpanded ? goals : goals.slice(0, collapsedCount);

  // Close when clicking outside this card
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded, onClickOutside]);

  // Empty state — category exists but no goals in DB yet
  if (!hasGoals) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Icon size={28} className="text-primary" />
          <h3 className="font-heading text-primary text-xl">{name}</h3>
        </div>
        <p className="text-muted-foreground italic text-sm">Coming up</p>
      </div>
    );
  }

  return (
    <div ref={cardRef} className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <Icon size={28} className="text-primary" />
        <h3 className="font-heading text-primary text-xl">{name}</h3>
      </div>

      {isExpanded ? (
        // All goals in rows of collapsedCount (same width as the collapsed row — guaranteed to fit)
        <div>
          {chunkArray(goals, collapsedCount).map((row, rowIdx) => (
            <GoalPillRow
              key={rowIdx}
              goals={row}
              isSelected={isSelected}
              onToggle={onToggleGoal}
            />
          ))}
          <button
            onClick={onExpandToggle}
            className="mt-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <ChevronUp size={16} />
            Less
          </button>
        </div>
      ) : (
        // Collapsed: up to collapsedCount goals + optional "More..." button
        <GoalPillRow
          goals={visibleGoals}
          isSelected={isSelected}
          onToggle={onToggleGoal}
          showMore={showMore}
          onMore={onExpandToggle}
        />
      )}
    </div>
  );
}
