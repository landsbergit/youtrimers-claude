import { X } from "lucide-react";
import type { Goal } from "@/types/goals";

interface SelectedGoalsBarProps {
  selectedGoals: Goal[];
  onRemoveGoal: (goalId: string) => void;
  onDone: () => void;
}

/**
 * Displays the currently selected goals as removable pills,
 * with a "Done" button when at least one goal is selected.
 */
export function SelectedGoalsBar({ selectedGoals, onRemoveGoal, onDone }: SelectedGoalsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-8 mt-4">
      <span className="font-semibold text-foreground text-sm">Selected Goals:</span>

      {selectedGoals.length === 0 ? (
        <span className="text-muted-foreground text-sm">None</span>
      ) : (
        selectedGoals.map((goal) => (
          <span
            key={goal.id}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary bg-card px-4 py-1.5 text-sm font-medium text-primary"
          >
            {goal.name}
            <button
              onClick={() => onRemoveGoal(goal.id)}
              className="ml-1 text-destructive hover:text-destructive/80 transition-colors"
              aria-label={`Remove ${goal.name}`}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </span>
        ))
      )}

      {selectedGoals.length > 0 && (
        <button
          onClick={onDone}
          className="ml-auto rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Done
        </button>
      )}
    </div>
  );
}
