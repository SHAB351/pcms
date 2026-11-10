import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  FileText,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getSession } from "@/lib/auth/session";
import { loadDashboard } from "@/lib/data/dashboard";
import { formatDateTime, formatRelative } from "@/lib/format";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

export default async function DashboardPage() {
  const [session, snapshot] = await Promise.all([getSession(), loadDashboard()]);
  const firstName = session?.profile.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Bonjour, ${firstName}` : "Tableau de bord"}
        description="Vue d'ensemble de l'activité du service de communication."
      />

      {snapshot.degraded ? (
        <Alert tone="danger" title="Certaines données n'ont pas pu être lues" className="mb-6">
          <p>
            Un ou plusieurs indicateurs ci-dessous sont incomplets. Vérifiez que
            les migrations SQL ont bien été exécutées et que les politiques RLS
            autorisent votre compte.
          </p>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Documents"
          value={snapshot.documentCount}
          hint="Fichiers déposés dans le service"
          icon={<FileText className="h-4 w-4" aria-hidden="true" />}
          href="/documents"
        />
        <StatCard
          label="Brouillons IA à relire"
          value={snapshot.pendingDraftCount}
          hint="Aucun ne doit être publié sans relecture"
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          href="/assistant"
        />
        <StatCard
          label="Tâches ouvertes"
          value={snapshot.openTaskCount}
          hint="Hors tâches terminées"
          icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
          href="/taches"
        />
        <StatCard
          label="Échéances à venir"
          value={snapshot.upcomingCount}
          hint="Publications planifiées"
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          href="/calendrier"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prochaines échéances</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.upcoming.length === 0 ? (
              <EmptyState
                title="Aucune publication planifiée"
                description="Les entrées du calendrier éditorial apparaîtront ici."
                className="border-0 py-8 shadow-none"
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {snapshot.upcoming.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {entry.title}
                      </p>
                      <p className="text-xs text-slate-500">{entry.channel}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {formatDateTime(entry.planned_for)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.recentActivity.length === 0 ? (
              <EmptyState
                title="Aucune activité enregistrée"
                description="Le journal se remplit automatiquement à chaque création ou modification de contenu."
                className="border-0 py-8 shadow-none"
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {snapshot.recentActivity.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-900">
                        {entry.summary ?? entry.entity_type}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        {entry.action}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {formatRelative(entry.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Les modules Documents, Assistant IA, Calendrier, Tâches et Rapports sont
        en cours de construction.{" "}
        <Link href="/parametres" className="font-medium text-blue-700 underline">
          Voir l&apos;état de la configuration
        </Link>
        .
      </p>
    </>
  );
}
