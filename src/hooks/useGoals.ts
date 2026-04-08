import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Goal } from "@/types/goals";

interface UseGoalsResult {
  goals: Goal[];
  loading: boolean;
  error: string | null;
}

export function useGoals(): UseGoalsResult {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoals = async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, name, category")
        .order("name");

      if (error) {
        setError(error.message);
      } else if (data) {
        setGoals(data);
      }
      setLoading(false);
    };

    fetchGoals();
  }, []);

  return { goals, loading, error };
}
