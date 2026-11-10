import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DraftDecisionForm } from "@/components/assistant/draft-decision-form";
import { DraftEditor } from "@/components/assistant/draft-editor";
import { DraftStatusBadge } from "@/components/assistant/draft-status-badge";
import { canWrite, getSession, isAdmin } from "@/lib/auth/session";
import { getDraft } from "@/lib/data/assistant";
import { getOperation, isAiOperationId } from "@/lib/ai/operations";
import { DRAFT_STATUS_LABELS } from "@/lib/assistant/constants";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Brouillon" };

type SearchParams = Record<string, string | string[] | undefined>;

const ERRORS: Record<string, string> = {
  droits: "Votre rôle ne permet pas cette action.",
  statut: "Le brouillon n'a pas pu changer de statut.",
  decision: "La décision n'a pas pu être enregistrée.",
  suppression: "La suppression a échoué.",
};

export default async function DraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const [session, detail] = await Promise.all([getSession(), getDraft(id)]);

  if (!detail.draft && !detail.degraded) notFound();
  if (!detail.draft) {
    return (
      <Alert tone="danger" title="Brouillon illisible">
        <p>La lecture a échoué : vérifiez que la migration 0003 a été appliquée.</p>
      </Alert>
    );
  }

  const draft = detail.draft;
  const admin = session ? isAdmin(session.profile) : false;
  const writer = session ? canWrite(session.profile) : false;
  const error = typeof rawSearchParams.erreur === "string" ? rawSearchParams.erreur : null;
  const operation = isAiOperationId(draft.operation) ? getOperation(draft.operation) : null;

  return (
    <>
      <Link
        href="/assistant"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux brouillons
      </Link>

      <PageHeader
        title={draft.title}
        description={`${operation?.label ?? draft.operation} · ${draft.provider}${draft.model ? ` (${draft.model})` : ""}`}
        actions={<DraftStatusBadge status={draft.status} />}
      />

      {rawSearchParams.nouveau === "1" ? (
        <Alert tone="success" title="Brouillon créé" className="mb-6">
          <p>
            Ce texte est une proposition. Relisez-le intégralement : rien ne doit être
            publié sans relecture, et seul un administrateur peut l&apos;approuver.
          </p>
        </Alert>
      ) : null}

      {rawSearchParams.soumis === "1" ? (
        <Alert tone="info" title="Soumis à relecture" className="mb-6">
          <p>Un administrateur doit maintenant approuver ou rejeter ce brouillon.</p>
        </Alert>
      ) : null}

      {rawSearchParams.approuve === "1" ? (
        <Alert tone="success" title="Brouillon approuvé" className="mb-6">
          <p>Toute modification du texte annulera cette approbation.</p>
        </Alert>
      ) : null}

      {rawSearchParams.rejete === "1" ? (
        <Alert tone="warning" title="Brouillon rejeté" className="mb-6">
          <p>Le texte peut être corrigé puis soumis de nouveau.</p>
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" title="Action impossible" className="mb-6">
          <p>{ERRORS[error] ?? "Erreur inconnue."}</p>
        </Alert>
      ) : null}

      {draft.warnings.length > 0 ? (
        <Alert tone="warning" title="Avertissements du fournisseur" className="mb-6">
          <ul className="list-disc space-y-1 pl-4">
            {draft.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {draft.external_sent ? (
        <Alert tone="warning" title="Ce texte a transité par un service externe" className="mb-6">
          <p>
            Il a été envoyé avec votre autorisation. Ne le republiez pas sans vérifier
            qu&apos;aucune donnée confidentielle n&apos;y figure.
          </p>
        </Alert>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Décision</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Un brouillon ne devient utilisable qu&apos;après approbation par un administrateur.
          </p>
        </CardHeader>
        <CardContent>
          <DraftDecisionForm
            id={draft.id}
            status={draft.status}
            title={draft.title}
            isAdmin={admin}
            canWrite={writer}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Texte</CardTitle>
        </CardHeader>
        <CardContent>
          {writer ? (
            <DraftEditor
              id={draft.id}
              title={draft.title}
              content={draft.content}
              alreadyReviewed={draft.status === "approuve"}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-slate-800">
              {draft.content}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Traçabilité</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">Consigne</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">{draft.brief}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Source</dt>
              <dd className="mt-0.5 text-slate-800">
                {draft.document_id
                  ? `Document${detail.documentTitle ? ` « ${detail.documentTitle} »` : " du module Documents"}`
                  : draft.source_text
                    ? "Texte collé dans le formulaire"
                    : "Aucune (génération libre)"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Créé le</dt>
              <dd className="mt-0.5 text-slate-800">{formatDate(draft.created_at)}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Relecture</dt>
              <dd className="mt-0.5 text-slate-800">
                {draft.reviewed_at
                  ? `${DRAFT_STATUS_LABELS[draft.status]} le ${formatDate(draft.reviewed_at)}`
                  : "Pas encore relu"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Chaque version du texte est conservée en base, en ajout seul.
          </p>
        </CardHeader>
        <CardContent>
          {detail.revisions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune version enregistrée.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {detail.revisions.map((revision) => (
                <li
                  key={revision.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="text-slate-700">
                    {DRAFT_STATUS_LABELS[revision.status]} ·{" "}
                    {revision.content.length} caractères
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDate(revision.created_at)}
                    {revision.external_sent ? " · envoi externe" : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}
