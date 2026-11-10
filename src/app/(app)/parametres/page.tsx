import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import { getProvider } from "@/lib/ai/registry";
import { DOCUMENTS_BUCKET, aiConfig, isSupabaseConfigured } from "@/lib/config";
import { ROLE_LABELS, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Paramètres" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export default async function ParametresPage() {
  const session = await requireSession();
  const provider = getProvider();

  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Compte connecté et état de la configuration technique."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compte</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-slate-100">
              <Row label="Adresse e-mail" value={session.profile.email} />
              <Row
                label="Nom affiché"
                value={session.profile.full_name?.trim() || "Non renseigné"}
              />
              <Row
                label="Rôle"
                value={
                  <Badge tone={session.profile.role === "admin" ? "info" : "neutral"}>
                    {ROLE_LABELS[session.profile.role]}
                  </Badge>
                }
              />
              <Row
                label="Compte créé le"
                value={formatDateTime(session.profile.created_at)}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-slate-100">
              <Row
                label="Supabase"
                value={
                  isSupabaseConfigured() ? (
                    <Badge tone="success">Configuré</Badge>
                  ) : (
                    <Badge tone="danger">Non configuré</Badge>
                  )
                }
              />
              <Row
                label="Bucket de stockage"
                value={
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {DOCUMENTS_BUCKET}
                  </code>
                }
              />
              <Row
                label="Fournisseur IA"
                value={
                  <span className="flex items-center gap-2">
                    <span>{provider.info.label}</span>
                    {provider.info.isConfigured ? (
                      <Badge tone="warning">Factice</Badge>
                    ) : (
                      <Badge tone="danger">Non configuré</Badge>
                    )}
                  </span>
                }
              />
              <Row
                label="Variable AI_PROVIDER"
                value={
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {aiConfig.provider}
                  </code>
                }
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      {provider.info.configurationHint ? (
        <Alert tone="warning" title="Assistant IA" className="mt-6">
          <p>{provider.info.configurationHint}</p>
        </Alert>
      ) : null}

      <Alert tone="info" title="Gestion des comptes" className="mt-6">
        <p>
          Les comptes et les rôles se gèrent depuis le tableau de bord Supabase.
          Un nouvel utilisateur reçoit le rôle « Lecteur » ; seul un
          administrateur peut élever un compte en « Rédacteur » ou
          « Administrateur ». La procédure est décrite dans le README.
        </p>
      </Alert>
    </>
  );
}
