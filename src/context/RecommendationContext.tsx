import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Goal } from "@/types/goals";
import type { RankedProduct } from "@/types/engine";

// The five personalization sections, in page order.
export type SectionKey = "goals" | "profile" | "preferences" | "supplements" | "approach";

// "supplements" (Review) comes after Matches, so it's last in the auto-scroll chain.
export const SECTION_ORDER: SectionKey[] = ["goals", "profile", "preferences", "approach", "supplements"];

// The four sections shown in the "Personalize" sticky bar (no Review/supplements).
export const PERSONALIZE_SECTION_ORDER: SectionKey[] = ["goals", "profile", "preferences", "approach"];

export const SECTION_LABELS: Record<SectionKey, string> = {
  goals: "Goals",
  profile: "Profile",
  preferences: "Preferences",
  supplements: "Review",
  approach: "Approach",
};

export const SECTION_IDS: Record<SectionKey, string> = {
  goals: "goals",
  profile: "profile",
  preferences: "preferences",
  supplements: "supplements",
  approach: "approach",
};

const LS_BIRTH_YEAR      = "youtrimers_birth_year";
const LS_BIRTH_MONTH     = "youtrimers_birth_month";
const LS_GENDER          = "youtrimers_gender";
const LS_REPRO_STATUS    = "youtrimers_reproductive_status";
const LS_DOSAGE_FORMS    = "youtrimers_dosage_forms";
const LS_DOSAGE_SAVED    = "youtrimers_dosage_saved";
const LS_RELIGIOUS_PREFS = "youtrimers_religious_preferences";
const LS_FOOD_PREFS      = "youtrimers_food_prefs";
const LS_FOOD_RESTRICT   = "youtrimers_food_restrictions";
const LS_BODY_SIZE       = "youtrimers_body_size";
const LS_HEIGHT_CM       = "youtrimers_height_cm";
const LS_WEIGHT_KG       = "youtrimers_weight_kg";
const LS_USE_IMPERIAL    = "youtrimers_use_imperial";

interface RecommendationContextType {
  // Goals (section 1)
  selectedGoals: Goal[];
  setSelectedGoals: (goals: Goal[]) => void;

  // Profile (section 2)
  gender: string | null;
  setGender: (g: string | null) => void;
  reproductiveStatus: string | null;
  setReproductiveStatus: (s: string | null) => void;
  birthYear: number | null;
  setBirthYear: (y: number | null) => void;
  birthMonth: number | null;
  setBirthMonth: (m: number | null) => void;

  // Preferences (section 3): dosage form filter
  acceptedDosageFormNames: string[];
  setAcceptedDosageFormNames: (names: string[]) => void;
  /** True once the user has explicitly saved their dosage form preferences.
   *  When true, age changes no longer auto-update the dosage form selection. */
  dosageFormPreferencesSaved: boolean;
  setDosageFormPreferencesSaved: (saved: boolean) => void;

  // Preferences (section 3): religious certification filter
  /** node_names of selected religious certifications, e.g. ["KOSHER", "HALAL"]. Empty = no filter. */
  religiousPreferences: string[];
  setReligiousPreferences: (names: string[]) => void;

  // Preferences (section 3): food preference tags (scoring boost)
  /** node_names of selected food preferences, e.g. ["ORGANIC", "VEGAN"]. Empty = no boost. */
  foodPreferences: string[];
  setFoodPreferences: (names: string[]) => void;

  // Profile (section 2): food restriction tags (hard exclusion + "Free" boost)
  /** node_names of selected food restrictions, e.g. ["LACTOSE_FREE", "GLUTEN_FREE"]. */
  foodRestrictions: string[];
  setFoodRestrictions: (names: string[]) => void;

  // Body size / measurements (section 2, bottom — future engine use)
  bodySize: "LOW" | "MEDIUM" | "HIGH" | null;
  setBodySize: (s: "LOW" | "MEDIUM" | "HIGH" | null) => void;
  heightCm: number | null;
  setHeightCm: (h: number | null) => void;
  weightKg: number | null;
  setWeightKg: (w: number | null) => void;
  /** Display unit preference: false = metric (default), true = imperial */
  useImperial: boolean;
  setUseImperial: (v: boolean) => void;

  // Approach (section 5): 0 = full price priority, 1 = full quality priority
  qualityWeight: number;
  setQualityWeight: (w: number) => void;

  // Bundle size: 1 = singles only, 2 = pairs (default), 3 = triplets
  maxBundleSize: number;
  setMaxBundleSize: (n: number) => void;

  // Diversity: 0 = focused (pure relevance), 1 = diverse (max spread). Default 0.5 = balanced.
  diversityWeight: number;
  setDiversityWeight: (w: number) => void;

  // Which sections have been saved
  savedSections: Set<SectionKey>;
  saveSection: (key: SectionKey) => void;

  // Similar products mode: when set, MatchesSection filters to products similar
  // to this anchor and pins the anchor at the top. Session-only state.
  similarAnchor: RankedProduct | null;
  setSimilarAnchor: (rp: RankedProduct | null) => void;

  // Derived: goal IDs for the engine
  goalIds: string[];

  // Convenience: scroll to the next unsaved section (or to #matches if all done)
  scrollToNextSection: (currentSection: SectionKey) => void;
}

const RecommendationContext = createContext<RecommendationContextType | null>(null);

export function RecommendationProvider({ children }: { children: ReactNode }) {
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);

  const [gender, setGenderState] = useState<string | null>(() => {
    return localStorage.getItem(LS_GENDER) || null;
  });
  const [reproductiveStatus, setReproductiveStatusState] = useState<string | null>(() => {
    return localStorage.getItem(LS_REPRO_STATUS) || null;
  });
  const [birthYear, setBirthYearState] = useState<number | null>(() => {
    const v = localStorage.getItem(LS_BIRTH_YEAR);
    return v ? Number(v) : null;
  });
  const [birthMonth, setBirthMonthState] = useState<number | null>(() => {
    const v = localStorage.getItem(LS_BIRTH_MONTH);
    return v ? Number(v) : null;
  });

  const [acceptedDosageFormNames, setAcceptedDosageFormNamesState] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_DOSAGE_FORMS) ?? "[]"); }
    catch { return []; }
  });
  const [dosageFormPreferencesSaved, setDosageFormPreferencesSavedState] = useState<boolean>(() => {
    return localStorage.getItem(LS_DOSAGE_SAVED) === "1";
  });

  const [religiousPreferences, setReligiousPreferencesState] = useState<string[]>(() => {
    try {
      // Stored as {id, nodeName}[] by useMemberReligiousPreferences hook
      const raw = JSON.parse(localStorage.getItem(LS_RELIGIOUS_PREFS) ?? "[]");
      if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
        return (raw as { nodeName: string }[]).map((r) => r.nodeName);
      }
      return [];
    } catch { return []; }
  });

  const [foodPreferences, setFoodPreferencesState] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_FOOD_PREFS) ?? "[]"); }
    catch { return []; }
  });

  const [foodRestrictions, setFoodRestrictionsState] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_FOOD_RESTRICT) ?? "[]"); }
    catch { return []; }
  });

  const [bodySize, setBodySizeState] = useState<"LOW" | "MEDIUM" | "HIGH" | null>(() => {
    const v = localStorage.getItem(LS_BODY_SIZE);
    return (v === "LOW" || v === "MEDIUM" || v === "HIGH") ? v : null;
  });
  const [heightCm, setHeightCmState] = useState<number | null>(() => {
    const v = localStorage.getItem(LS_HEIGHT_CM);
    return v ? Number(v) : null;
  });
  const [weightKg, setWeightKgState] = useState<number | null>(() => {
    const v = localStorage.getItem(LS_WEIGHT_KG);
    return v ? Number(v) : null;
  });
  const [useImperial, setUseImperialState] = useState<boolean>(() => {
    return localStorage.getItem(LS_USE_IMPERIAL) === "1";
  });

  const [qualityWeight, setQualityWeight] = useState<number>(0.5);
  const [maxBundleSize, setMaxBundleSize] = useState<number>(2);
  const [diversityWeight, setDiversityWeight] = useState<number>(0.5);
  const [savedSections, setSavedSections] = useState<Set<SectionKey>>(new Set());
  const [similarAnchor, setSimilarAnchor] = useState<RankedProduct | null>(null);

  const setGender = useCallback((g: string | null) => {
    setGenderState(g);
    if (g) localStorage.setItem(LS_GENDER, g);
    else localStorage.removeItem(LS_GENDER);
  }, []);

  const setReproductiveStatus = useCallback((s: string | null) => {
    setReproductiveStatusState(s);
    if (s) localStorage.setItem(LS_REPRO_STATUS, s);
    else localStorage.removeItem(LS_REPRO_STATUS);
  }, []);

  const setBirthYear = useCallback((y: number | null) => {
    setBirthYearState(y);
    if (y != null) localStorage.setItem(LS_BIRTH_YEAR, String(y));
    else localStorage.removeItem(LS_BIRTH_YEAR);
  }, []);

  const setBirthMonth = useCallback((m: number | null) => {
    setBirthMonthState(m);
    if (m != null) localStorage.setItem(LS_BIRTH_MONTH, String(m));
    else localStorage.removeItem(LS_BIRTH_MONTH);
  }, []);

  const setAcceptedDosageFormNames = useCallback((names: string[]) => {
    setAcceptedDosageFormNamesState(names);
    localStorage.setItem(LS_DOSAGE_FORMS, JSON.stringify(names));
  }, []);

  const setDosageFormPreferencesSaved = useCallback((saved: boolean) => {
    setDosageFormPreferencesSavedState(saved);
    if (saved) localStorage.setItem(LS_DOSAGE_SAVED, "1");
    else localStorage.removeItem(LS_DOSAGE_SAVED);
  }, []);

  // religiousPreferences state is written to localStorage by useMemberReligiousPreferences;
  // this setter only updates context state so the engine re-runs immediately on save.
  const setReligiousPreferences = useCallback((names: string[]) => {
    setReligiousPreferencesState(names);
  }, []);

  const setFoodPreferences = useCallback((names: string[]) => {
    setFoodPreferencesState(names);
    localStorage.setItem(LS_FOOD_PREFS, JSON.stringify(names));
  }, []);

  const setFoodRestrictions = useCallback((names: string[]) => {
    setFoodRestrictionsState(names);
    localStorage.setItem(LS_FOOD_RESTRICT, JSON.stringify(names));
  }, []);

  const setBodySize = useCallback((s: "LOW" | "MEDIUM" | "HIGH" | null) => {
    setBodySizeState(s);
    if (s) localStorage.setItem(LS_BODY_SIZE, s);
    else localStorage.removeItem(LS_BODY_SIZE);
  }, []);

  const setHeightCm = useCallback((h: number | null) => {
    setHeightCmState(h);
    if (h != null) localStorage.setItem(LS_HEIGHT_CM, String(h));
    else localStorage.removeItem(LS_HEIGHT_CM);
  }, []);

  const setWeightKg = useCallback((w: number | null) => {
    setWeightKgState(w);
    if (w != null) localStorage.setItem(LS_WEIGHT_KG, String(w));
    else localStorage.removeItem(LS_WEIGHT_KG);
  }, []);

  const setUseImperial = useCallback((v: boolean) => {
    setUseImperialState(v);
    if (v) localStorage.setItem(LS_USE_IMPERIAL, "1");
    else localStorage.removeItem(LS_USE_IMPERIAL);
  }, []);

  const saveSection = useCallback((key: SectionKey) => {
    setSavedSections((prev) => new Set([...prev, key]));
  }, []);

  const scrollToNextSection = useCallback(
    (currentSection: SectionKey) => {
      const currentIdx = SECTION_ORDER.indexOf(currentSection);

      const nextUnsaved = SECTION_ORDER.slice(currentIdx + 1).find(
        (s) => !savedSections.has(s) || s === currentSection
      );

      if (nextUnsaved && nextUnsaved !== currentSection) {
        const el = document.getElementById(SECTION_IDS[nextUnsaved]);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const el = document.getElementById("matches");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [savedSections]
  );

  const goalIds = selectedGoals.map((g) => g.id);

  return (
    <RecommendationContext.Provider
      value={{
        selectedGoals,
        setSelectedGoals,
        gender,
        setGender,
        reproductiveStatus,
        setReproductiveStatus,
        birthYear,
        setBirthYear,
        birthMonth,
        setBirthMonth,
        acceptedDosageFormNames,
        setAcceptedDosageFormNames,
        dosageFormPreferencesSaved,
        setDosageFormPreferencesSaved,
        religiousPreferences,
        setReligiousPreferences,
        foodPreferences,
        setFoodPreferences,
        foodRestrictions,
        setFoodRestrictions,
        bodySize,
        setBodySize,
        heightCm,
        setHeightCm,
        weightKg,
        setWeightKg,
        useImperial,
        setUseImperial,
        qualityWeight,
        setQualityWeight,
        maxBundleSize,
        setMaxBundleSize,
        diversityWeight,
        setDiversityWeight,
        savedSections,
        saveSection,
        similarAnchor,
        setSimilarAnchor,
        goalIds,
        scrollToNextSection,
      }}
    >
      {children}
    </RecommendationContext.Provider>
  );
}

export function useRecommendationContext() {
  const ctx = useContext(RecommendationContext);
  if (!ctx) {
    throw new Error(
      "useRecommendationContext must be used inside RecommendationProvider"
    );
  }
  return ctx;
}
