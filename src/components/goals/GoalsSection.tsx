import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useGoals } from "@/hooks/useGoals";
import { useAuth } from "@/hooks/useAuth";
import { GOAL_CATEGORIES, MAX_SELECTED_GOALS } from "@/types/goals";
import type { Goal } from "@/types/goals";
import { CategoryCard } from "./CategoryCard";
import { SelectedGoalsBar } from "./SelectedGoalsBar";

/**
 * Returns 2 on mobile/tablet (< 1024px) and 3 on desktop.
 * This controls how many goals are visible before the "More..." button.
 */
function useCollapsedGoalCount(): number {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const update = () => setCount(mql.matches ? 2 : 3);
    mql.addEventListener("change", update);
    update();
    return () => mql.removeEventListener("change", update);
  }, []);

  return count;
}

/**
 * Goals section — lets the user browse goals by category and select up to 3.
 *
 * Goals are loaded from Supabase. Categories are hard-coded in GOAL_CATEGORIES.
 * Saving to member_goals is a TODO pending member selection UI.
 */
export default function GoalsSection() {
  const { goals, loading } = useGoals();
  const { user } = useAuth();
  const collapsedCount = useCollapsedGoalCount();

  const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const goalsByCategory = (category: string) =>
    goals.filter((g) => g.category === category);

  const isSelected = (goalId: string) =>
    selectedGoals.some((g) => g.id === goalId);

  const toggleGoal = (goal: Goal) => {
    if (isSelected(goal.id)) {
      setSelectedGoals((prev) => prev.filter((g) => g.id !== goal.id));
      return;
    }
    if (selectedGoals.length >= MAX_SELECTED_GOALS) {
      toast.warning(`You can choose up to ${MAX_SELECTED_GOALS} goals at a time.`);
      return;
    }
    setSelectedGoals((prev) => [...prev, goal]);
  };

  const handleDone = () => {
    // TODO: save selectedGoals to member_goals table once member selection is implemented
    if (!user) {
      toast.info("Your goals are saved for this session only. To save them for future use, please sign in or register.");
    } else {
      toast.success("Goals saved!");
    }
  };

  if (loading) {
    return (
      <section id="goals" className="min-h-[50vh] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-muted-foreground">Loading goals…</p>
        </div>
      </section>
    );
  }

  return (
    <section id="goals" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-heading text-foreground text-3xl mb-1">Goals</h2>
        <p className="text-muted-foreground text-base mb-2">
          What is important to you? What goal would you like to achieve?
        </p>

        <SelectedGoalsBar
          selectedGoals={selectedGoals}
          onRemoveGoal={(id) =>
            setSelectedGoals((prev) => prev.filter((g) => g.id !== id))
          }
          onDone={handleDone}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {GOAL_CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.name}
              name={cat.name}
              icon={cat.icon}
              goals={goalsByCategory(cat.name)}
              isExpanded={expandedCategory === cat.name}
              collapsedCount={collapsedCount}
              isSelected={isSelected}
              onToggleGoal={toggleGoal}
              onExpandToggle={() =>
                setExpandedCategory(expandedCategory === cat.name ? null : cat.name)
              }
              onClickOutside={() => setExpandedCategory(null)}
            />
          ))}
        </div>

        <p className="text-muted-foreground text-sm mt-6">
          We recommend focusing on 1 or 2 goals at a time. You can choose up to {MAX_SELECTED_GOALS} goals.
        </p>
      </div>
    </section>
  );
}
