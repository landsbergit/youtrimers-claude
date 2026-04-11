import { useState, useEffect } from "react";
import { Check, ChevronDown, ChevronRight, Map, X } from "lucide-react";
import { MedicationSearch } from "@/components/profile/MedicationSearch";
import { HealthConditionSearch } from "@/components/profile/HealthConditionSearch";
import { BodyMap } from "@/components/profile/BodyMap";
import { useMedicationNodes } from "@/hooks/useMedicationNodes";
import { useMemberMedications } from "@/hooks/useMemberMedications";
import { useHealthConditionNodes } from "@/hooks/useHealthConditionNodes";
import { useMemberHealthConditions } from "@/hooks/useMemberHealthConditions";
import { useFoodRestrictionNodes } from "@/hooks/useFoodRestrictionNodes";
import { useReproductiveStatusNodes } from "@/hooks/useReproductiveStatusNodes";
import { useRecommendationContext } from "@/context/RecommendationContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const CURRENT_YEAR = new Date().getFullYear();

const LS_GENDER              = "youtrimers_gender";
const LS_REPRODUCTIVE_STATUS = "youtrimers_reproductive_status";
const LS_FOOD_RESTRICTIONS   = "youtrimers_food_restrictions";

// Gender options: 3 from ontology + UI-only "prefer not to say"
const GENDER_OPTIONS = [
  { nodeName: "FEMALE",            displayName: "Female" },
  { nodeName: "MALE",              displayName: "Male" },
  { nodeName: "OTHER",             displayName: "Other" },
  { nodeName: "PREFER_NOT_TO_SAY", displayName: "Prefer not to say" },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileSection() {
  const {
    saveSection,
    setGender: setContextGender,
    setReproductiveStatus: setContextReproductiveStatus,
    setBirthYear: setContextBirthYear,
    setBirthMonth: setContextBirthMonth,
    birthYear: contextBirthYear,
    birthMonth: contextBirthMonth,
  } = useRecommendationContext();

  const { user } = useAuth();
  const { data: allMedications, isLoading: loadingMeds } = useMedicationNodes();
  const { medications, addMedication, removeMedication, saveMedications, saving } =
    useMemberMedications();
  const { data: restrictionNodes, isLoading: loadingRestrictions } = useFoodRestrictionNodes();
  const { data: reproductiveNodes, isLoading: loadingReproductive } = useReproductiveStatusNodes();
  const { data: conditionTree, isLoading: loadingConditions } = useHealthConditionNodes();
  const {
    conditions,
    addCondition,
    removeCondition,
    toggleCondition,
    saveConditions,
  } = useMemberHealthConditions();

  const [showBodyMap, setShowBodyMap] = useState(true);

  // Gender
  const [selectedGender, setSelectedGender] = useState<string>(
    () => localStorage.getItem(LS_GENDER) ?? "",
  );

  // Reproductive status — only relevant when gender is FEMALE
  const [selectedReproductiveStatus, setSelectedReproductiveStatus] = useState<string>(
    () => localStorage.getItem(LS_REPRODUCTIVE_STATUS) ?? "",
  );

  // Age
  const [birthYear, setBirthYear] = useState<string>(
    contextBirthYear != null ? String(contextBirthYear) : "",
  );
  const [birthMonth, setBirthMonth] = useState<string>(
    contextBirthMonth != null ? String(contextBirthMonth) : "",
  );

  // Food restrictions
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_FOOD_RESTRICTIONS) ?? "[]"); }
    catch { return []; }
  });
  const [restrictionsOpen, setRestrictionsOpen] = useState(false);

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load birth date from Supabase on login
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: member } = await supabase
        .from("members")
        .select("birth_year, birth_month")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .maybeSingle();
      if (member) {
        if (member.birth_year) {
          setBirthYear(String(member.birth_year));
          setContextBirthYear(member.birth_year);
        }
        if (member.birth_month) {
          setBirthMonth(String(member.birth_month));
          setContextBirthMonth(member.birth_month);
        }
      }
    })();
  }, [user, setContextBirthYear, setContextBirthMonth]);

  // Clear reproductive status when gender changes away from Female
  useEffect(() => {
    if (selectedGender !== "FEMALE") {
      setSelectedReproductiveStatus("");
    }
  }, [selectedGender]);

  const toggleRestriction = (nodeName: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(nodeName) ? prev.filter((n) => n !== nodeName) : [...prev, nodeName],
    );
  };

  const handleSave = async () => {
    setSaveError(null);

    const parsedYear = birthYear ? Number(birthYear) : null;
    const parsedMonth = birthMonth ? Number(birthMonth) : null;
    if (
      parsedYear !== null &&
      (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > CURRENT_YEAR)
    ) {
      setSaveError(`Birth year must be between 1900 and ${CURRENT_YEAR}.`);
      return;
    }

    // Persist to localStorage
    if (selectedGender) localStorage.setItem(LS_GENDER, selectedGender);
    else localStorage.removeItem(LS_GENDER);

    if (selectedReproductiveStatus && selectedGender === "FEMALE")
      localStorage.setItem(LS_REPRODUCTIVE_STATUS, selectedReproductiveStatus);
    else localStorage.removeItem(LS_REPRODUCTIVE_STATUS);

    localStorage.setItem(LS_FOOD_RESTRICTIONS, JSON.stringify(selectedRestrictions));

    // Save medications
    const { error: medError } = await saveMedications();
    if (medError) { setSaveError(medError.message); return; }

    // Save health conditions
    const { error: condError } = await saveConditions();
    if (condError) { setSaveError(condError.message); return; }

    // Sync profile fields to context (also persists to localStorage)
    setContextGender(selectedGender || null);
    setContextReproductiveStatus(
      selectedGender === "FEMALE" && selectedReproductiveStatus
        ? selectedReproductiveStatus
        : null,
    );
    setContextBirthYear(parsedYear);
    setContextBirthMonth(parsedMonth);

    // Save birth date to Supabase for logged-in users
    if (user) {
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .maybeSingle();
      if (member) {
        const { error: updateErr } = await supabase
          .from("members")
          .update({ birth_year: parsedYear, birth_month: parsedMonth })
          .eq("id", member.id);
        if (updateErr) { setSaveError(updateErr.message); return; }
      }
    }

    saveSection("profile");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isFemale = selectedGender === "FEMALE";

  return (
    <section id="profile" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-heading text-foreground text-3xl mb-1">Profile</h2>
        <p className="text-muted-foreground text-base mb-8">
          Tell us about yourself so we can personalise your supplement recommendations.
        </p>

        <div className="max-w-xl space-y-8">

          {/* ── Gender ── */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">
              Gender
            </label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((opt) => {
                const isSelected = selectedGender === opt.nodeName;
                return (
                  <button
                    key={opt.nodeName}
                    type="button"
                    onClick={() => setSelectedGender(isSelected ? "" : opt.nodeName)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {opt.displayName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Reproductive Health (female only) ── */}
          {isFemale && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Reproductive Health
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Helps us tailor nutrient recommendations to your current life stage.
              </p>
              {loadingReproductive ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map((i) => <div key={i} className="h-5 w-36 rounded bg-muted" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* None / not applicable option */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                    <input
                      type="radio"
                      name="reproductive_status"
                      value=""
                      checked={selectedReproductiveStatus === ""}
                      onChange={() => setSelectedReproductiveStatus("")}
                      className="h-4 w-4 accent-primary cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground">
                      None / Not applicable
                    </span>
                  </label>
                  {(reproductiveNodes ?? []).map((node) => (
                    <label
                      key={node.id}
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                    >
                      <input
                        type="radio"
                        name="reproductive_status"
                        value={node.nodeName}
                        checked={selectedReproductiveStatus === node.nodeName}
                        onChange={() => setSelectedReproductiveStatus(node.nodeName)}
                        className="h-4 w-4 accent-primary cursor-pointer"
                      />
                      <span className="text-sm text-foreground group-hover:text-foreground/80">
                        {node.displayName}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Age ── */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Age</label>
            <p className="text-xs text-muted-foreground mb-3">
              Used to suggest age-appropriate dosage forms for your preferences.
            </p>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Year of birth</label>
                <input
                  type="number"
                  min={1900}
                  max={CURRENT_YEAR}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="YYYY"
                  className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Month of birth</label>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                >
                  <option value="">Month</option>
                  {MONTHS.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Food Restrictions (collapsible) ── */}
          <div>
            <button
              type="button"
              onClick={() => setRestrictionsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left group"
            >
              <div>
                <span className="block text-sm font-semibold text-foreground">
                  Food Restrictions
                </span>
                {!restrictionsOpen && selectedRestrictions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedRestrictions.map((nodeName) => {
                      const label =
                        restrictionNodes?.find((n) => n.nodeName === nodeName)?.displayName ??
                        nodeName;
                      return (
                        <span
                          key={nodeName}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 pl-2 pr-1 py-0.5 text-xs font-medium text-primary"
                        >
                          {label}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleRestriction(nodeName); }}
                            aria-label={`Remove ${label}`}
                            className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                          >
                            <X size={10} strokeWidth={2.5} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {!restrictionsOpen && selectedRestrictions.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">None selected</p>
                )}
              </div>
              <span className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                {restrictionsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            </button>

            {restrictionsOpen && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Select any dietary restrictions or lifestyle choices. We use these to
                  flag products that may not be suitable for you.
                </p>
                {loadingRestrictions ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((i) => <div key={i} className="h-5 w-32 rounded bg-muted" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {(restrictionNodes ?? []).map((node) => (
                      <label
                        key={node.id}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRestrictions.includes(node.nodeName)}
                          onChange={() => toggleRestriction(node.nodeName)}
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
            )}
          </div>

          {/* ── Medications ── */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Medications
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Add any medications you are currently taking. We use this to flag
              nutrients that may interact with your prescriptions.
            </p>
            <MedicationSearch
              allMedications={allMedications ?? []}
              selected={medications}
              onAdd={addMedication}
              onRemove={removeMedication}
              isLoading={loadingMeds}
            />
          </div>

          {/* ── Health Conditions ── */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Health Conditions
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Add any health conditions you want to account for. We use these to
              tailor nutrient priorities in your recommendations.
            </p>

            {/* Show Body Map toggle (only when body map is hidden) */}
            {!showBodyMap && (
              <button
                type="button"
                onClick={() => setShowBodyMap(true)}
                className="inline-flex items-center gap-1.5 mb-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Map size={13} />
                Show body map
              </button>
            )}

            {loadingConditions ? (
              <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
            ) : (
              <div className="flex gap-6 items-start">
                {/* Search column */}
                <div className={showBodyMap ? "flex-1 min-w-0" : "w-full max-w-lg"}>
                  <HealthConditionSearch
                    allConditions={conditionTree?.allLeaves ?? []}
                    selected={conditions}
                    onAdd={addCondition}
                    onRemove={removeCondition}
                    isLoading={loadingConditions}
                  />
                </div>

                {/* Body map column */}
                {showBodyMap && (
                  <BodyMap
                    groups={conditionTree?.groups ?? []}
                    selected={conditions}
                    onToggle={toggleCondition}
                    onClose={() => setShowBodyMap(false)}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Save button ── */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>

            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <Check size={14} strokeWidth={3} />
                Saved{user ? " to your account" : " locally"}
              </span>
            )}

            {saveError && (
              <span className="text-sm text-destructive">{saveError}</span>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
