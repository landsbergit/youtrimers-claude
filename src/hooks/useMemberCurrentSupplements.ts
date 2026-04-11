import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

const LS_KEY = "youtrimers_current_supplements";

export interface CurrentSupplement {
  productId: number;
  productName: string;
  brand: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  costUsd: number | null;
  normalizedDosageForm: string | null;
}

function loadFromLocalStorage(): CurrentSupplement[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); }
  catch { return []; }
}

/**
 * Manages the member's list of currently-used supplement products.
 *
 * Persistence:
 *  - Always written to localStorage immediately on add/remove.
 *  - If user is logged in, saveSupplements() also syncs to
 *    member_current_supplements for their primary member.
 *  - On login, Supabase data takes precedence over localStorage.
 */
export function useMemberCurrentSupplements() {
  const { user } = useAuth();
  const [supplements, setSupplements] = useState<CurrentSupplement[]>(loadFromLocalStorage);
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
        .from("member_current_supplements")
        .select("product_id")
        .eq("member_id", member.id);

      if (!rows || rows.length === 0) return;

      const productIds = rows.map((r) => r.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, product_name, brand, image_url, product_url, cost_usd, normalized_dosage_form")
        .in("id", productIds);

      if (!products) return;

      const loaded: CurrentSupplement[] = products.map((p) => ({
        productId: p.id,
        productName: p.product_name,
        brand: p.brand ?? null,
        imageUrl: p.image_url ?? null,
        productUrl: p.product_url ?? null,
        costUsd: p.cost_usd ?? null,
        normalizedDosageForm: p.normalized_dosage_form ?? null,
      }));

      setSupplements(loaded);
      localStorage.setItem(LS_KEY, JSON.stringify(loaded));
    })();
  }, [user]);

  const addSupplement = useCallback((s: CurrentSupplement) => {
    setSupplements((prev) => {
      if (prev.some((x) => x.productId === s.productId)) return prev;
      const next = [...prev, s];
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeSupplement = useCallback((productId: number) => {
    setSupplements((prev) => {
      const next = prev.filter((x) => x.productId !== productId);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** Persist current list to Supabase (replace all for this member). */
  const saveSupplements = useCallback(async (): Promise<{ error: Error | null }> => {
    localStorage.setItem(LS_KEY, JSON.stringify(supplements));
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
        .from("member_current_supplements")
        .delete()
        .eq("member_id", member.id);
      if (delErr) throw delErr;

      if (supplements.length > 0) {
        const { error: insErr } = await supabase
          .from("member_current_supplements")
          .insert(supplements.map((s) => ({ member_id: member.id, product_id: s.productId })));
        if (insErr) throw insErr;
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    } finally {
      setSaving(false);
    }
  }, [supplements, user]);

  return { supplements, addSupplement, removeSupplement, saveSupplements, saving };
}
