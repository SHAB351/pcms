import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { getProviderInfo } from "@/lib/ai/registry";

/**
 * Sonde de santé pour la supervision.
 *
 * Elle n'expose aucun secret : uniquement des booléens et la description du
 * fournisseur d'IA. `getProviderInfo()` ne transmet ni clé d'API ni URL
 * complète — la sonde se contente de la recopier. Volontairement publique
 * (pas de session) pour être appelable par un moniteur externe.
 */
export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();
  const provider = getProviderInfo();

  return NextResponse.json(
    {
      status: supabaseConfigured ? "ok" : "configuration_incomplete",
      supabaseConfigured,
      ai: {
        id: provider.id,
        label: provider.label,
        isLocal: provider.isLocal,
        isConfigured: provider.isConfigured,
        fallback: provider.fallback,
      },
      // Conservé pour les moniteurs existants : identifiant du fournisseur
      // réellement actif, jamais la valeur brute de la variable d'environnement.
      aiProvider: provider.id,
      timestamp: new Date().toISOString(),
    },
    { status: supabaseConfigured ? 200 : 503 },
  );
}
