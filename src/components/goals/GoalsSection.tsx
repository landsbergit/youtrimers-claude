import { useState, useEffect, useMemo, useRef } from "react";
import { X, Check } from "lucide-react";
import { toast } from "sonner";
import { useGoals } from "@/hooks/useGoals";
import { useAuth } from "@/hooks/useAuth";
import { useRecommendationContext } from "@/context/RecommendationContext";
import { GOAL_CATEGORIES, MAX_SELECTED_GOALS } from "@/types/goals";
import type { Goal } from "@/types/goals";

/**
 * Goals section — single tabbed panel.
 *
 * Top: category tabs (icon + label). Bottom: goal pills for the active category.
 * Selected goals appear in the title row with a "Save Goals" button.
 *
 * Collapsed pill row: measures available width and shows only fully-visible pills.
 * "More" / "Less" toggle reveals all pills.
 */
export default function GoalsSection() {
  const { goalNodes, loading } = useGoals();
  const { user } = useAuth();

  const {
    selectedGoals,
    setSelectedGoals,
    saveSection,
    scrollToNextSection,
  } = useRecommendationContext();

  // Active category tab — default to first
  const [activeCategory, setActiveCategory] = useState<string>(
    GOAL_CATEGORIES[0].node_name,
  );
  const [rowExpanded, setRowExpanded] = useState(false);

  // Measurement refs and state
  const pillsOuterRef = useRef<HTMLDivElement>(null); // outer container (flex-1)
  const measureRef    = useRef<HTMLDivElement>(null); // invisible absolute layer
  const moreRef       = useRef<HTMLButtonElement>(null); // "More" button
  const [visibleCount, setVisibleCount]   = useState<number>(999);
  const [pillsOverflow, setPillsOverflow] = useState(false);

  const handleCategoryChange = (nodeName: string) => {
    setActiveCategory(nodeName);
    setRowExpanded(false);
    setVisibleCount(999);
    setPillsOverflow(false);
  };

  // ── Build ontology helpers ────────────────────────────────────────────────

  const nodeIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of goalNodes) map.set(node.node_name, node.id);
    return map;
  }, [goalNodes]);

  const parentIds = useMemo(() => {
    const set = new Set<string>();
    for (const node of goalNodes) {
      if (node.parent_id) set.add(node.parent_id);
    }
    return set;
  }, [goalNodes]);

  const goalsForCategory = (categoryNodeName: string): Goal[] => {
    const categoryId = nodeIdByName.get(categoryNodeName);
    if (!categoryId) return [];
    const descendantIds = new Set<string>();
    const queue = [categoryId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const node of goalNodes) {
        if (node.parent_id === current) {
          descendantIds.add(node.id);
          queue.push(node.id);
        }
      }
    }
    return goalNodes.filter(
      (g) => descendantIds.has(g.id) && !parentIds.has(g.id),
    );
  };

  const currentGoals = goalsForCategory(activeCategory);

  // ── Measure how many pills fit on one line ────────────────────────────────
  //
  // Strategy: render all pills invisible in an absolute overlay (measureRef),
  // read their individual widths, then calculate how many fit in
  // (container width − "More" button width − gap).
  // A ResizeObserver re-runs the calculation on every container resize.

  useEffect(() => {
    if (rowExpanded) {
      setPillsOverflow(false);
      return;
    }

    const outer   = pillsOuterRef.current;
    const measure = measureRef.current;
    if (!outer || !measure) return;

    const GAP = 8; // gap-2 = 0.5rem = 8px

    const calculate = () => {
      const moreW = (moreRef.current?.offsetWidth ?? 44) + GAP;
      const available = outer.clientWidth - moreW;

      const pillEls = Array.from(measure.children) as HTMLElement[];
      let used  = 0;
      let count = 0;

      for (let i = 0; i < pillEls.length; i++) {
        const w = pillEls[i].offsetWidth + (i === 0 ? 0 : GAP);
        if (used + w > available) break;
        used += w;
        count++;
      }

      if (count >= currentGoals.length) {
        // All pills fit — no "More" needed
        setVisibleCount(currentGoals.length);
        setPillsOverflow(false);
      } else {
        setVisibleCount(count);
        setPillsOverflow(true);
      }
    };

    calculate();
    const ro = new ResizeObserver(calculate);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [rowExpanded, activeCategory, goalNodes, currentGoals.length]);

  // ── Goal interactions ─────────────────────────────────────────────────────

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
    toast.info("We recommend focusing on 1 or 2 goals at a time. You can choose up to 3 goals.");
  };

  const handleSaveGoals = () => {
    if (selectedGoals.length === 0) {
      toast.warning("Please select at least one goal before saving.");
      return;
    }
    if (!user) {
      toast.info(
        "Your goals are saved for this session only. Sign in to keep them for future visits.",
      );
    } else {
      toast.success("Goals saved!");
    }
    saveSection("goals");
    scrollToNextSection("goals");
  };

  // Shared pill class (used for both the invisible measurement layer and real pills)
  const pillBaseClass =
    "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section id="goals" className="px-4 pt-12 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* ── Title row ── */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <h2 className="font-heading text-foreground text-3xl flex-shrink-0">Goals</h2>

          {selectedGoals.length === 0 ? (
            <p className="text-muted-foreground text-base">
              What goal is most important to you?
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {selectedGoals.map((goal) => (
                  <span
                    key={goal.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                  >
                    {goal.display_name}
                    <button
                      onClick={() =>
                        setSelectedGoals(selectedGoals.filter((g) => g.id !== goal.id))
                      }
                      className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                      aria-label={`Remove ${goal.display_name}`}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={handleSaveGoals}
                className="flex-shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save Goals
              </button>
            </>
          )}
        </div>

        {/* ── Category tab bar ── */}
        <div className="inline-flex overflow-x-auto scrollbar-hide border-b border-border">
          {GOAL_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.node_name;
            return (
              <button
                key={cat.node_name}
                onClick={() => handleCategoryChange(cat.node_name)}
                className={`flex items-center gap-2 px-5 py-3 text-sm whitespace-nowrap transition-colors flex-shrink-0
                  ${isActive
                    ? "bg-[#22A68C] text-white font-semibold"
                    : "text-muted-foreground font-medium hover:text-foreground hover:bg-muted/40"
                  }`}
              >
                <Icon
                  size={16}
                  className={`flex-shrink-0 ${isActive ? "text-white" : "text-[#22A68C]"}`}
                />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ── Goal pills ── */}
        <div className="pt-4 pb-2">
          {loading ? (
            <div className="h-9 w-2/3 rounded-full bg-muted animate-pulse" />
          ) : currentGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Coming soon</p>
          ) : (
            <div className="flex items-start gap-2">

              {/* Outer container — measured for available width */}
              <div ref={pillsOuterRef} className="relative flex-1 min-w-0">

                {/* ── Invisible measurement layer (position: absolute, out of flow) ── */}
                {!rowExpanded && (
                  <div
                    ref={measureRef}
                    aria-hidden
                    className="absolute top-0 left-0 flex flex-nowrap gap-2 pointer-events-none"
                    style={{ visibility: "hidden" }}
                  >
                    {currentGoals.map((goal) => (
                      <span key={goal.id} className={pillBaseClass}>
                        {goal.display_name}
                      </span>
                    ))}
                  </div>
                )}

                {/* ── Visible pills ── */}
                <div className={`flex gap-2 ${rowExpanded ? "flex-wrap" : "flex-nowrap"}`}>
                  {(rowExpanded ? currentGoals : currentGoals.slice(0, visibleCount)).map((goal) => {
                    const selected = isSelected(goal.id);
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => toggleGoal(goal)}
                        className={`${pillBaseClass} transition-colors
                          ${selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                      >
                        {selected && <Check size={12} strokeWidth={3} className="flex-shrink-0" />}
                        {goal.display_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* More / Less */}
              {!rowExpanded && pillsOverflow && (
                <button
                  ref={moreRef}
                  type="button"
                  onClick={() => setRowExpanded(true)}
                  className="flex-shrink-0 text-sm font-medium text-primary hover:underline underline-offset-2 transition-colors pt-1.5"
                >
                  More
                </button>
              )}
              {rowExpanded && (
                <button
                  type="button"
                  onClick={() => setRowExpanded(false)}
                  className="flex-shrink-0 text-sm font-medium text-primary hover:underline underline-offset-2 transition-colors pt-1.5"
                >
                  Less
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
