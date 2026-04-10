export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      member_goals: {
        Row: {
          id: string;
          member_id: string;
          goal_id: string;  // references ontology.id
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          goal_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          goal_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_goals_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "ontology";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_goals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          age: number | null;
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_primary: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          age?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_primary?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          age?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_primary?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          max_members: number;
          updated_at: string;
          user_id: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          max_members?: number;
          updated_at?: string;
          user_id: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          max_members?: number;
          updated_at?: string;
          user_id?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: number;
          product_name: string;
          product_url: string | null;
          product_code: string | null;
          upc: string | null;
          image_url: string | null;
          normalized_dosage_form: string | null;
          servings_per_container: number | null;
          package_quantity: number | null;
          cost_usd: number | null;
          normalized_tags: string[] | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          product_name: string;
          product_url?: string | null;
          product_code?: string | null;
          upc?: string | null;
          image_url?: string | null;
          normalized_dosage_form?: string | null;
          servings_per_container?: number | null;
          package_quantity?: number | null;
          cost_usd?: number | null;
          normalized_tags?: string[] | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          product_name?: string;
          product_url?: string | null;
          product_code?: string | null;
          upc?: string | null;
          image_url?: string | null;
          normalized_dosage_form?: string | null;
          servings_per_container?: number | null;
          package_quantity?: number | null;
          cost_usd?: number | null;
          normalized_tags?: string[] | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          id: number;
          normalized_ingredient: string;
          ontology_node_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          normalized_ingredient: string;
          ontology_node_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          normalized_ingredient?: string;
          ontology_node_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_ontology_node_id_fkey";
            columns: ["ontology_node_id"];
            isOneToOne: false;
            referencedRelation: "ontology";
            referencedColumns: ["id"];
          },
        ];
      };
      product_ingredients: {
        Row: {
          id: number;
          product_id: number;
          ingredient_id: number;
          amount_per_serving: number | null;
          amount_unit: string | null;
        };
        Insert: {
          id?: number;
          product_id: number;
          ingredient_id: number;
          amount_per_serving?: number | null;
          amount_unit?: string | null;
        };
        Update: {
          id?: number;
          product_id?: number;
          ingredient_id?: number;
          amount_per_serving?: number | null;
          amount_unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_ingredients_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      rules: {
        Row: {
          id: string;
          rule_name: string;
          description: string | null;
          trigger_type: string;
          trigger_node_id: string;
          priority: number;
          conflict_strategy: string;
          is_active: boolean;
          authored_by: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rule_name: string;
          description?: string | null;
          trigger_type?: string;
          trigger_node_id: string;
          priority?: number;
          conflict_strategy?: string;
          is_active?: boolean;
          authored_by?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rule_name?: string;
          description?: string | null;
          trigger_type?: string;
          trigger_node_id?: string;
          priority?: number;
          conflict_strategy?: string;
          is_active?: boolean;
          authored_by?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rules_trigger_node_id_fkey";
            columns: ["trigger_node_id"];
            isOneToOne: false;
            referencedRelation: "ontology";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_actions: {
        Row: {
          id: string;
          rule_id: string;
          action_type: string;
          nutrient_node_id: string | null;
          tag_node_id: string | null;
          form_node_id: string | null;
          min_dose: number | null;
          max_dose: number | null;
          preferred_dose: number | null;
          unit: string | null;
          dose_priority: number;
          enforce_level: 'requirement' | 'recommendation';
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          action_type?: string;
          nutrient_node_id?: string | null;
          tag_node_id?: string | null;
          form_node_id?: string | null;
          min_dose?: number | null;
          max_dose?: number | null;
          preferred_dose?: number | null;
          unit?: string | null;
          dose_priority?: number;
          enforce_level?: 'requirement' | 'recommendation';
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rule_id?: string;
          action_type?: string;
          nutrient_node_id?: string | null;
          tag_node_id?: string | null;
          form_node_id?: string | null;
          min_dose?: number | null;
          max_dose?: number | null;
          preferred_dose?: number | null;
          unit?: string | null;
          dose_priority?: number;
          enforce_level?: 'requirement' | 'recommendation';
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_actions_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "rules";
            referencedColumns: ["id"];
          },
        ];
      };
      member_recommendations: {
        Row: {
          id: string;
          member_id: string | null;
          session_fingerprint: string | null;
          goal_ids: string[];
          fired_rule_ids: string[];
          nutrient_requirements: Json;
          ranked_product_ids: number[];
          score_breakdown: Json;
          engine_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id?: string | null;
          session_fingerprint?: string | null;
          goal_ids: string[];
          fired_rule_ids?: string[];
          nutrient_requirements?: Json;
          ranked_product_ids?: number[];
          score_breakdown?: Json;
          engine_version?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string | null;
          session_fingerprint?: string | null;
          goal_ids?: string[];
          fired_rule_ids?: string[];
          nutrient_requirements?: Json;
          ranked_product_ids?: number[];
          score_breakdown?: Json;
          engine_version?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_recommendations_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      get_nutrient_descendants: {
        Args: { p_node_ids: string[] };
        Returns: Array<{ ancestor_id: string; descendant_id: string }>;
      };
      get_rules_for_goals: {
        Args: { p_goal_ids: string[] };
        Returns: Array<{
          rule_id: string;
          rule_name: string;
          trigger_node_id: string;
          priority: number;
          conflict_strategy: string;
          action_id: string;
          action_type: string;
          nutrient_node_id: string | null;
          nutrient_display_name: string | null;
          tag_node_id: string | null;
          form_node_id: string | null;
          min_dose: number | null;
          max_dose: number | null;
          preferred_dose: number | null;
          unit: string | null;
          dose_priority: number;
          enforce_level: 'requirement' | 'recommendation';
        }>;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
