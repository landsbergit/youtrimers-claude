import type { Goal } from "@/types/goals";

interface GoalPillRowProps {
  goals: Goal[];
  isSelected: (id: string) => boolean;
  onToggle: (goal: Goal) => void;
  /** Show a "More..." button at the end of the row */
  showMore?: boolean;
  onMore?: () => void;
}

/**
 * A single horizontal pill bar containing goal buttons.
 * Dividers are rendered between segments and before the "More..." button.
 */
export function GoalPillRow({ goals, isSelected, onToggle, showMore, onMore }: GoalPillRowProps) {
  return (
    <div className="flex rounded-full border border-border overflow-hidden mb-2">
      {goals.map((goal, idx) => {
        const selected = isSelected(goal.id);
        const needsDividerAfter = idx < goals.length - 1 || showMore;

        return (
          <div key={goal.id} className="flex">
            <button
              onClick={() => onToggle(goal)}
              className={`relative px-4 py-2.5 text-sm text-center transition-colors min-w-[100px] flex-1 ${
                selected
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-muted/50"
              }`}
            >
              {selected && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-primary">
                  ✓
                </span>
              )}
              {goal.name}
            </button>

            {needsDividerAfter && (
              <div className="w-px bg-border self-stretch" />
            )}
          </div>
        );
      })}

      {showMore && (
        <button
          onClick={onMore}
          className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          More...
        </button>
      )}
    </div>
  );
}
