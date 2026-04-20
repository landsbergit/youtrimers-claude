import { useState, useEffect, useRef } from "react";
import { Baby, CalendarDays, ChevronDown, Map, UtensilsCrossed, Pill, HeartPulse, Ruler, X } from "lucide-react";
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
import { useMemberBasicProfile } from "@/hooks/useMemberBasicProfile";
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

// Gender options. hidden: true = valid data value but not shown in the UI.
const GENDER_OPTIONS = [
  { nodeName: "FEMALE",            displayName: "Female",           hidden: false },
  { nodeName: "MALE",              displayName: "Male",             hidden: false },
  { nodeName: "OTHER",             displayName: "Other",            hidden: true  },
  { nodeName: "PREFER_NOT_TO_SAY", displayName: "Prefer not to say", hidden: true },
];

// ── Gender icon (Mars + Venus combined) ──────────────────────────────────────

function GenderIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Female ♀ — circle + vertical stem + crossbar */}
      <circle cx="7" cy="8" r="5.5" />
      <line x1="7" y1="13.5" x2="7" y2="21" />
      <line x1="4" y1="17.5" x2="10" y2="17.5" />
      {/* Male ♂ — circle + diagonal arrow */}
      <circle cx="18.5" cy="8" r="5.5" />
      <line x1="22.5" y1="4" x2="26" y2="1" />
      <polyline points="22,1 26,1 26,5" />
    </svg>
  );
}

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
    bodySize: contextBodySize,
    setBodySize: setContextBodySize,
    heightCm: contextHeightCm,
    setHeightCm: setContextHeightCm,
    weightKg: contextWeightKg,
    setWeightKg: setContextWeightKg,
    useImperial: contextUseImperial,
    setUseImperial: setContextUseImperial,
  } = useRecommendationContext();

  const { user } = useAuth();
  const { saveBasicProfile } = useMemberBasicProfile();
  const { data: allMedications, isLoading: loadingMeds } = useMedicationNodes();
  const { medications, addMedication, removeMedication, saveMedications } = useMemberMedications();
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
  const [reproDropdownOpen, setReproDropdownOpen] = useState(false);
  const [foodDropdownOpen, setFoodDropdownOpen] = useState(false);

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

  // Body size / measurements state
  const [bodySizeLocal, setBodySizeLocal] = useState<string>(contextBodySize ?? "");
  const [precisionOpen, setPrecisionOpen] = useState<boolean>(
    () => contextHeightCm != null || contextWeightKg != null,
  );
  const [useImperialLocal, setUseImperialLocal] = useState<boolean>(contextUseImperial);
  const [heightCmInput, setHeightCmInput] = useState<string>(
    contextHeightCm != null ? String(contextHeightCm) : "",
  );
  const [weightKgInput, setWeightKgInput] = useState<string>(
    contextWeightKg != null ? String(contextWeightKg) : "",
  );
  const [heightFtInput, setHeightFtInput] = useState<string>(() => {
    if (contextHeightCm == null) return "";
    return String(Math.floor(contextHeightCm / 30.48));
  });
  const [heightInInput, setHeightInInput] = useState<string>(() => {
    if (contextHeightCm == null) return "";
    const totalIn = contextHeightCm / 2.54;
    return String(Math.round(totalIn % 12));
  });
  const [weightLbsInput, setWeightLbsInput] = useState<string>(() => {
    if (contextWeightKg == null) return "";
    return String(Math.round((contextWeightKg / 0.453592) * 10) / 10);
  });

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

  // Load basic profile from Supabase on login
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .maybeSingle();
      if (!member) return;

      const { data: bp } = await supabase
        .from("member_basic_profile")
        .select("body_size, height_cm, weight_kg")
        .eq("member_id", member.id)
        .maybeSingle();

      if (bp) {
        const bs = (bp.body_size as "LOW" | "MEDIUM" | "HIGH") ?? null;
        setBodySizeLocal(bs ?? "");
        setContextBodySize(bs);

        if (bp.height_cm != null) {
          const cm = Number(bp.height_cm);
          setHeightCmInput(String(cm));
          setContextHeightCm(cm);
          setHeightFtInput(String(Math.floor(cm / 30.48)));
          setHeightInInput(String(Math.round((cm / 2.54) % 12)));
          setPrecisionOpen(true);
        }
        if (bp.weight_kg != null) {
          const kg = Number(bp.weight_kg);
          setWeightKgInput(String(kg));
          setContextWeightKg(kg);
          setWeightLbsInput(String(Math.round((kg / 0.453592) * 10) / 10));
          setPrecisionOpen(true);
        }
      }
    })();
  }, [user, setContextBodySize, setContextHeightCm, setContextWeightKg]);

  // ── Auto-save medications & conditions on change ──────────────────────────

  // Close dropdowns on outside click
  const reproDropdownRef = useRef<HTMLDivElement>(null);
  const foodDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reproDropdownOpen && !foodDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (reproDropdownOpen && reproDropdownRef.current && !reproDropdownRef.current.contains(e.target as Node)) {
        setReproDropdownOpen(false);
      }
      if (foodDropdownOpen && foodDropdownRef.current && !foodDropdownRef.current.contains(e.target as Node)) {
        setFoodDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [reproDropdownOpen, foodDropdownOpen]);

  const medsAutoSaveRef = useRef(false);
  useEffect(() => {
    if (!medsAutoSaveRef.current) { medsAutoSaveRef.current = true; return; }
    const t = setTimeout(() => { saveMedications(); saveSection("profile"); }, 800);
    return () => clearTimeout(t);
  }, [saveMedications, saveSection]);

  const condAutoSaveRef = useRef(false);
  useEffect(() => {
    if (!condAutoSaveRef.current) { condAutoSaveRef.current = true; return; }
    const t = setTimeout(() => { saveConditions(); saveSection("profile"); }, 800);
    return () => clearTimeout(t);
  }, [saveConditions, saveSection]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Compute metric height & weight from current input state. */
  const computeCurrentMeasurements = () => {
    if (!precisionOpen) return { finalHeightCm: null as number | null, finalWeightKg: null as number | null };
    let finalHeightCm: number | null = null;
    let finalWeightKg: number | null = null;
    if (useImperialLocal) {
      const ft = parseFloat(heightFtInput) || 0;
      const inches = parseFloat(heightInInput) || 0;
      const cm = Math.round(ft * 30.48 + inches * 2.54);
      finalHeightCm = cm > 0 ? cm : null;
      const lbs = parseFloat(weightLbsInput);
      finalWeightKg = !isNaN(lbs) && lbs > 0 ? Math.round(lbs * 0.453592 * 10) / 10 : null;
    } else {
      const cm = parseFloat(heightCmInput);
      finalHeightCm = !isNaN(cm) && cm > 0 ? Math.round(cm) : null;
      const kg = parseFloat(weightKgInput);
      finalWeightKg = !isNaN(kg) && kg > 0 ? Math.round(kg * 10) / 10 : null;
    }
    return { finalHeightCm, finalWeightKg };
  };

  /** Fire-and-forget birth date save to Supabase. */
  const saveBirthDateSupabase = (year: number | null, month: number | null) => {
    if (!user) return;
    supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .maybeSingle()
      .then(({ data: member }) => {
        if (member) {
          supabase.from("members").update({ birth_year: year, birth_month: month }).eq("id", member.id);
        }
      });
  };

  // ── Auto-save handlers ────────────────────────────────────────────────────

  const handleGenderSelect = (nodeName: string) => {
    const next = selectedGender === nodeName ? "" : nodeName;
    setSelectedGender(next);
    setContextGender(next || null);
    if (next !== "FEMALE") {
      setSelectedReproductiveStatus("");
      setContextReproductiveStatus(null);
    }
    saveSection("profile");
  };

  const handleReproSelect = (nodeName: string) => {
    const next = selectedReproductiveStatus === nodeName ? "" : nodeName;
    setSelectedReproductiveStatus(next);
    setContextReproductiveStatus(next || null);
    saveSection("profile");
  };

  const handleBirthYearBlur = () => {
    const parsedYear = birthYear ? Number(birthYear) : null;
    if (parsedYear !== null && (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > CURRENT_YEAR)) return;
    setContextBirthYear(parsedYear);
    const parsedMonth = birthMonth ? Number(birthMonth) : null;
    saveBirthDateSupabase(parsedYear, parsedMonth);
    if (parsedYear !== null) saveSection("profile");
  };

  const handleBirthMonthChange = (val: string) => {
    setBirthMonth(val);
    const parsedMonth = val ? Number(val) : null;
    setContextBirthMonth(parsedMonth);
    const parsedYear = birthYear ? Number(birthYear) : null;
    saveBirthDateSupabase(parsedYear, parsedMonth);
    saveSection("profile");
  };

  const toggleRestriction = (nodeName: string) => {
    const next = selectedRestrictions.includes(nodeName)
      ? selectedRestrictions.filter((n) => n !== nodeName)
      : [...selectedRestrictions, nodeName];
    setSelectedRestrictions(next);
    localStorage.setItem(LS_FOOD_RESTRICTIONS, JSON.stringify(next));
    saveSection("profile");
  };

  const handleBodySizeSelect = (size: string) => {
    const next = bodySizeLocal === size ? "" : size;
    setBodySizeLocal(next);
    const finalBodySize = (next as "LOW" | "MEDIUM" | "HIGH") || null;
    setContextBodySize(finalBodySize);
    const { finalHeightCm, finalWeightKg } = computeCurrentMeasurements();
    saveBasicProfile(finalBodySize, finalHeightCm, finalWeightKg);
    saveSection("profile");
  };

  const handleHeightBlur = () => {
    const { finalHeightCm, finalWeightKg } = computeCurrentMeasurements();
    setContextHeightCm(finalHeightCm);
    const finalBodySize = (bodySizeLocal as "LOW" | "MEDIUM" | "HIGH") || null;
    saveBasicProfile(finalBodySize, finalHeightCm, finalWeightKg);
    saveSection("profile");
  };

  const handleWeightBlur = () => {
    const { finalHeightCm, finalWeightKg } = computeCurrentMeasurements();
    setContextWeightKg(finalWeightKg);
    const finalBodySize = (bodySizeLocal as "LOW" | "MEDIUM" | "HIGH") || null;
    saveBasicProfile(finalBodySize, finalHeightCm, finalWeightKg);
    saveSection("profile");
  };

  // Convert displayed values when switching between metric and imperial
  const handleUnitToggle = (toImperial: boolean) => {
    if (toImperial) {
      const cm = parseFloat(heightCmInput);
      if (!isNaN(cm) && cm > 0) {
        const totalIn = cm / 2.54;
        setHeightFtInput(String(Math.floor(totalIn / 12)));
        setHeightInInput(String(Math.round(totalIn % 12)));
      }
      const kg = parseFloat(weightKgInput);
      if (!isNaN(kg) && kg > 0) {
        setWeightLbsInput(String(Math.round((kg / 0.453592) * 10) / 10));
      }
    } else {
      const ft = parseFloat(heightFtInput) || 0;
      const inches = parseFloat(heightInInput) || 0;
      const cm = ft * 30.48 + inches * 2.54;
      if (cm > 0) setHeightCmInput(String(Math.round(cm)));
      const lbs = parseFloat(weightLbsInput);
      if (!isNaN(lbs) && lbs > 0) {
        setWeightKgInput(String(Math.round(lbs * 0.453592 * 10) / 10));
      }
    }
    setUseImperialLocal(toImperial);
    setContextUseImperial(toImperial);
  };

  const isFemale = selectedGender === "FEMALE";

  return (
    <div id="profile">
        <div className="space-y-5">

          {/* ── Gender + Age (same row) ── */}
          <div className="flex items-center gap-6 flex-wrap">

            {/* Gender */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <GenderIcon size={16} className="text-[#22A68C]" />
                <span className="text-sm font-semibold text-foreground">Gender</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.filter((opt) => !opt.hidden).map((opt) => {
                  const isSelected = selectedGender === opt.nodeName;
                  return (
                    <button
                      key={opt.nodeName}
                      type="button"
                      onClick={() => handleGenderSelect(opt.nodeName)}
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

            {/* Age */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <CalendarDays size={16} className="text-[#22A68C]" />
                <span className="text-sm font-semibold text-foreground">Age</span>
              </div>
              <input
                type="number"
                min={1900}
                max={CURRENT_YEAR}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                onBlur={handleBirthYearBlur}
                placeholder="Year"
                className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
              <select
                value={birthMonth}
                onChange={(e) => handleBirthMonthChange(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
              >
                <option value="">Month</option>
                {MONTHS.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>

          </div>

          {/* ── Reproductive status (female only) ── */}
          {isFemale && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Baby size={16} className="text-[#22A68C]" />
                <span className="text-sm font-semibold text-foreground">
                  Fertility Status
                </span>
              </div>
              {loadingReproductive ? (
                <div className="h-8 w-28 rounded-full bg-muted animate-pulse" />
              ) : (
                <div className="relative" ref={reproDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setReproDropdownOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      selectedReproductiveStatus
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {selectedReproductiveStatus
                      ? (reproductiveNodes ?? []).find((n) => n.nodeName === selectedReproductiveStatus)?.displayName ?? selectedReproductiveStatus
                      : "None"}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${reproDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {reproDropdownOpen && (
                    <div className="absolute z-50 mt-1 left-0 rounded-xl border border-border bg-popover shadow-lg overflow-hidden min-w-[160px]">
                      {[...(reproductiveNodes ?? [])]
                        .sort((a, b) => {
                          const ORDER = ["PRENATAL", "PREGNANCY", "BREASTFEEDING", "PREMENOPAUSAL", "MENOPAUSAL", "POSTMENOPAUSAL"];
                          const ai = ORDER.indexOf(a.nodeName);
                          const bi = ORDER.indexOf(b.nodeName);
                          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                        })
                        .map((node) => {
                          const isActive = selectedReproductiveStatus === node.nodeName;
                          return (
                            <label
                              key={node.id}
                              className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer transition-colors ${
                                isActive ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                              }`}
                              onClick={() => { handleReproSelect(node.nodeName); setReproDropdownOpen(false); }}
                            >
                              <input
                                type="radio"
                                checked={isActive}
                                readOnly
                                className="h-3.5 w-3.5 accent-primary cursor-pointer flex-shrink-0"
                              />
                              {node.displayName}
                            </label>
                          );
                        })}
                      <label
                        className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer transition-colors border-t border-border ${
                          selectedReproductiveStatus === ""
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-muted"
                        }`}
                        onClick={() => { handleReproSelect(""); setReproDropdownOpen(false); }}
                      >
                        <input
                          type="radio"
                          checked={selectedReproductiveStatus === ""}
                          readOnly
                          className="h-3.5 w-3.5 accent-primary cursor-pointer flex-shrink-0"
                        />
                        None
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Food restrictions ── */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 cursor-default" title="Products are screened for these labels, but always check before ordering and using to ensure safety.">
              <UtensilsCrossed size={16} className="text-[#22A68C]" />
              <span className="text-sm font-semibold text-foreground">Food restrictions</span>
            </div>
            {loadingRestrictions ? (
              <div className="flex gap-4 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-5 w-20 rounded bg-muted" />)}
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(restrictionNodes ?? [])
                  .filter((n) => !["vegan", "vegetarian"].includes(n.displayName.toLowerCase()))
                  .map((node) => {
                    const isSelected = selectedRestrictions.includes(node.nodeName);
                    const label = node.displayName.replace(/\s*Free$/i, "");
                    return (
                      <label key={node.id} className="flex items-center gap-2 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRestriction(node.nodeName)}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
                        />
                        <span className={`text-sm ${isSelected ? "text-primary font-medium" : "text-foreground"} group-hover:text-foreground/80`}>
                          {label}
                        </span>
                      </label>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ── Medications ── */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 cursor-default" title="Add any medications you are currently taking. We use this to flag nutrients that may interact with your prescriptions.">
              <Pill size={16} className="text-[#22A68C]" />
              <label className="text-sm font-semibold text-foreground cursor-default">
                Medications
              </label>
            </div>
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
            <div className="flex items-center gap-1.5 mb-2 cursor-default" title="Add any health conditions you want to account for. We use these to tailor nutrient priorities in your recommendations.">
              <HeartPulse size={16} className="text-[#22A68C]" />
              <label className="text-sm font-semibold text-foreground cursor-default">
                Health Conditions
              </label>
            </div>

            {loadingConditions ? (
              <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
            ) : (
              <div className="space-y-2">
                <HealthConditionSearch
                  allConditions={conditionTree?.allLeaves ?? []}
                  selected={conditions}
                  onAdd={addCondition}
                  onRemove={removeCondition}
                  isLoading={loadingConditions}
                />

                {!showBodyMap && (
                  <button
                    type="button"
                    onClick={() => setShowBodyMap(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Map size={13} />
                    Show body map
                  </button>
                )}

                {/* Body map — stacked below search */}
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

          {/* ── Physical size / Measurements ── */}
          <div>
            <div className="flex items-center gap-3 mb-2 cursor-default" title="Helps us estimate appropriate nutrient dosages for your body.">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Ruler size={16} className="text-[#22A68C]" />
                <span className="text-sm font-semibold text-foreground">Physical size</span>
              </div>
              {!precisionOpen && (
                <button
                  type="button"
                  onClick={() => setPrecisionOpen(true)}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Refine
                </button>
              )}
            </div>

            {!precisionOpen ? (
              /* ── Simple 3-state mode ── */
              <div className="flex gap-2">
                {(["LOW", "MEDIUM", "HIGH"] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleBodySizeSelect(size)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      bodySizeLocal === size
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {size === "LOW" ? "Small" : size === "MEDIUM" ? "Medium" : "Large"}
                  </button>
                ))}
              </div>
            ) : (
              /* ── Precision mode ── */
              <div className="space-y-2">
                {/* Units + Less precision row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Units:</span>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleUnitToggle(false)}
                        className={`px-2 py-0.5 text-xs font-medium transition-colors border-r border-border ${
                          !useImperialLocal
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        Metric
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitToggle(true)}
                        className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                          useImperialLocal
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        Imperial
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const { finalHeightCm, finalWeightKg } = computeCurrentMeasurements();
                      if (finalHeightCm && finalWeightKg) {
                        const heightM = finalHeightCm / 100;
                        const bmi = finalWeightKg / (heightM * heightM);
                        const size = bmi < 20 ? "LOW" : bmi <= 27 ? "MEDIUM" : "HIGH";
                        setBodySizeLocal(size);
                        setContextBodySize(size);
                        saveBasicProfile(size, finalHeightCm, finalWeightKg);
                        saveSection("profile");
                      }
                      setPrecisionOpen(false);
                    }}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Simplify
                  </button>
                </div>

                {/* Height + Weight on same line */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Height</span>
                    {!useImperialLocal ? (
                      <>
                        <input
                          type="number"
                          min={50}
                          max={280}
                          value={heightCmInput}
                          onChange={(e) => setHeightCmInput(e.target.value)}
                          onBlur={handleHeightBlur}
                          placeholder="170"
                          className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-xs text-muted-foreground">cm</span>
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          min={1}
                          max={9}
                          value={heightFtInput}
                          onChange={(e) => setHeightFtInput(e.target.value)}
                          onBlur={handleHeightBlur}
                          placeholder="5"
                          className="w-10 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-xs text-muted-foreground">ft</span>
                        <input
                          type="number"
                          min={0}
                          max={11}
                          value={heightInInput}
                          onChange={(e) => setHeightInInput(e.target.value)}
                          onBlur={handleHeightBlur}
                          placeholder="8"
                          className="w-10 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-xs text-muted-foreground">in</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Weight</span>
                    {!useImperialLocal ? (
                      <>
                        <input
                          type="number"
                          min={20}
                          max={500}
                          value={weightKgInput}
                          onChange={(e) => setWeightKgInput(e.target.value)}
                          onBlur={handleWeightBlur}
                          placeholder="70"
                          className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-xs text-muted-foreground">kg</span>
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          min={44}
                          max={1100}
                          value={weightLbsInput}
                          onChange={(e) => setWeightLbsInput(e.target.value)}
                          onBlur={handleWeightBlur}
                          placeholder="155"
                          className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-xs text-muted-foreground">lbs</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
    </div>
  );
}
