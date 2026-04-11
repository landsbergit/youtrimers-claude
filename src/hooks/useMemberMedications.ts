import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

const LS_KEY = "youtrimers_medications";

export interface SelectedMedication {
  id: string;          // ontology node UUID
  displayName: string;
}

function loadFromLocalStorage(): SelectedMedication[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Manages the member's selected medications.
 *
 * Persistence:
 *  - Always written to localStorage so selections survive page refresh.
 *  - If user is logged in, saveMedications() also syncs to the
 *    member_medications table for their primary member.
 *  - On mount, Supabase data takes precedence over localStorage when
 *    the user is logged in.
 */
export function useMemberMedications() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<SelectedMedication[]>(loadFromLocalStorage);
  const [saving, setSaving] = useState(false);

  // On login, load authoritative data from Supabase and overwrite localStorage
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

      const { data: rows } = await supabase
        .from("member_medications")
        .select("ontology_node_id, ontology(display_name)")
        .eq("member_id", member.id);

      if (rows && rows.length > 0) {
        const meds: SelectedMedication[] = rows.map((r) => ({
          id: r.ontology_node_id,
          displayName: (r.ontology as { display_name: string } | null)?.display_name ?? r.ontology_node_id,
        }));
        setMedications(meds);
        localStorage.setItem(LS_KEY, JSON.stringify(meds));
      }
    })();
  }, [user]);

  const addMedication = useCallback((med: SelectedMedication) => {
    setMedications((prev) =>
      prev.some((m) => m.id === med.id) ? prev : [...prev, med],
    );
  }, []);

  const removeMedication = useCallback((id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /** Persist to localStorage (always) and Supabase (when logged in). */
  const saveMedications = useCallback(async (): Promise<{ error: Error | null }> => {
    // Always persist locally first
    localStorage.setItem(LS_KEY, JSON.stringify(medications));

    if (!user) return { error: null };

    setSaving(true);
    try {
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .maybeSingle();

      if (!member) return { error: new Error("No primary member found") };

      // Replace: delete all existing, then insert current selections
      const { error: delErr } = await supabase
        .from("member_medications")
        .delete()
        .eq("member_id", member.id);

      if (delErr) throw delErr;

      if (medications.length > 0) {
        const { error: insErr } = await supabase.from("member_medications").insert(
          medications.map((m) => ({
            member_id: member.id,
            ontology_node_id: m.id,
          })),
        );
        if (insErr) throw insErr;
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    } finally {
      setSaving(false);
    }
  }, [medications, user]);

  return { medications, addMedication, removeMedication, saveMedications, saving };
}
