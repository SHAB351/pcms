import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * Sonde de santé pour la supervision.
 *
 * Publique et **non authentifiée** par conception : un moniteur externe doit
 * pouvoir l'appeler sans session. C'est précisément ce qui impose de réduire sa
 * réponse au strict nécessaire — elle ne porte que `status` et
 * `supabaseConfigured`.
 *
 * Aucune métadonnée du fournisseur d'IA n'est exposée ici. Jusqu'au
 * 2026-11-10, la réponse contenait un objet `ai` (`id`, `label`, `isLocal`,
 * `isConfigured`, `fallback`) et `aiProvider` : `label` livrait le **nom exact
 * du modèle** configuré et `isConfigured` la **présence d'une clé d'API** à un
 * appelant anonyme. Ces informations restent disponibles **à l'intérieur de
 * l'application**, via `getProviderInfo()` (`src/lib/ai/registry.ts`), que cette
 * route n'importe volontairement plus.
 *
 * Décision : `DECISIONS.md` §25 (option 2, validée par le propriétaire).
 */
export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();

  return NextResponse.json(
    {
      status: supabaseConfigured ? "ok" : "configuration_incomplete",
      supabaseConfigured,
    },
    { status: supabaseConfigured ? 200 : 503 },
  );
}
