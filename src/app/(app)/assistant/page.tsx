import type { Metadata } from "next";
import Link from "next/link";
import { PenLine, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { AssistantForm } from "@/components/assistant/assistant-form";
import { DraftStatusBadge } from "@/components/assistant/draft-status-badge";
import { canWrite, getSession } from "@/lib/auth/session";
import { getProviderInfo } from "@/lib/ai/registry";
import { AI_DRAFT_STATUSES, DRAFT_STATUS_LABELS } from "@/lib/assistant/constants";
import { getOperation, isAiOperationId } from "@/lib/ai/operations";
import {
  buildDraftsQuery,
  listDrafts,
  listSourceDocuments,
  parseDraftListParams,
} from "@/lib/data/assistant";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Assistant IA" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const params = parseDraftListParams(rawSearchParams);

  const [session, result, documents] = await Promise.all([
    getSession(),
    listDrafts(params),
    listSourceDocuments(),
  ]);

  const provider = getProviderInfo();
  const writer = session ? canWrite(session.profile) : false;
  const justDeleted = rawSearchParams.supprime === "1";

  return (
    <>
      <PageHeader
        title="Assistant IA"
        description="Six opérations de rédaction, toujours rendues sous forme de brouillon soumis à relecture humaine."
      />

      {justDeleted ? (
        <Alert tone="success" title="Brouillon supprimé" className="mb-6">
          <p>Le brouillon et son historique ont été supprimés.</p>
        </Alert>
      ) : null}

      <Alert tone="info" title="Règle de confidentialité" className="mb-6">
        <p>
          Fournisseur actuel : <strong>{provider.label}</strong>.{" "}
          {provider.isLocal
            ? "Il travaille sur ce poste : aucun texte ne sort de la machine."
            : "Il est externe : chaque demande exige votre autorisation explicite, et l'envoi reste désactivé tant que l'administrateur ne l'a pas autorisé sur le serveur."}
          {provider.fallback ? " (Le fournisseur configuré est inconnu : repli sur le générateur hors ligne.)" : ""}
        </p>
        <p className="mt-1 text-xs">
          Aucun brouillon n&apos;est publiable en l&apos;état : seul un administrateur peut
          l&apos;approuver, et toute retouche du texte annule cette approbation.
        </p>
      </Alert>

      {result.degraded ? (
        <Alert tone="danger" title="La liste des brouillons est incomplète" className="mb-6">
          <p>
            La lecture a échoué. Vérifiez que la migration{" "}
            <code className="mx-1 rounded bg-white/60 px-1">0003_assistant_ia.sql</code> a
            été exécutée dans le SQL Editor.
          </p>
        </Alert>
      ) : null}

      {writer ? (
        <Card className="mb-6" id="generer">
          <CardHeader>
            <CardTitle>Générer un brouillon</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Le texte produit est enregistré avec son historique : vous pourrez le
              corriger, le soumettre, puis le faire approuver.
            </p>
          </CardHeader>
          <CardContent>
            <AssistantForm provider={provider} documents={documents} />
          </CardContent>
        </Card>
      ) : (
        <Alert tone="info" title="Lecture seule" className="mb-6">
          <p>Votre rôle permet de consulter les brouillons qui vous sont accessibles, pas d&apos;en produire.</p>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Rechercher</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="q" className="block text-sm font-medium text-slate-700">
                Titre ou consigne
              </label>
              <input
                id="q"
                name="q"
                defaultValue={params.q}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>
            <div>
              <label htmlFor="statut" className="block text-sm font-medium text-slate-700">
                Statut
              </label>
              <select
                id="statut"
                name="statut"
                defaultValue={params.status}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="tous">Tous</option>
                {AI_DRAFT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {DRAFT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Filtrer
            </button>
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-slate-500">
        {result.total === 0
          ? "Aucun brouillon"
          : `${result.total} brouillon${result.total > 1 ? "s" : ""}`}
        {params.q ? ` pour « ${params.q} »` : ""}
      </p>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<PenLine className="h-5 w-5" aria-hidden="true" />}
          title={params.q || params.status !== "tous" ? "Aucun résultat" : "Aucun brouillon pour l'instant"}
          description={
            writer
              ? "Générez un premier texte avec le formulaire ci-dessus."
              : "Les brouillons du service apparaîtront ici."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">Brouillon</th>
                <th scope="col" className="px-5 py-3">Opération</th>
                <th scope="col" className="px-5 py-3">Statut</th>
                <th scope="col" className="px-5 py-3">Origine</th>
                <th scope="col" className="px-5 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.items.map((draft) => (
                <tr key={draft.id} className="hover:bg-slate-50">
                  <td className="max-w-xs px-5 py-3">
                    <Link
                      href={`/assistant/${draft.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {draft.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{draft.provider}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {isAiOperationId(draft.operation)
                      ? getOperation(draft.operation).label
                      : draft.operation}
                  </td>
                  <td className="px-5 py-3">
                    <DraftStatusBadge status={draft.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {draft.external_sent ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Envoyé à un service externe
                      </span>
                    ) : (
                      "Sur ce poste"
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(draft.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-slate-500">
            Page {result.page} sur {result.pageCount}
          </span>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link
                href={`/assistant${buildDraftsQuery(params, { page: result.page - 1 })}`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Précédent
              </Link>
            ) : null}
            {result.page < result.pageCount ? (
              <Link
                href={`/assistant${buildDraftsQuery(params, { page: result.page + 1 })}`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Suivant
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
