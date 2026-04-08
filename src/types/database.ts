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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
