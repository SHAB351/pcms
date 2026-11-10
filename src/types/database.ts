/**
 * Types de la base de données Supabase.
 *
 * Écrits à la main pour refléter `supabase/migrations/0001_initial_schema.sql`.
 * Si `supabase` CLI est disponible, régénérez-les plutôt :
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

import type { AiOperationId } from "@/lib/ai/operations";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "editor" | "reader";
export type DocumentStatus = "brouillon" | "en_revue" | "valide" | "archive";
export type AiDraftStatus = "brouillon" | "en_revue" | "approuve" | "rejete";
export type CalendarStatus =
  | "idee"
  | "en_preparation"
  | "en_revue"
  | "pret"
  | "publie"
  | "annule";
export type TaskStatus = "a_faire" | "en_cours" | "bloque" | "termine";
export type TaskPriority = "basse" | "normale" | "haute";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: DocumentStatus;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

type AiDraftRow = {
  id: string;
  title: string;
  brief: string;
  content: string;
  operation: AiOperationId;
  source_text: string | null;
  document_id: string | null;
  target_language: string | null;
  external_sent: boolean;
  warnings: string[];
  provider: string;
  model: string | null;
  status: AiDraftStatus;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AiDraftRevisionRow = {
  id: number;
  draft_id: string;
  content: string;
  status: AiDraftStatus;
  external_sent: boolean;
  author_id: string | null;
  created_at: string;
};

type CalendarEntryRow = {
  id: string;
  title: string;
  channel: string;
  summary: string | null;
  status: CalendarStatus;
  planned_for: string;
  document_id: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  assignee_id: string | null;
  calendar_entry_id: string | null;
  created_at: string;
  updated_at: string;
};

type ActivityLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  created_at: string;
};

export type Profile = ProfileRow;
export type DocumentRecord = DocumentRow;
export type AiDraft = AiDraftRow;
export type AiDraftRevision = AiDraftRevisionRow;
export type CalendarEntry = CalendarEntryRow;
export type Task = TaskRow;
export type ActivityLogEntry = ActivityLogRow;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          category?: string | null;
          status?: DocumentStatus;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          category?: string | null;
          status?: DocumentStatus;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          uploaded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_drafts: {
        Row: AiDraftRow;
        Insert: {
          id?: string;
          title: string;
          brief: string;
          content: string;
          operation?: AiOperationId;
          source_text?: string | null;
          document_id?: string | null;
          target_language?: string | null;
          external_sent?: boolean;
          warnings?: string[];
          provider: string;
          model?: string | null;
          status?: AiDraftStatus;
          created_by: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          brief?: string;
          content?: string;
          operation?: AiOperationId;
          source_text?: string | null;
          document_id?: string | null;
          target_language?: string | null;
          external_sent?: boolean;
          warnings?: string[];
          provider?: string;
          model?: string | null;
          status?: AiDraftStatus;
          created_by?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_draft_revisions: {
        Row: AiDraftRevisionRow;
        Insert: {
          id?: never;
          draft_id: string;
          content: string;
          status: AiDraftStatus;
          external_sent?: boolean;
          author_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          draft_id?: string;
          content?: string;
          status?: AiDraftStatus;
          external_sent?: boolean;
          author_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      calendar_entries: {
        Row: CalendarEntryRow;
        Insert: {
          id?: string;
          title: string;
          channel: string;
          summary?: string | null;
          status?: CalendarStatus;
          planned_for: string;
          document_id?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          channel?: string;
          summary?: string | null;
          status?: CalendarStatus;
          planned_for?: string;
          document_id?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: {
          id?: string;
          title: string;
          details?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_at?: string | null;
          assignee_id?: string | null;
          calendar_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          details?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_at?: string | null;
          assignee_id?: string | null;
          calendar_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: ActivityLogRow;
        Insert: {
          id?: never;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          summary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          summary?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      can_write: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      document_status: DocumentStatus;
      ai_draft_status: AiDraftStatus;
      calendar_status: CalendarStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
