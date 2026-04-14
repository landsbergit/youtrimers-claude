import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

const LS_KEY = "youtrimers_religious_preferences";

export interface SelectedReligiousPreference {
  id: string;       // ontology node UUID
  nodeName: string; // e.g. "KOSHER" — used by engine filter and stored in normalizedTags
}

function loadFromLocalStorage(): SelectedReligiousPreference[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    // Guard against stale plain-string arrays from old format
    if (Array.isArray(raw) && (raw.length === 0 || typeof raw[0] === "object")) {
      return raw as SelectedReligiousPreference[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Manages the member's selected religious dietary preferences (KOSHER, HALAL, …).
 *
 * Persistence:
 *  - Always written to localStorage so selections survive page refresh.
 *  - If user is logged in, savePreferences() also syncs to the
 *    member_religious_preferences table for their primary member.
 *  - On mount, Supabase data takes precedence over localStorage.
 */
export function useMemberReligiousPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<SelectedReligiousPreference[]>(
    loadFromLocalStorage,
  );
  const [saving, setSaving] = useState(false);

  // On login, load authoritative data from Supabase
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
        .from("member_religious_preferences")
        .select("node_id, ontology(node_name)")
        .eq("member_id", member.id);

      if (rows && rows.length > 0) {
        const loaded: SelectedReligiousPreference[] = rows.map((r) => ({
          id: r.node_id,
          nodeName:
            (r.ontology as { node_name: string } | null)?.node_name ?? r.node_id,
        }));
        setPreferences(loaded);
        localStorage.setItem(LS_KEY, JSON.stringify(loaded));
      }
    })();
  }, [user]);

  const togglePreference = useCallback((pref: SelectedReligiousPreference) => {
    setPreferences((prev) =>
      prev.some((p) => p.id === pref.id)
        ? prev.filter((p) => p.id !== pref.id)
        : [...prev, pref],
    );
  }, []);

  const savePreferences = useCallback(
    async (): Promise<{ error: Error | null }> => {
      localStorage.setItem(LS_KEY, JSON.stringify(preferences));

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

        const { error: delErr } = await supabase
          .from("member_religious_preferences")
          .delete()
          .eq("member_id", member.id);

        if (delErr) throw delErr;

        if (preferences.length > 0) {
          const { error: insErr } = await supabase
            .from("member_religious_preferences")
            .insert(preferences.map((p) => ({ member_id: member.id, node_id: p.id })));
          if (insErr) throw insErr;
        }

        return { error: null };
      } catch (err) {
        return { error: err as Error };
      } finally {
        setSaving(false);
      }
    },
    [preferences, user],
  );

  return { preferences, togglePreference, savePreferences, saving };
}
