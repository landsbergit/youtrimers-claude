import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useGoals } from "@/hooks/useGoals";
import { useAuth } from "@/hooks/useAuth";
import { useRecommendationContext } from "@/context/RecommendationContext";
import { GOAL_CATEGORIES, MAX_SELECTED_GOALS } from "@/types/goals";
import type { Goal } from "@/types/goals";
import { CategoryCard } from "./CategoryCard";
import { SelectedGoalsBar } from "./SelectedGoalsBar";

/**
 * Returns 2 on mobile/tablet (< 1024px) and 3 on desktop.
 * Controls how many goals are visible before the "More..." button.
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
 * Selected goals are stored in RecommendationContext so the Matches section
 * can react to them. "Save Goals" confirms the selection, records the section
 * as saved, and scrolls to the next unsaved personalization section.
 */
export default function GoalsSection() {
  const { goalNodes, loading } = useGoals();
  const { user } = useAuth();
  const collapsedCount = useCollapsedGoalCount();

  const {
    selectedGoals,
    setSelectedGoals,
    saveSection,
    scrollToNextSection,
  } = useRecommendationContext();

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Build a lookup: node_name → id, so we can find category node IDs
  const nodeIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of goalNodes) map.set(node.node_name, node.id);
    return map;
  }, [goalNodes]);

  // Returns direct children (selectable goals) for a given category node_name
  const goalsForCategory = (categoryNodeName: string): Goal[] => {
    const categoryId = nodeIdByName.get(categoryNodeName);
    if (!categoryId) return [];
    return goalNodes.filter((g) => g.parent_id === categoryId);
  };

  const isSelected = (goalId: string) =>
    selectedGoals.some((g) => g.id === goalId);

  const toggleGoal = (goal: Goal) => {
    if (isSelected(goal.id)) {
      setSelectedGoals(selectedGoals.filter((g) => g.id !== goal.id));
      return;
    }
    if (selectedGoals.length >= MAX_SELECTED_GOALS) {
      toast.warning(`You can choose up to ${MAX_SELECTED_GOALS} goals at a time.`);
      return;
    }
    setSelectedGoals([...selectedGoals, goal]);
  };

  const handleSaveGoals = () => {
    if (selectedGoals.length === 0) {
      toast.warning("Please select at least one goal before saving.");
      return;
    }

    if (!user) {
      toast.info(
        "Your goals are saved for this session only. To save them for future use, please sign in or register."
      );
    } else {
      // TODO: persist selectedGoals to member_goals table once member selection is implemented
      toast.success("Goals saved!");
    }

    saveSection("goals");
    scrollToNextSection("goals");
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
            setSelectedGoals(selectedGoals.filter((g) => g.id !== id))
          }
          onDone={handleSaveGoals}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {GOAL_CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.node_name}
              name={cat.label}
              icon={cat.icon}
              goals={goalsForCategory(cat.node_name)}
              isExpanded={expandedCategory === cat.node_name}
              collapsedCount={collapsedCount}
              isSelected={isSelected}
              onToggleGoal={toggleGoal}
              onExpandToggle={() =>
                setExpandedCategory(
                  expandedCategory === cat.node_name ? null : cat.node_name
                )
              }
              onClickOutside={() => setExpandedCategory(null)}
            />
          ))}
        </div>

        <p className="text-muted-foreground text-sm mt-6">
          We recommend focusing on 1 or 2 goals at a time. You can choose up to{" "}
          {MAX_SELECTED_GOALS} goals.
        </p>
      </div>
    </section>
  );
}
