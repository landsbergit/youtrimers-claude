import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Goal } from "@/types/goals";

// The five personalization sections, in page order.
export type SectionKey = "goals" | "profile" | "preferences" | "supplements" | "approach";

export const SECTION_ORDER: SectionKey[] = ["goals", "profile", "preferences", "supplements", "approach"];

export const SECTION_LABELS: Record<SectionKey, string> = {
  goals: "Goals",
  profile: "Profile",
  preferences: "Preferences",
  supplements: "Current Supplements",
  approach: "Approach",
};

export const SECTION_IDS: Record<SectionKey, string> = {
  goals: "goals",
  profile: "profile",
  preferences: "preferences",
  supplements: "supplements",
  approach: "approach",
};

const LS_BIRTH_YEAR   = "youtrimers_birth_year";
const LS_BIRTH_MONTH  = "youtrimers_birth_month";
const LS_GENDER       = "youtrimers_gender";
const LS_REPRO_STATUS = "youtrimers_reproductive_status";
const LS_DOSAGE_FORMS = "youtrimers_dosage_forms";
const LS_DOSAGE_SAVED = "youtrimers_dosage_saved";

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

  const [qualityWeight, setQualityWeight] = useState<number>(0.5);
  const [maxBundleSize, setMaxBundleSize] = useState<number>(2);
  const [diversityWeight, setDiversityWeight] = useState<number>(0.5);
  const [savedSections, setSavedSections] = useState<Set<SectionKey>>(new Set());

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
        qualityWeight,
        setQualityWeight,
        maxBundleSize,
        setMaxBundleSize,
        diversityWeight,
        setDiversityWeight,
        savedSections,
        saveSection,
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
