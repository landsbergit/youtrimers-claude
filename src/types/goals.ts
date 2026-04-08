import { Stethoscope, Brain, Droplets, Dumbbell, Heart, Hourglass } from "lucide-react";

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
  { label: "Health",       node_name: "HEALTH_GOALS_CATEGORY", icon: Stethoscope },
  { label: "Cognitive",    node_name: "COGNITIVE_CATEGORY",     icon: Brain       },
  { label: "Beauty",       node_name: "BEAUTY_CATEGORY",        icon: Droplets    },
  { label: "Fitness",      node_name: "FITNESS_CATEGORY",       icon: Dumbbell    },
  { label: "Reproductive", node_name: "REPRODUCTIVE_CATEGORY",  icon: Heart       },
  { label: "Longevity",    node_name: "LONGEVITY_CATEGORY",     icon: Hourglass   },
] as const;
