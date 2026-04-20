import { Stethoscope, Brain, Sparkles, Dumbbell, Heart, Hourglass } from "lucide-react";

/** A goal node from the ontology table (type = 'goals') */
export interface Goal {
  id: string;
  node_name: string;
  display_name: string;
  parent_id: string | null;
}

export const MAX_SELECTED_GOALS = 3;

/**
 * Hard-coded category definitions.
 * node_name must match a row in the ontology table.
 * Goals shown per category are the direct children of that node.
 */
export const GOAL_CATEGORIES = [
  { label: "Mind",         node_name: "COGNITIVE_CATEGORY",     icon: Brain       },
  { label: "Beauty",       node_name: "BEAUTY_CATEGORY",        icon: Sparkles    },
  { label: "Fitness",      node_name: "FITNESS_CATEGORY",       icon: Dumbbell    },
  { label: "Fertility",    node_name: "REPRODUCTIVE_CATEGORY",  icon: Heart       },
  { label: "Vitality",     node_name: "LONGEVITY_CATEGORY",     icon: Hourglass   },
  { label: "Health",       node_name: "HEALTH_GOALS_CATEGORY",  icon: Stethoscope },
] as const;
