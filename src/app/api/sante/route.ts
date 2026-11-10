import { NextResponse } from "next/server";
import { aiConfig, isSupabaseConfigured } from "@/lib/config";

/**
 * Sonde de santé pour la supervision.
 *
 * Elle n'expose aucun secret : uniquement des booléens et le nom du fournisseur
 * d'IA. Volontairement publique (pas de session) pour être appelable par un
 * moniteur externe.
 */
export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();

  return NextResponse.json(
    {
      status: supabaseConfigured ? "ok" : "configuration_incomplete",
      supabaseConfigured,
      aiProvider: aiConfig.provider,
      timestamp: new Date().toISOString(),
    },
    { status: supabaseConfigured ? 200 : 503 },
  );
}
