import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Goal } from "@/types/goals";

// The four personalization sections, in order.
export type SectionKey = "goals" | "profile" | "supplements" | "approach";

export const SECTION_ORDER: SectionKey[] = ["goals", "profile", "supplements", "approach"];

export const SECTION_LABELS: Record<SectionKey, string> = {
  goals: "Goals",
  profile: "Profile",
  supplements: "Current Supplements",
  approach: "Approach",
};

export const SECTION_IDS: Record<SectionKey, string> = {
  goals: "goals",
  profile: "profile",
  supplements: "supplements",
  approach: "approach",
};

interface RecommendationContextType {
  // Goals (section 1)
  selectedGoals: Goal[];
  setSelectedGoals: (goals: Goal[]) => void;

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
  const [savedSections, setSavedSections] = useState<Set<SectionKey>>(new Set());

  const saveSection = useCallback((key: SectionKey) => {
    setSavedSections((prev) => new Set([...prev, key]));
  }, []);

  const scrollToNextSection = useCallback(
    (currentSection: SectionKey) => {
      const currentIdx = SECTION_ORDER.indexOf(currentSection);

      // Find the next unsaved section after the current one
      const nextUnsaved = SECTION_ORDER.slice(currentIdx + 1).find(
        (s) => !savedSections.has(s) || s === currentSection
      );

      if (nextUnsaved && nextUnsaved !== currentSection) {
        const el = document.getElementById(SECTION_IDS[nextUnsaved]);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // All sections saved (or none left) — scroll to matches
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
