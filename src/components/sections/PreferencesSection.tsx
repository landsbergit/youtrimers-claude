import { useState, useEffect, useRef, useCallback } from "react";
import { Check, AlertCircle } from "lucide-react";
import { useRecommendationContext } from "@/context/RecommendationContext";
import {
  useDosageFormTree,
  computeAgeInMonths,
  getDefaultDosageFormNames,
  type DosageFormCategory,
  type DosageFormLeaf,
  type DosageFormGroup,
} from "@/hooks/useDosageFormTree";
import { useFoodPreferenceNodes } from "@/hooks/useFoodPreferenceNodes";

const LS_FOOD_PREFS = "youtrimers_food_prefs";

// ── Reusable checkbox primitives ──────────────────────────────────────────────

/**
 * Category-level checkbox with indeterminate state support.
 * Works for both leaf-categories (selfLeaf set) and multi-leaf categories.
 */
function CategoryCheckbox({
  category,
  selectedSet,
  onToggle,
}: {
  category: DosageFormCategory;
  selectedSet: Set<string>;
  onToggle: (category: DosageFormCategory) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // For a leaf-category (selfLeaf), check/uncheck is based on that single leaf.
  const leafNames = category.selfLeaf
    ? [category.selfLeaf.nodeName]
    : category.leaves.map((l) => l.nodeName);

  const selectedCount = leafNames.filter((n) => selectedSet.has(n)).length;
  const isChecked = leafNames.length > 0 && selectedCount === leafNames.length;
  const isIndeterminate = selectedCount > 0 && !isChecked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={isChecked}
      onChange={() => onToggle(category)}
      className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
    />
  );
}

function LeafCheckbox({
  leaf,
  selectedSet,
  onToggle,
}: {
  leaf: DosageFormLeaf;
  selectedSet: Set<string>;
  onToggle: (nodeName: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={selectedSet.has(leaf.nodeName)}
        onChange={() => onToggle(leaf.nodeName)}
        className="h-4 w-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
      />
      <span className="text-sm text-foreground group-hover:text-foreground/80">
        {leaf.displayName}
      </span>
    </label>
  );
}

// ── Simplified view ───────────────────────────────────────────────────────────
// One row per category. Leaf-categories (CAPSULE, SOFTGEL) render as a direct
// checkbox. Multi-leaf categories show an aggregate checkbox + label that
// toggles all leaves at once (majority-wins rule).

function SimplifiedGroup({
  group,
  selectedSet,
  onCategoryToggle,
  onLeafToggle,
}: {
  group: DosageFormGroup;
  selectedSet: Set<string>;
  onCategoryToggle: (cat: DosageFormCategory) => void;
  onLeafToggle: (nodeName: string) => void;
}) {
  if (group.selfLeaf && group.categories.length === 0) {
    return <LeafCheckbox leaf={group.selfLeaf} selectedSet={selectedSet} onToggle={onLeafToggle} />;
  }

  return (
    <div className="space-y-2">
      {group.categories.map((cat) =>
        cat.selfLeaf ? (
          // Category is itself a leaf — just a plain checkbox
          <LeafCheckbox key={cat.id} leaf={cat.selfLeaf} selectedSet={selectedSet} onToggle={onLeafToggle} />
        ) : (
          // Category has child leaves — aggregate checkbox + clickable label
          <div key={cat.id} className="flex items-start gap-2">
            <CategoryCheckbox category={cat} selectedSet={selectedSet} onToggle={onCategoryToggle} />
            <button
              type="button"
              onClick={() => onCategoryToggle(cat)}
              className="text-sm font-medium text-foreground text-left hover:text-foreground/80"
            >
              {cat.displayName}
            </button>
          </div>
        ),
      )}
    </div>
  );
}

// ── Detailed view ─────────────────────────────────────────────────────────────
// Categories as headers with individual leaf checkboxes below.
// Leaf-categories (CAPSULE, SOFTGEL) still render as a direct checkbox.

function DetailedGroup({
  group,
  selectedSet,
  onCategoryToggle,
  onLeafToggle,
}: {
  group: DosageFormGroup;
  selectedSet: Set<string>;
  onCategoryToggle: (cat: DosageFormCategory) => void;
  onLeafToggle: (nodeName: string) => void;
}) {
  if (group.selfLeaf && group.categories.length === 0) {
    return <LeafCheckbox leaf={group.selfLeaf} selectedSet={selectedSet} onToggle={onLeafToggle} />;
  }

  return (
    <div className="space-y-3">
      {group.categories.map((cat) =>
        cat.selfLeaf ? (
          // Leaf-category: single checkbox, no children to expand
          <LeafCheckbox key={cat.id} leaf={cat.selfLeaf} selectedSet={selectedSet} onToggle={onLeafToggle} />
        ) : (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-2">
              <CategoryCheckbox category={cat} selectedSet={selectedSet} onToggle={onCategoryToggle} />
              <span className="text-sm font-semibold text-foreground">{cat.displayName}</span>
            </div>
            <div className="ml-6 space-y-1.5">
              {cat.leaves.map((leaf) => (
                <LeafCheckbox key={leaf.id} leaf={leaf} selectedSet={selectedSet} onToggle={onLeafToggle} />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export default function PreferencesSection() {
  const {
    birthYear,
    birthMonth,
    acceptedDosageFormNames,
    setAcceptedDosageFormNames,
    dosageFormPreferencesSaved,
    setDosageFormPreferencesSaved,
    saveSection,
  } = useRecommendationContext();

  const { data: tree, isLoading: loadingTree } = useDosageFormTree();
  const { data: foodNodes, isLoading: loadingFood } = useFoodPreferenceNodes();

  // Dosage form selection (persisted via context → localStorage)
  const [selected, setSelected] = useState<string[]>(acceptedDosageFormNames);
  const [showDetailed, setShowDetailed] = useState(false);

  // Food preference selection (localStorage only for now)
  const [selectedFood, setSelectedFood] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_FOOD_PREFS) ?? "[]"); }
    catch { return []; }
  });

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-set dosage form defaults when age changes (only before explicit save)
  useEffect(() => {
    if (!tree || dosageFormPreferencesSaved) return;
    if (!birthYear || !birthMonth) return;
    const ageMonths = computeAgeInMonths(birthYear, birthMonth);
    if (ageMonths < 0) return;
    const defaults = getDefaultDosageFormNames(ageMonths, tree.allLeaves);
    setSelected(defaults);
    setAcceptedDosageFormNames(defaults);
  }, [birthYear, birthMonth, tree, dosageFormPreferencesSaved, setAcceptedDosageFormNames]);

  const selectedSet = new Set(selected);

  const toggleLeaf = useCallback((nodeName: string) => {
    setSelected((prev) =>
      prev.includes(nodeName) ? prev.filter((n) => n !== nodeName) : [...prev, nodeName],
    );
  }, []);

  const toggleCategory = useCallback(
    (category: DosageFormCategory) => {
      const leafNames = category.selfLeaf
        ? [category.selfLeaf.nodeName]
        : category.leaves.map((l) => l.nodeName);
      const selectedCount = leafNames.filter((n) => selectedSet.has(n)).length;
      if (selectedCount < leafNames.length / 2) {
        setSelected((prev) => [...new Set([...prev, ...leafNames])]);
      } else {
        setSelected((prev) => prev.filter((n) => !leafNames.includes(n)));
      }
    },
    [selectedSet],
  );

  const toggleFood = useCallback((nodeName: string) => {
    setSelectedFood((prev) =>
      prev.includes(nodeName) ? prev.filter((n) => n !== nodeName) : [...prev, nodeName],
    );
  }, []);

  const handleSave = () => {
    if (selected.length === 0) {
      setSaveError("Please select at least one dosage form.");
      return;
    }
    setSaveError(null);
    setAcceptedDosageFormNames(selected);
    setDosageFormPreferencesSaved(true);
    localStorage.setItem(LS_FOOD_PREFS, JSON.stringify(selectedFood));
    saveSection("preferences");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const ageDescription = (() => {
    if (!birthYear || !birthMonth) return null;
    const months = computeAgeInMonths(birthYear, birthMonth);
    if (months < 0) return null;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${rem} month${rem !== 1 ? "s" : ""} old`;
    if (rem === 0) return `${years} year${years !== 1 ? "s" : ""} old`;
    return `${years} yr ${rem} mo old`;
  })();

  const isLoading = loadingTree || loadingFood;

  return (
    <section id="preferences" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-heading text-foreground text-3xl mb-1">Preferences</h2>
        <p className="text-muted-foreground text-base mb-8">
          Choose which supplement forms you can or prefer to take.
        </p>

        <div className="max-w-xl space-y-10">

          {/* ── Dosage Forms ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-foreground">
                Dosage Forms
              </label>
              {!loadingTree && (
                <button
                  type="button"
                  onClick={() => setShowDetailed((v) => !v)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                >
                  {showDetailed ? "Simplified" : "More precision"}
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              {dosageFormPreferencesSaved
                ? "Your saved preferences are active. Age changes will not override them."
                : ageDescription
                ? `Defaults set for age: ${ageDescription}. Adjust and save to lock your preferences.`
                : "Add your age in the Profile section to auto-fill age-appropriate defaults."}
            </p>

            {loadingTree ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-5 w-40 rounded bg-muted" />)}
              </div>
            ) : !tree || tree.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dosage forms available.</p>
            ) : (
              <div className="space-y-6">
                {tree.groups.map((group) => (
                  <div key={group.id}>
                    {group.categories.length > 0 && (
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {group.displayName}
                      </p>
                    )}
                    {showDetailed ? (
                      <DetailedGroup
                        group={group}
                        selectedSet={selectedSet}
                        onCategoryToggle={toggleCategory}
                        onLeafToggle={toggleLeaf}
                      />
                    ) : (
                      <SimplifiedGroup
                        group={group}
                        selectedSet={selectedSet}
                        onCategoryToggle={toggleCategory}
                        onLeafToggle={toggleLeaf}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {selected.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {selected.length} form{selected.length !== 1 ? "s" : ""} selected
                {" — "}products with no form on file always shown.
              </p>
            )}
          </div>

          {/* ── Food Preferences ── */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Food &amp; Source Preferences
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Filter for products labelled with these certifications or sourcing standards.
            </p>

            {loadingFood ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-5 w-32 rounded bg-muted" />)}
              </div>
            ) : !foodNodes || foodNodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No options available.</p>
            ) : (
              <div className="space-y-2">
                {foodNodes.map((node) => (
                  <label key={node.id} className="flex items-center gap-2 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={selectedFood.includes(node.nodeName)}
                      onChange={() => toggleFood(node.nodeName)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
                    />
                    <span className="text-sm text-foreground group-hover:text-foreground/80">
                      {node.displayName}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Save button ── */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              Save Preferences
            </button>

            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <Check size={14} strokeWidth={3} />
                Saved
              </span>
            )}

            {saveError && (
              <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle size={14} />
                {saveError}
              </span>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
