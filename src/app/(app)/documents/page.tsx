import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentFilters } from "@/components/documents/document-filters";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { canWrite, getSession } from "@/lib/auth/session";
import {
  buildDocumentsQuery,
  listDocuments,
  parseDocumentListParams,
} from "@/lib/data/documents";
import { formatDate, formatFileSize } from "@/lib/format";

export const metadata: Metadata = { title: "Documents" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const params = parseDocumentListParams(rawSearchParams);
  const [session, result] = await Promise.all([getSession(), listDocuments(params)]);

  // Sans session, le layout du groupe a déjà redirigé. Ici on retombe sur le
  // rôle le plus restrictif : aucune écriture n'est proposée par défaut.
  const writer = session ? canWrite(session.profile) : false;
  const justDeleted = rawSearchParams.supprime === "1";
  const orphanFile = rawSearchParams.erreur === "fichier-orphelin";

  return (
    <>
      <PageHeader
        title="Documents"
        description="Notes, communiqués et pièces de dossier du service. Stockage privé : aucun fichier n'est accessible sans session."
        actions={
          <Link
            href="#deposer"
            className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Déposer un document
          </Link>
        }
      />

      {justDeleted ? (
        <Alert tone="success" title="Document supprimé" className="mb-6">
          <p>La fiche a été supprimée.</p>
        </Alert>
      ) : null}

      {orphanFile ? (
        <Alert tone="warning" title="Fichier resté dans le stockage" className="mb-6">
          <p>
            La fiche a bien été supprimée, mais le fichier n&apos;a pas pu être
            retiré du bucket. Signalez-le à un administrateur : le nettoyage se
            fait depuis le tableau de bord Supabase (Storage → documents).
          </p>
        </Alert>
      ) : null}

      {result.degraded ? (
        <Alert tone="danger" title="La liste est incomplète" className="mb-6">
          <p>
            La lecture des documents a échoué. Vérifiez que les migrations SQL ont
            été exécutées et que votre compte dispose d&apos;une ligne dans
            <code className="mx-1 rounded bg-white/60 px-1">profiles</code>.
          </p>
        </Alert>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Rechercher et filtrer</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentFilters params={params} categories={result.categories} />
        </CardContent>
      </Card>

      {writer ? (
        <Card className="mb-6" id="deposer">
          <CardHeader>
            <CardTitle>Déposer un document</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Le fichier rejoint un espace privé. Le type et la taille sont
              contrôlés côté serveur, puis à nouveau par le stockage.
            </p>
          </CardHeader>
          <CardContent>
            <DocumentUploadForm categories={result.categories} />
          </CardContent>
        </Card>
      ) : null}

      <p className="mb-3 text-sm text-slate-500">
        {result.total === 0
          ? "Aucun document"
          : `${result.total} document${result.total > 1 ? "s" : ""}`}
        {params.q ? ` pour « ${params.q} »` : ""}
      </p>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          title={params.q || params.category || params.status !== "tous" ? "Aucun résultat" : "Aucun document pour l'instant"}
          description={
            writer
              ? "Déposez un premier fichier avec le formulaire ci-dessus."
              : "Les documents déposés par le service apparaîtront ici."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">Document</th>
                <th scope="col" className="px-5 py-3">Catégorie</th>
                <th scope="col" className="px-5 py-3">Statut</th>
                <th scope="col" className="px-5 py-3">Taille</th>
                <th scope="col" className="px-5 py-3">Déposé le</th>
                <th scope="col" className="px-5 py-3 text-right">Fichier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.items.map((document) => (
                <tr key={document.id} className="hover:bg-slate-50">
                  <td className="max-w-xs px-5 py-3">
                    <Link
                      href={`/documents/${document.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {document.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{document.file_name}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{document.category ?? "—"}</td>
                  <td className="px-5 py-3">
                    <DocumentStatusBadge status={document.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {formatFileSize(document.size_bytes)}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(document.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <a
                      href={`/api/documents/${document.id}/telecharger`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Télécharger
                    </a>
                  </td>
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
                href={`/documents${buildDocumentsQuery(params, { page: result.page - 1 })}`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Précédent
              </Link>
            ) : null}
            {result.page < result.pageCount ? (
              <Link
                href={`/documents${buildDocumentsQuery(params, { page: result.page + 1 })}`}
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
