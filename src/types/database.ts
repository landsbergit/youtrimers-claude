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
