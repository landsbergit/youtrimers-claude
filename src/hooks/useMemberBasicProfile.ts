import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

/**
 * Manages saving the member's basic body profile to Supabase.
 *
 * Persistence:
 *  - localStorage is written via RecommendationContext setters (called by ProfileSection).
 *  - On login, ProfileSection loads from Supabase and pushes values to context.
 *  - saveBasicProfile() upserts to member_basic_profile (one row per member).
 */
export function useMemberBasicProfile() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const saveBasicProfile = useCallback(
    async (
      bodySize: "LOW" | "MEDIUM" | "HIGH" | null,
      heightCm: number | null,
      weightKg: number | null,
    ): Promise<{ error: Error | null }> => {
      if (!user) return { error: null }; // guest: localStorage only, nothing to persist

      setSaving(true);
      try {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_primary", true)
          .maybeSingle();

        if (!member) return { error: new Error("No primary member found") };

        const { error } = await supabase.from("member_basic_profile").upsert(
          {
            member_id: member.id,
            body_size: bodySize,
            height_cm: heightCm,
            weight_kg: weightKg,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" },
        );

        if (error) throw error;
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  return { saveBasicProfile, saving };
}
