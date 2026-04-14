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
  const { saveBasicProfile, saving: savingBasicProfile } = useMemberBasicProfile();
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

  // Clear reproductive status when gender changes away from Female
  useEffect(() => {
    if (selectedGender !== "FEMALE") {
      setSelectedReproductiveStatus("");
    }
  }, [selectedGender]);

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

    // Compute metric body measurements from active unit mode
    let finalHeightCm: number | null = null;
    let finalWeightKg: number | null = null;
    if (precisionOpen) {
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
    }
    const finalBodySize = (bodySizeLocal as "LOW" | "MEDIUM" | "HIGH") || null;

    // Sync profile fields to context (also persists to localStorage)
    setContextGender(selectedGender || null);
    setContextReproductiveStatus(
      selectedGender === "FEMALE" && selectedReproductiveStatus
        ? selectedReproductiveStatus
        : null,
    );
    setContextBirthYear(parsedYear);
    setContextBirthMonth(parsedMonth);
    setContextBodySize(finalBodySize);
    setContextHeightCm(finalHeightCm);
    setContextWeightKg(finalWeightKg);

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

    // Save basic profile (body size / measurements) to Supabase
    const { error: bpError } = await saveBasicProfile(finalBodySize, finalHeightCm, finalWeightKg);
    if (bpError) { setSaveError(bpError.message); return; }

    saveSection("profile");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isFemale = selectedGender === "FEMALE";

  return (
    <section id="profile" className="px-4 pt-6 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <h2 className="font-heading text-foreground text-3xl flex-shrink-0">Profile</h2>
          <p className="text-muted-foreground text-base">
            Share a bit about yourself to get personalized supplements.
          </p>
        </div>

        <div className="space-y-8">

          {/* ── Gender + Age (same row) ── */}
          <div className="flex items-center gap-6 flex-wrap">

            {/* Gender */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-foreground flex-shrink-0">Gender</span>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.filter((opt) => !opt.hidden).map((opt) => {
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

            {/* Age */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-foreground flex-shrink-0">Age</span>
              <div className="flex items-end gap-3 flex-wrap">
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

          </div>

          {/* ── Reproductive status (female only) ── */}
          {isFemale && (
            <div className="overflow-x-auto scrollbar-hide">
              {loadingReproductive ? (
                <div className="flex gap-2 animate-pulse">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 w-24 rounded-full bg-muted" />)}
                </div>
              ) : (
                <div className="flex items-center gap-3 min-w-max">
                  <span className="text-sm font-semibold text-foreground">
                    Reproductive status
                  </span>
                  <div className="flex gap-2">
                    {[...(reproductiveNodes ?? [])]
                      .sort((a, b) => {
                        const ORDER = ["PRENATAL", "PREGNANCY", "BREASTFEEDING", "PREMENOPAUSAL", "MENOPAUSAL", "POSTMENOPAUSAL"];
                        const ai = ORDER.indexOf(a.nodeName);
                        const bi = ORDER.indexOf(b.nodeName);
                        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                      })
                      .map((node) => {
                        const isSelected = selectedReproductiveStatus === node.nodeName;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => setSelectedReproductiveStatus(isSelected ? "" : node.nodeName)}
                            className={`rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                          >
                            {node.displayName}
                          </button>
                        );
                      })}
                    {/* None — last, selected by default */}
                    <button
                      type="button"
                      onClick={() => setSelectedReproductiveStatus("")}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedReproductiveStatus === ""
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      None
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Food restrictions + Physical size (same row) ── */}
          <div className="flex items-start gap-10 flex-wrap">

            {/* Food restrictions */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-foreground flex-shrink-0">Food restrictions</span>
                <p className="text-xs text-muted-foreground">
                  Products are screened for these labels, but always check before ordering and using to ensure safety.
                </p>
              </div>
              {loadingRestrictions ? (
                <div className="flex gap-2 animate-pulse">
                  {[1, 2, 3].map((i) => <div key={i} className="h-8 w-16 rounded-full bg-muted" />)}
                </div>
              ) : (
                <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide">
                  {(restrictionNodes ?? [])
                    .filter((n) => !["vegan", "vegetarian"].includes(n.displayName.toLowerCase()))
                    .map((node) => {
                      const isSelected = selectedRestrictions.includes(node.nodeName);
                      const label = node.displayName.replace(/\s*Free$/i, "");
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => toggleRestriction(node.nodeName)}
                          className={`rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Physical size */}
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <span className="text-sm font-semibold text-foreground flex-shrink-0">Physical size</span>
                <p className="text-xs text-muted-foreground">
                  Helps us estimate appropriate nutrient dosages for your body.
                </p>
              </div>

              {!precisionOpen ? (
                /* ── Simple 3-state mode ── */
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-2">
                    {(["LOW", "MEDIUM", "HIGH"] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setBodySizeLocal(bodySizeLocal === size ? "" : size)}
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
                  <button
                    type="button"
                    onClick={() => setPrecisionOpen(true)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                  >
                    More precision
                  </button>
                </div>
              ) : (
                /* ── Precision mode ── */
                <div className="space-y-4">
                  {/* Metric / Imperial toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Units:</span>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleUnitToggle(false)}
                        className={`px-3 py-1 text-xs font-medium transition-colors border-r border-border ${
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
                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                          useImperialLocal
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        Imperial
                      </button>
                    </div>
                  </div>

                  {/* Height */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Height</label>
                    {!useImperialLocal ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={50}
                          max={280}
                          value={heightCmInput}
                          onChange={(e) => setHeightCmInput(e.target.value)}
                          placeholder="e.g. 170"
                          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-sm text-muted-foreground">cm</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={9}
                          value={heightFtInput}
                          onChange={(e) => setHeightFtInput(e.target.value)}
                          placeholder="ft"
                          className="w-16 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-sm text-muted-foreground">ft</span>
                        <input
                          type="number"
                          min={0}
                          max={11}
                          value={heightInInput}
                          onChange={(e) => setHeightInInput(e.target.value)}
                          placeholder="in"
                          className="w-16 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-sm text-muted-foreground">in</span>
                      </div>
                    )}
                  </div>

                  {/* Weight */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Weight</label>
                    <div className="flex items-center gap-2">
                      {!useImperialLocal ? (
                        <>
                          <input
                            type="number"
                            min={20}
                            max={500}
                            value={weightKgInput}
                            onChange={(e) => setWeightKgInput(e.target.value)}
                            placeholder="e.g. 70"
                            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                          />
                          <span className="text-sm text-muted-foreground">kg</span>
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            min={44}
                            max={1100}
                            value={weightLbsInput}
                            onChange={(e) => setWeightLbsInput(e.target.value)}
                            placeholder="e.g. 155"
                            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                          />
                          <span className="text-sm text-muted-foreground">lbs</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPrecisionOpen(false)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                  >
                    Less precision
                  </button>
                </div>
              )}
            </div>

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

          {/* ── Physical size / Measurements ── */}
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="text-sm font-semibold text-foreground flex-shrink-0">Physical size</span>
              <p className="text-xs text-muted-foreground">
                Helps us estimate appropriate nutrient dosages for your body.
              </p>
            </div>

            {!precisionOpen ? (
              /* ── Simple 3-state mode ── */
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-2">
                  {(["LOW", "MEDIUM", "HIGH"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setBodySizeLocal(bodySizeLocal === size ? "" : size)}
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
                <button
                  type="button"
                  onClick={() => setPrecisionOpen(true)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                >
                  More precision
                </button>
              </div>
            ) : (
              /* ── Precision mode ── */
              <div className="space-y-4">
                {/* Metric / Imperial toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Units:</span>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleUnitToggle(false)}
                      className={`px-3 py-1 text-xs font-medium transition-colors border-r border-border ${
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
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        useImperialLocal
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      Imperial
                    </button>
                  </div>
                </div>

                {/* Height */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Height</label>
                  {!useImperialLocal ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={50}
                        max={280}
                        value={heightCmInput}
                        onChange={(e) => setHeightCmInput(e.target.value)}
                        placeholder="e.g. 170"
                        className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                      />
                      <span className="text-sm text-muted-foreground">cm</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={9}
                        value={heightFtInput}
                        onChange={(e) => setHeightFtInput(e.target.value)}
                        placeholder="ft"
                        className="w-16 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                      />
                      <span className="text-sm text-muted-foreground">ft</span>
                      <input
                        type="number"
                        min={0}
                        max={11}
                        value={heightInInput}
                        onChange={(e) => setHeightInInput(e.target.value)}
                        placeholder="in"
                        className="w-16 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                      />
                      <span className="text-sm text-muted-foreground">in</span>
                    </div>
                  )}
                </div>

                {/* Weight */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Weight</label>
                  <div className="flex items-center gap-2">
                    {!useImperialLocal ? (
                      <>
                        <input
                          type="number"
                          min={20}
                          max={500}
                          value={weightKgInput}
                          onChange={(e) => setWeightKgInput(e.target.value)}
                          placeholder="e.g. 70"
                          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-sm text-muted-foreground">kg</span>
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          min={44}
                          max={1100}
                          value={weightLbsInput}
                          onChange={(e) => setWeightLbsInput(e.target.value)}
                          placeholder="e.g. 155"
                          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <span className="text-sm text-muted-foreground">lbs</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPrecisionOpen(false)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                >
                  Less precision
                </button>
              </div>
            )}
          </div>

          {/* ── Save button ── */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || savingBasicProfile}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving || savingBasicProfile ? "Saving…" : "Save Profile"}
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
