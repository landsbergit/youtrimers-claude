import { useState, useEffect } from "react";
import { CollapsibleFilterGroup } from "./CollapsibleFilterGroup";
import { useRecommendationContext } from "@/context/RecommendationContext";
import { useMemberMedications } from "@/hooks/useMemberMedications";
import { useMemberHealthConditions } from "@/hooks/useMemberHealthConditions";
import GoalsSection from "@/components/goals/GoalsSection";
import ProfileSection from "@/components/sections/ProfileSection";
import PreferencesSection from "@/components/sections/PreferencesSection";
import ApproachSection from "@/components/sections/ApproachSection";

function approachLabel(qualityWeight: number): string {
  if (qualityWeight === 0.1) return "Price first";
  if (qualityWeight === 0.5) return "Balanced price and quality";
  if (qualityWeight === 0.9) return "Quality first";
  return `${Math.round(qualityWeight * 100)}% quality`;
}

/** Capitalize first letter of each word, lowercase the rest */
function titleCase(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FilterSidebar() {
  const {
    selectedGoals,
    gender,
    reproductiveStatus,
    birthYear,
    birthMonth,
    bodySize,
    heightCm,
    weightKg,
    acceptedDosageFormNames,
    religiousPreferences,
    qualityWeight,
    diversityWeight,
    maxBundleSize,
    savedSections,
  } = useRecommendationContext();
  const { medications } = useMemberMedications();
  const { conditions } = useMemberHealthConditions();

  // Re-read localStorage values reactively (tick increments on any context change)
  const [, setTick] = useState(0);
  useEffect(() => { setTick((t) => t + 1); }, [savedSections, gender, birthYear, birthMonth, reproductiveStatus, bodySize, heightCm, weightKg, acceptedDosageFormNames, religiousPreferences, qualityWeight, diversityWeight, selectedGoals, medications, conditions]);

  const goalsSummary =
    selectedGoals.length > 0
      ? selectedGoals.map((g) => titleCase(g.display_name)).join(", ")
      : "No goals selected";

  const profileParts: string[] = [];
  if (gender) profileParts.push(`Gender: ${gender.charAt(0) + gender.slice(1).toLowerCase()}`);
  if (birthYear) {
    const now = new Date();
    let age = now.getFullYear() - birthYear;
    if (birthMonth && now.getMonth() + 1 < birthMonth) age -= 1;
    profileParts.push(`Age: ${age}`);
  }
  if (reproductiveStatus) {
    profileParts.push(`Fertility: ${reproductiveStatus.charAt(0) + reproductiveStatus.slice(1).toLowerCase()}`);
  }
  if (medications.length > 0) profileParts.push(`Medications: ${medications.map((m) => titleCase(m.displayName)).join(", ")}`);
  if (conditions.length > 0) profileParts.push(`Conditions: ${conditions.map((c) => titleCase(c.displayName)).join(", ")}`);
  const foodRestrictions: string[] = (() => {
    try { return JSON.parse(localStorage.getItem("youtrimers_food_restrictions") ?? "[]"); }
    catch { return []; }
  })();
  if (foodRestrictions.length > 0) profileParts.push(`Restrictions: ${foodRestrictions.map((r) => titleCase(r.replace(/\s*free$/i, ""))).join(", ")}`);
  if (bodySize) profileParts.push(`Physical size: ${bodySize === "LOW" ? "Small" : bodySize === "MEDIUM" ? "Medium" : "Large"}`);
  else if (heightCm || weightKg) {
    const parts: string[] = [];
    if (heightCm) parts.push(`${heightCm}cm`);
    if (weightKg) parts.push(`${weightKg}kg`);
    profileParts.push(`Size: ${parts.join(", ")}`);
  }
  const profileSummary = profileParts.length > 0 ? profileParts.join(" · ") : "Not set";

  const foodPrefs: string[] = (() => {
    try { return JSON.parse(localStorage.getItem("youtrimers_food_prefs") ?? "[]"); }
    catch { return []; }
  })();
  const prefsParts: string[] = [];
  if (acceptedDosageFormNames.length > 0) {
    if (acceptedDosageFormNames.length <= 3) {
      prefsParts.push(`Dosage: ${acceptedDosageFormNames.map((n) => titleCase(n)).join(", ")}`);
    } else {
      // Classify into simplified label based on known solid forms
      const SOLID_FORMS = new Set(["TABLET", "CAPSULE", "SOFTGEL", "CAPLET", "CHEWABLE", "GUMMY", "LOZENGE", "WAFER", "NUGGETS", "PELLET", "STRIP", "BAR"]);
      const hasSolid = acceptedDosageFormNames.some((n) => SOLID_FORMS.has(n));
      const hasNonSolid = acceptedDosageFormNames.some((n) => !SOLID_FORMS.has(n));
      const label = hasSolid && hasNonSolid ? "Any" : hasSolid ? "Solid only" : "Non-solid only";
      prefsParts.push(`Dosage: ${label}`);
    }
  }
  if (foodPrefs.length > 0) prefsParts.push(`Food: ${foodPrefs.map((p) => titleCase(p)).join(", ")}`);
  if (religiousPreferences.length > 0) prefsParts.push(`Religious: ${religiousPreferences.map((r) => titleCase(r)).join(", ")}`);
  prefsParts.push(`Products: ${maxBundleSize === 1 ? "Single" : `Up to ${maxBundleSize}`}`);
  const prefsSummary = prefsParts.length > 0 ? prefsParts.join(" · ") : "Defaults";

  const approachSummary = `Price/Quality: ${approachLabel(qualityWeight)} · Diversity: ${
    diversityWeight === 0 ? "Focused" : diversityWeight === 0.5 ? "Balanced" : diversityWeight === 1 ? "Diverse" : `${Math.round(diversityWeight * 100)}%`
  }`;

  return (
    <aside>
      <p className="text-xs text-muted-foreground text-center mb-2">Personalization Panel</p>
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
      <CollapsibleFilterGroup title="Goals" defaultOpen summary={goalsSummary}>
        <GoalsSection />
      </CollapsibleFilterGroup>

      <CollapsibleFilterGroup title="Profile" defaultOpen summary={profileSummary}>
        <ProfileSection />
      </CollapsibleFilterGroup>

      <CollapsibleFilterGroup title="Preferences" defaultOpen summary={prefsSummary}>
        <PreferencesSection />
      </CollapsibleFilterGroup>

      <CollapsibleFilterGroup title="Approach" defaultOpen summary={approachSummary}>
        <ApproachSection />
      </CollapsibleFilterGroup>
      </div>
    </aside>
  );
}
