import { Stethoscope, Brain, Droplets, Dumbbell, Heart, Hourglass } from "lucide-react";

export interface Goal {
  id: string;
  name: string;
  category: string;
}

export const MAX_SELECTED_GOALS = 3;

// Categories are hard-coded; goals within each are loaded from Supabase
export const GOAL_CATEGORIES = [
  { name: "Health",       icon: Stethoscope },
  { name: "Cognitive",    icon: Brain       },
  { name: "Beauty",       icon: Droplets    },
  { name: "Fitness",      icon: Dumbbell    },
  { name: "Reproductive", icon: Heart       },
  { name: "Longevity",    icon: Hourglass   },
] as const;
