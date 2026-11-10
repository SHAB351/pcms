import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Page provisoire d'un module déjà modélisé en base mais pas encore exposé.
 *
 * Elle annonce explicitement ce qui n'est pas encore disponible : mieux vaut
 * une page honnête qu'un écran qui imite une fonctionnalité absente.
 */
export function ModulePreview({
  title,
  description,
  table,
  capabilities,
}: {
  title: string;
  description: string;
  table: string;
  capabilities: string[];
}) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={<Badge tone="warning">En préparation</Badge>}
      />

      <Alert tone="info" title="Ce module n'est pas encore opérationnel">
        <p>
          Le schéma de données et les règles d&apos;accès existent déjà
          (table <code className="rounded bg-white/60 px-1 py-0.5 text-xs">{table}</code>
          , protégée par <abbr title="Row Level Security">RLS</abbr>). L&apos;interface
          de ce module sera livrée à l&apos;étape suivante.
        </p>
      </Alert>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Fonctionnalités prévues</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-slate-700">
            {capabilities.map((capability) => (
              <li key={capability} className="flex gap-2">
                <span aria-hidden="true" className="text-slate-400">
                  —
                </span>
                <span>{capability}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
