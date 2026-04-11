import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

const LS_KEY = "youtrimers_health_conditions";

export interface SelectedCondition {
  id: string;          // ontology node UUID
  displayName: string;
}

function loadFromLocalStorage(): SelectedCondition[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Manages the member's selected health conditions.
 *
 * Persistence:
 *  - Always written to localStorage so selections survive page refresh.
 *  - If user is logged in, saveConditions() also syncs to the
 *    member_health_conditions table for their primary member.
 *  - On mount, Supabase data takes precedence over localStorage.
 */
export function useMemberHealthConditions() {
  const { user } = useAuth();
  const [conditions, setConditions] = useState<SelectedCondition[]>(loadFromLocalStorage);
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
        .from("member_health_conditions")
        .select("node_id, ontology(display_name)")
        .eq("member_id", member.id);

      if (rows && rows.length > 0) {
        const loaded: SelectedCondition[] = rows.map((r) => ({
          id: r.node_id,
          displayName:
            (r.ontology as { display_name: string } | null)?.display_name ?? r.node_id,
        }));
        setConditions(loaded);
        localStorage.setItem(LS_KEY, JSON.stringify(loaded));
      }
    })();
  }, [user]);

  const addCondition = useCallback((condition: SelectedCondition) => {
    setConditions((prev) =>
      prev.some((c) => c.id === condition.id) ? prev : [...prev, condition],
    );
  }, []);

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const toggleCondition = useCallback((condition: SelectedCondition) => {
    setConditions((prev) =>
      prev.some((c) => c.id === condition.id)
        ? prev.filter((c) => c.id !== condition.id)
        : [...prev, condition],
    );
  }, []);

  const saveConditions = useCallback(async (): Promise<{ error: Error | null }> => {
    localStorage.setItem(LS_KEY, JSON.stringify(conditions));

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
        .from("member_health_conditions")
        .delete()
        .eq("member_id", member.id);

      if (delErr) throw delErr;

      if (conditions.length > 0) {
        const { error: insErr } = await supabase
          .from("member_health_conditions")
          .insert(conditions.map((c) => ({ member_id: member.id, node_id: c.id })));
        if (insErr) throw insErr;
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    } finally {
      setSaving(false);
    }
  }, [conditions, user]);

  return { conditions, addCondition, removeCondition, toggleCondition, saveConditions, saving };
}
