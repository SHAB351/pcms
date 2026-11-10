import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentDeleteForm } from "@/components/documents/document-delete-form";
import { DocumentMetadataForm } from "@/components/documents/document-metadata-form";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { canWrite, getSession, isAdmin } from "@/lib/auth/session";
import { getDocument } from "@/lib/data/documents";
import { formatDateTime, formatFileSize } from "@/lib/format";

export const metadata: Metadata = { title: "Document" };

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word (.doc)",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (.docx)",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel (.xlsx)",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PowerPoint (.pptx)",
  "text/plain": "Texte",
  "text/csv": "CSV",
  "image/png": "Image PNG",
  "image/jpeg": "Image JPEG",
};

const ERRORS: Record<string, string> = {
  droits: "Votre rôle ne permet pas cette opération.",
  statut: "Le changement de statut a échoué.",
  suppression: "La suppression a échoué.",
};

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [session, result] = await Promise.all([getSession(), getDocument(id)]);

  if (result.degraded) {
    return (
      <Alert tone="danger" title="Document illisible">
        <p>
          La lecture a échoué. Vérifiez la configuration Supabase et les
          politiques RLS avant de réessayer.
        </p>
      </Alert>
    );
  }
  if (!result.document) notFound();

  const document = result.document;
  const writer = session ? canWrite(session.profile) : false;
  const admin = session ? isAdmin(session.profile) : false;
  const errorKey = typeof query.erreur === "string" ? query.erreur : undefined;
  const isNew = query.nouveau === "1";

  return (
    <>
      <Link
        href="/documents"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Tous les documents
      </Link>

      <PageHeader
        title={document.title}
        description={document.description ?? undefined}
        actions={
          <>
            <a
              href={`/api/documents/${document.id}/telecharger`}
              className={buttonClasses("secondary")}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Télécharger
            </a>
            {admin ? (
              <DocumentDeleteForm id={document.id} name={document.title} />
            ) : null}
          </>
        }
      />

      {isNew ? (
        <Alert tone="success" title="Document déposé" className="mb-6">
          <p>
            Le fichier est dans l&apos;espace privé. Complétez la catégorie et le
            statut pour le rendre repérable dans la liste.
          </p>
        </Alert>
      ) : null}

      {errorKey && ERRORS[errorKey] ? (
        <Alert tone="danger" title="Opération refusée" className="mb-6">
          <p>{ERRORS[errorKey]}</p>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Statut</dt>
                <dd>
                  <DocumentStatusBadge status={document.status} />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Fichier</dt>
                <dd className="text-right font-medium break-all text-slate-900">
                  {document.file_name}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Type</dt>
                <dd className="text-slate-900">
                  {MIME_LABELS[document.mime_type] ?? document.mime_type}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Taille</dt>
                <dd className="text-slate-900">{formatFileSize(document.size_bytes)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Catégorie</dt>
                <dd className="text-slate-900">{document.category ?? "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Déposé le</dt>
                <dd className="text-right text-slate-900">
                  {formatDateTime(document.created_at)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Modifié le</dt>
                <dd className="text-right text-slate-900">
                  {formatDateTime(document.updated_at)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {writer ? "Modifier la fiche" : "Détail"}
            </CardTitle>
            {!writer ? (
              <p className="mt-1 text-sm text-slate-500">
                Votre rôle donne un accès en lecture : la modification est
                réservée aux administrateurs et aux rédacteurs.
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            {writer ? (
              <DocumentMetadataForm document={document} />
            ) : (
              <p className="text-sm text-slate-600">
                {document.description ?? "Aucune description enregistrée."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
