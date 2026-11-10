import { Alert } from "@/components/ui/alert";
import { DOCUMENTS_BUCKET, getMissingSupabaseEnv } from "@/lib/config";

/**
 * Écran affiché lorsque les variables d'environnement Supabase sont absentes.
 *
 * Objectif : ne jamais présenter une interface qui *semble* fonctionner. On
 * explique exactement quoi faire, sans exposer ni inventer de valeur.
 */
export function ConfigurationRequired() {
  const missing = getMissingSupabaseEnv();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
        Configuration requise
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        L&apos;application n&apos;est pas encore reliée à Supabase
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        L&apos;interface est fonctionnelle, mais aucune donnée ne peut être lue ni
        écrite tant que la base de données et l&apos;authentification ne sont pas
        configurées. Voici ce qui manque.
      </p>

      <Alert tone="warning" title="Variables d'environnement absentes" className="mt-6">
        <ul className="list-inside list-disc font-mono text-xs">
          {missing.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </Alert>

      <ol className="mt-6 space-y-3 text-sm text-slate-700">
        <li>
          <span className="font-semibold">1.</span> Créer un projet sur{" "}
          <a
            href="https://supabase.com/dashboard"
            className="font-medium text-blue-700 underline"
            target="_blank"
            rel="noreferrer"
          >
            supabase.com/dashboard
          </a>
          .
        </li>
        <li>
          <span className="font-semibold">2.</span> Copier{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.env.example</code>{" "}
          en <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.env.local</code>{" "}
          et renseigner l&apos;URL du projet ainsi que la clé publique « anon ».
        </li>
        <li>
          <span className="font-semibold">3.</span> Exécuter les migrations SQL de{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            supabase/migrations/
          </code>{" "}
          dans le SQL Editor (schema puis bucket{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            {DOCUMENTS_BUCKET}
          </code>
          ).
        </li>
        <li>
          <span className="font-semibold">4.</span> Créer le premier compte
          administrateur, puis redémarrer le serveur de développement.
        </li>
      </ol>

      <p className="mt-6 text-xs text-slate-500">
        Le détail de chaque étape figure dans le fichier README.md du projet.
      </p>
    </div>
  );
}
