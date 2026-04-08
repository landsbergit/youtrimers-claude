import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Goal } from "@/types/goals";

interface UseGoalsResult {
  /** All active nodes in the ontology with type = 'goals' */
  goalNodes: Goal[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches all active goal nodes from the ontology table.
 * The caller filters by parent_id to get goals per category.
 */
export function useGoals(): UseGoalsResult {
  const [goalNodes, setGoalNodes] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoals = async () => {
      const { data, error } = await supabase
        .from("ontology")
        .select("id, node_name, display_name, parent_id")
        .eq("type", "goals")
        .eq("is_active", true)
        .order("sort_order");

      if (error) {
        setError(error.message);
      } else if (data) {
        setGoalNodes(data);
      }
      setLoading(false);
    };

    fetchGoals();
  }, []);

  return { goalNodes, loading, error };
}
