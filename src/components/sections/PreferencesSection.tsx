import { useState, useEffect, useRef, useCallback } from "react";
import { Droplets, LeafyGreen, HandHeart, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { useFoodRestrictionNodes } from "@/hooks/useFoodRestrictionNodes";
import { useReligiousPreferenceNodes } from "@/hooks/useReligiousPreferenceNodes";
import { useMemberReligiousPreferences } from "@/hooks/useMemberReligiousPreferences";

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

const DOSAGE_FORM_DESCRIPTIONS: Record<string, string> = {
  CAPSULE: "Hard shell containing powder or granules — easy to swallow",
  SOFTGEL: "Soft gelatin shell with liquid fill — often used for oils and fat-soluble vitamins",
  TABLET: "Compressed solid form — may be scored for splitting",
  CAPLET: "Oval-shaped tablet with a smooth coating — easier to swallow than round tablets",
  CHEWABLE: "Flavored tablet you chew before swallowing — good for those who dislike swallowing pills",
  GUMMY: "Soft, candy-like chewable — popular for vitamins and minerals",
  LOZENGE: "Dissolves slowly in the mouth — often used for throat or immune support",
  WAFER: "Thin, flat dissolvable form — melts on the tongue",
  POWDER: "Loose powder to mix into water, smoothies, or food",
  LIQUID: "Ready-to-take liquid — absorbed quickly, easy to dose for children",
  SPRAY: "Fine mist sprayed into the mouth — fast absorption through oral tissue",
  TEA_BAG: "Herbal tea bag steeped in hot water",
  STRIP: "Thin film that dissolves on the tongue",
  BAR: "Nutrition bar or chew bar — a food-like supplement form",
  NUGGETS: "Small chewable nuggets — similar to gummies but firmer",
  PELLET: "Tiny pellets or beads — sometimes placed under the tongue",
  PACK: "Pre-portioned packet of powder or liquid",
  CREAM: "Topical cream applied to the skin",
  PATCH: "Adhesive patch worn on the skin for slow nutrient release",
  OIL: "Liquid oil taken by mouth or added to food",
  DROP: "Concentrated liquid drops — easy to dose precisely",
};

function LeafCheckbox({
  leaf,
  selectedSet,
  onToggle,
}: {
  leaf: DosageFormLeaf;
  selectedSet: Set<string>;
  onToggle: (nodeName: string) => void;
}) {
  const description = DOSAGE_FORM_DESCRIPTIONS[leaf.nodeName] ?? "";
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group" title={description}>
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
    setReligiousPreferences,
    foodPreferences: contextFoodPrefs,
    setFoodPreferences: setContextFoodPrefs,
    maxBundleSize,
    setMaxBundleSize,
    saveSection,
  } = useRecommendationContext();

  const { data: tree, isLoading: loadingTree } = useDosageFormTree();
  const { data: foodNodes, isLoading: loadingFood } = useFoodPreferenceNodes();
  const { data: restrictionNodes, isLoading: loadingRestrictions } = useFoodRestrictionNodes();
  // Vegan & Vegetarian are displayed here (under Food & Source Preferences) not in Profile
  const dietaryNodes = (restrictionNodes ?? []).filter((n) =>
    ["vegan", "vegetarian"].includes(n.displayName.toLowerCase()),
  );
  const { data: religiousNodes, isLoading: loadingReligious } = useReligiousPreferenceNodes();
  const {
    preferences: religiousSelected,
    togglePreference: toggleReligious,
    savePreferences: saveReligiousPreferences,
  } = useMemberReligiousPreferences();

  // Keep context in sync whenever the hook's state changes (including Supabase load on login)
  useEffect(() => {
    setReligiousPreferences(religiousSelected.map((p) => p.nodeName));
  }, [religiousSelected, setReligiousPreferences]);

  // Auto-save religious preferences when they change (debounced)
  const religiousAutoSaveRef = useRef(false);
  useEffect(() => {
    if (!religiousAutoSaveRef.current) { religiousAutoSaveRef.current = true; return; }
    const t = setTimeout(() => {
      saveReligiousPreferences();
      saveSection("preferences");
    }, 800);
    return () => clearTimeout(t);
  }, [saveReligiousPreferences, saveSection]);

  // Dosage form selection (persisted via context → localStorage)
  const [selected, setSelected] = useState<string[]>(acceptedDosageFormNames);
  const [showDetailed, setShowDetailed] = useState(false);

  // Food preference selection (localStorage only for now)
  const [selectedFood, setSelectedFood] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_FOOD_PREFS) ?? "[]"); }
    catch { return []; }
  });

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

  // Toggle a single leaf and auto-save immediately
  const toggleLeaf = useCallback((nodeName: string) => {
    const next = selected.includes(nodeName)
      ? selected.filter((n) => n !== nodeName)
      : [...selected, nodeName];
    setSelected(next);
    setAcceptedDosageFormNames(next);
    setDosageFormPreferencesSaved(true);
    saveSection("preferences");
  }, [selected, setAcceptedDosageFormNames, setDosageFormPreferencesSaved, saveSection]);

  // Toggle an entire category and auto-save immediately
  const toggleCategory = useCallback((category: DosageFormCategory) => {
    const leafNames = category.selfLeaf
      ? [category.selfLeaf.nodeName]
      : category.leaves.map((l) => l.nodeName);
    const selectedCount = leafNames.filter((n) => selectedSet.has(n)).length;
    const next = selectedCount < leafNames.length / 2
      ? [...new Set([...selected, ...leafNames])]
      : selected.filter((n) => !leafNames.includes(n));
    setSelected(next);
    setAcceptedDosageFormNames(next);
    setDosageFormPreferencesSaved(true);
    saveSection("preferences");
  }, [selected, selectedSet, setAcceptedDosageFormNames, setDosageFormPreferencesSaved, saveSection]);

  // Toggle a food preference — single selection: clicking a new one replaces the old
  const toggleFood = useCallback((nodeName: string) => {
    const next = selectedFood.includes(nodeName) ? [] : [nodeName];
    setSelectedFood(next);
    setContextFoodPrefs(next);
    saveSection("preferences");
  }, [selectedFood, setContextFoodPrefs, saveSection]);

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

  return (
    <div id="preferences">
        <TooltipProvider delayDuration={300}>

        <div className="space-y-6">

          {/* ── Dosage Forms ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Droplets size={16} className="text-[#22A68C]" />
                <label className="text-sm font-semibold text-foreground">
                  Dosage Forms
                </label>
              </div>
              {!loadingTree && (
                <button
                  type="button"
                  onClick={() => setShowDetailed((v) => !v)}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  {showDetailed ? "Simplify" : "Refine"}
                </button>
              )}
            </div>

            {loadingTree ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-5 w-40 rounded bg-muted" />)}
              </div>
            ) : !tree || tree.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dosage forms available.</p>
            ) : showDetailed ? (
              /* ── Detailed: leaves grouped under Solid / Non-Solid headers ── */
              <div className="space-y-4">
                {tree.groups.map((group) => {
                  // Collect all leaves for the group (flatten categories)
                  const allGroupLeaves = [
                    ...(group.selfLeaf ? [group.selfLeaf] : []),
                    ...group.categories.flatMap((cat) => cat.selfLeaf ? [cat.selfLeaf] : cat.leaves),
                  ];
                  if (allGroupLeaves.length === 0) return null;
                  return (
                    <div key={group.id}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {group.displayName}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {allGroupLeaves.map((leaf) => (
                          <LeafCheckbox
                            key={leaf.id}
                            leaf={leaf}
                            selectedSet={selectedSet}
                            onToggle={toggleLeaf}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Simplified: 3-button pill selector ── */
              (() => {
                const solidGroup = tree.groups.find((g) => g.displayName.toLowerCase().includes("solid") && !g.displayName.toLowerCase().includes("non"));
                const nonSolidGroup = tree.groups.find((g) => g.displayName.toLowerCase().includes("non"));
                const solidLeafNames = solidGroup
                  ? [...(solidGroup.selfLeaf ? [solidGroup.selfLeaf.nodeName] : []), ...solidGroup.categories.flatMap((c) => c.selfLeaf ? [c.selfLeaf.nodeName] : c.leaves.map((l) => l.nodeName))]
                  : [];
                const nonSolidLeafNames = nonSolidGroup
                  ? [...(nonSolidGroup.selfLeaf ? [nonSolidGroup.selfLeaf.nodeName] : []), ...nonSolidGroup.categories.flatMap((c) => c.selfLeaf ? [c.selfLeaf.nodeName] : c.leaves.map((l) => l.nodeName))]
                  : [];
                const allLeafNames = tree.allLeaves.map((l) => l.nodeName);

                const isSolidOnly = solidLeafNames.length > 0 && solidLeafNames.every((n) => selectedSet.has(n)) && nonSolidLeafNames.every((n) => !selectedSet.has(n));
                const isNonSolidOnly = nonSolidLeafNames.length > 0 && nonSolidLeafNames.every((n) => selectedSet.has(n)) && solidLeafNames.every((n) => !selectedSet.has(n));
                const isAny = allLeafNames.length > 0 && allLeafNames.every((n) => selectedSet.has(n));

                const selectSolidOnly = () => {
                  setSelected(solidLeafNames);
                  setAcceptedDosageFormNames(solidLeafNames);
                  setDosageFormPreferencesSaved(true);
                  saveSection("preferences");
                };
                const selectAny = () => {
                  setSelected(allLeafNames);
                  setAcceptedDosageFormNames(allLeafNames);
                  setDosageFormPreferencesSaved(true);
                  saveSection("preferences");
                };
                const selectNonSolidOnly = () => {
                  setSelected(nonSolidLeafNames);
                  setAcceptedDosageFormNames(nonSolidLeafNames);
                  setDosageFormPreferencesSaved(true);
                  saveSection("preferences");
                };

                const options = [
                  { label: "Solid only", active: isSolidOnly, onClick: selectSolidOnly },
                  { label: "Any", active: isAny, onClick: selectAny },
                  { label: "Non-solid only", active: isNonSolidOnly, onClick: selectNonSolidOnly },
                ];

                return (
                  <div className="flex rounded-lg border border-border overflow-hidden w-fit">
                    {options.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={opt.onClick}
                        className={`min-w-[60px] px-2.5 py-1 text-xs font-medium transition-colors border-r last:border-r-0 border-border whitespace-nowrap ${
                          opt.active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

        </div>

        <div className="space-y-6 mt-6">

          {/* ── Food Preferences ── */}
          <div className="flex items-center gap-4 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <LeafyGreen size={16} className="text-[#22A68C]" />
                  <label className="text-sm font-semibold text-foreground cursor-default">
                    Food &amp; Source Preferences
                  </label>
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Filter for products labelled with these certifications or sourcing standards.</p></TooltipContent>
            </Tooltip>

            {loadingFood || loadingRestrictions ? (
              <>
                {[1, 2, 3].map((i) => <div key={i} className="h-5 w-20 rounded bg-muted animate-pulse" />)}
              </>
            ) : (
              [...dietaryNodes, ...(foodNodes ?? [])].map((node) => {
                const isActive = selectedFood.includes(node.nodeName);
                return (
                  <label key={node.id} className="flex items-center gap-2 cursor-pointer select-none group" onClick={(e) => { e.preventDefault(); toggleFood(node.nodeName); }}>
                    <input
                      type="radio"
                      name="foodPreference"
                      checked={isActive}
                      readOnly
                      className="h-4 w-4 accent-primary cursor-pointer flex-shrink-0"
                    />
                    <span className={`text-sm ${isActive ? "text-primary font-medium" : "text-foreground"} group-hover:text-foreground/80`}>
                      {node.displayName}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* ── Religious Preferences ── */}
          <div className="flex items-center gap-4 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <HandHeart size={16} className="text-[#22A68C]" />
                  <label className="text-sm font-semibold text-foreground cursor-default">
                    Religious Certifications
                  </label>
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Only show products carrying these certifications. Leave unchecked to see all products.</p></TooltipContent>
            </Tooltip>

            {loadingReligious ? (
              <div className="flex gap-4 animate-pulse">
                {[1, 2].map((i) => <div key={i} className="h-5 w-20 rounded bg-muted" />)}
              </div>
            ) : !religiousNodes || religiousNodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No options available.</p>
            ) : (
              <div className="flex items-center gap-4">
                {religiousNodes.map((node) => (
                  <label key={node.id} className="flex items-center gap-2 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={religiousSelected.some((p) => p.id === node.id)}
                      onChange={() => toggleReligious({ id: node.id, nodeName: node.nodeName })}
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

          {/* ── Product number ── */}
          <div className="flex items-center gap-3 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <Package size={16} className="text-[#22A68C]" />
                  <span className="text-sm font-semibold text-foreground">Product number</span>
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Combine up to 1–2 products</p></TooltipContent>
            </Tooltip>
            <div className="flex rounded-lg border border-border overflow-hidden w-fit">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setMaxBundleSize(n); saveSection("preferences"); }}
                  className={`min-w-[60px] px-2.5 py-1 text-xs font-medium transition-colors border-r last:border-r-0 border-border ${
                    maxBundleSize === n
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

        </div>
        </TooltipProvider>
    </div>
  );
}
