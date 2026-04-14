import { X } from "lucide-react";
import type { Goal } from "@/types/goals";

interface SelectedGoalsBarProps {
  selectedGoals: Goal[];
  onRemoveGoal: (goalId: string) => void;
  onDone: () => void;
}

/**
 * Displays the currently selected goals as removable pills.
 * "Save Goals" button is always right-aligned when at least one goal is selected.
 */
export function SelectedGoalsBar({ selectedGoals, onRemoveGoal, onDone }: SelectedGoalsBarProps) {
  return (
    <div className="flex items-center gap-3 mb-6 mt-2 flex-wrap">
      <span className="font-semibold text-foreground text-sm flex-shrink-0">
        Selected Goals:
      </span>

      <div className="flex flex-wrap items-center gap-2 flex-1">
        {selectedGoals.length === 0 ? (
          <span className="text-muted-foreground text-sm">None</span>
        ) : (
          selectedGoals.map((goal) => (
            <span
              key={goal.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {goal.display_name}
              <button
                onClick={() => onRemoveGoal(goal.id)}
                className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                aria-label={`Remove ${goal.display_name}`}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </span>
          ))
        )}
      </div>

      {selectedGoals.length > 0 && (
        <button
          onClick={onDone}
          className="flex-shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Save Goals
        </button>
      )}
    </div>
  );
}
