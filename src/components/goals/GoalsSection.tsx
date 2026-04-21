import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useGoals } from "@/hooks/useGoals";
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

  const {
    selectedGoals,
    setSelectedGoals,
    saveSection,
  } = useRecommendationContext();

  // Active category tab — default to first
  const [activeCategory, setActiveCategory] = useState<string>(
    GOAL_CATEGORIES[0].node_name,
  );
  const [rowExpanded, setRowExpanded] = useState(true);

  // Measurement refs and state
  const pillsOuterRef = useRef<HTMLDivElement>(null); // outer container (flex-1)
  const measureRef    = useRef<HTMLDivElement>(null); // invisible absolute layer
  const moreRef       = useRef<HTMLButtonElement>(null); // "More" button
  const [visibleCount, setVisibleCount]   = useState<number>(999);
  const [pillsOverflow, setPillsOverflow] = useState(false);

  const handleCategoryChange = (nodeName: string) => {
    setActiveCategory(nodeName);
    setRowExpanded(true);
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

  const currentGoals = goalsForCategory(activeCategory)
    .sort((a, b) => a.display_name.length - b.display_name.length);

  // ── Measure how many pills fit on one line ────────────────────────────────
  //
  // Strategy: render all pills invisible in an absolute overlay (measureRef),
  // read their individual widths, then calculate how many fit in
  // (container width − "More" button width − gap).
  // A ResizeObserver re-runs the calculation on every container resize.

  useEffect(() => {
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
    const updated = [...selectedGoals, goal];
    setSelectedGoals(updated);
    if (updated.length >= MAX_SELECTED_GOALS) {
      toast.info(`You've reached the maximum of ${MAX_SELECTED_GOALS} goals.`, { duration: 8000 });
    } else {
      toast.info(`For best results, focus on a single goal. You can select up to ${MAX_SELECTED_GOALS}.`);
    }
  };

  // Auto-save goals on every selection change
  const goalsAutoSaveRef = useRef(false);
  useEffect(() => {
    if (!goalsAutoSaveRef.current) { goalsAutoSaveRef.current = true; return; }
    if (selectedGoals.length > 0) saveSection("goals");
  }, [selectedGoals, saveSection]);

  // Shared pill class (used for both the invisible measurement layer and real pills)
  const pillBaseClass =
    "inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div id="goals">
        {/* ── Selected goals + Save ── */}
        {selectedGoals.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        )}

        {/* ── Category tab bar ── */}
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap border-b border-border">
            {GOAL_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.node_name;
              const btn = (
                <button
                  key={cat.node_name}
                  onClick={() => handleCategoryChange(cat.node_name)}
                  className={`flex items-center gap-1.5 py-1.5 text-sm whitespace-nowrap transition-colors flex-shrink-0 rounded-full
                    ${isActive
                      ? "bg-[#22A68C] text-white font-semibold px-3"
                      : "text-muted-foreground font-medium hover:text-foreground hover:bg-muted/40 px-2.5"
                    }`}
                >
                  <Icon
                    size={16}
                    className={`flex-shrink-0 ${isActive ? "text-white" : "text-[#22A68C]"}`}
                  />
                  {isActive && cat.label}
                </button>
              );

              if (isActive) return btn;

              return (
                <Tooltip key={cat.node_name}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent><p>{cat.label}</p></TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* ── Goal pills ── */}
        <div className="pt-2 pb-1">
          {loading ? (
            <div className="h-9 w-2/3 rounded-full bg-muted animate-pulse" />
          ) : currentGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Coming soon</p>
          ) : (
            /* Outer container — measured for available width */
            <div ref={pillsOuterRef} className="relative">

              {/* ── Invisible measurement layer (always rendered for line-count calculation) ── */}
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

              {/* ── Visible pills + More / Less inline ── */}
              <div className={`flex items-center gap-2 ${rowExpanded ? "flex-wrap" : "flex-nowrap"}`}>
                {(rowExpanded ? currentGoals : currentGoals.slice(0, visibleCount)).map((goal, idx) => {
                  const selected = isSelected(goal.id);
                  return (
                    <React.Fragment key={goal.id}>
                      <button
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

                      {/* Collapse arrow after first line of pills */}
                      {rowExpanded && idx === visibleCount - 1 && visibleCount < currentGoals.length && (
                        <button
                          type="button"
                          onClick={() => setRowExpanded(false)}
                          className="flex-shrink-0 text-primary hover:text-primary/70 transition-colors"
                          aria-label="Show fewer goals"
                        >
                          <ChevronUp size={16} />
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* More — downward arrow after last visible pill */}
                {!rowExpanded && pillsOverflow && (
                  <button
                    ref={moreRef}
                    type="button"
                    onClick={() => setRowExpanded(true)}
                    className="flex-shrink-0 text-primary hover:text-primary/70 transition-colors -ml-1"
                    aria-label="Show more goals"
                  >
                    <ChevronDown size={18} />
                  </button>
                )}

                {/* Less — upward arrow at end of all pills */}
                {rowExpanded && currentGoals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRowExpanded(false)}
                    className="flex-shrink-0 text-primary hover:text-primary/70 transition-colors ml-auto"
                    aria-label="Show fewer goals"
                  >
                    <ChevronUp size={18} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

    </div>
  );
}
