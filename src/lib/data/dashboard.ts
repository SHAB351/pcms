import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActivityLogEntry, CalendarEntry } from "@/types/database";

export type DashboardSnapshot = {
  documentCount: number;
  pendingDraftCount: number;
  openTaskCount: number;
  upcomingCount: number;
  upcoming: CalendarEntry[];
  recentActivity: ActivityLogEntry[];
  /**
   * `true` dès qu'une requête a échoué. Les compteurs concernés sont alors à 0,
   * ce qui ne doit pas être confondu avec « aucune donnée » : l'interface
   * affiche un avertissement explicite dans ce cas.
   */
  degraded: boolean;
};

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  documentCount: 0,
  pendingDraftCount: 0,
  openTaskCount: 0,
  upcomingCount: 0,
  upcoming: [],
  recentActivity: [],
  degraded: false,
};

/**
 * Agrège les indicateurs du tableau de bord en une seule passe.
 *
 * Les lectures passent par le client « serveur » : ce sont donc les politiques
 * RLS de l'utilisateur connecté qui s'appliquent, pas un accès privilégié.
 */
export async function loadDashboard(): Promise<DashboardSnapshot> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const [documents, drafts, tasks, upcomingResult, activityResult] =
    await Promise.all([
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("ai_drafts")
        .select("id", { count: "exact", head: true })
        .in("status", ["brouillon", "en_revue"]),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .neq("status", "termine"),
      supabase
        .from("calendar_entries")
        .select("*", { count: "exact" })
        .gte("planned_for", now)
        .neq("status", "annule")
        .order("planned_for", { ascending: true })
        .limit(5),
      supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const degraded = Boolean(
    documents.error ||
      drafts.error ||
      tasks.error ||
      upcomingResult.error ||
      activityResult.error,
  );

  return {
    ...EMPTY_SNAPSHOT,
    documentCount: documents.count ?? 0,
    pendingDraftCount: drafts.count ?? 0,
    openTaskCount: tasks.count ?? 0,
    upcomingCount: upcomingResult.count ?? 0,
    upcoming: upcomingResult.data ?? [],
    recentActivity: activityResult.data ?? [],
    degraded,
  };
}
