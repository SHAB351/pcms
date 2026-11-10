/**
 * Central place for runtime configuration.
 *
 * Nothing here throws at import time: the application must be able to build and
 * start without any credentials, and tell the operator precisely what is
 * missing instead of crashing with an opaque error.
 */

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

const SUPABASE_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Environment variables required by Supabase that are currently empty. */
export function getMissingSupabaseEnv(): string[] {
  return SUPABASE_ENV_VARS.filter((name) => readEnv(name) === undefined);
}

export function isSupabaseConfigured(): boolean {
  return getMissingSupabaseEnv().length === 0;
}

/**
 * Normalise l'URL du projet Supabase.
 *
 * Le tableau de bord expose plusieurs URLs : celle du projet
 * (`https://ref.supabase.co`) et celle de l'API REST
 * (`https://ref.supabase.co/rest/v1/`). Coller la seconde est une erreur
 * fréquente et sournoise : `supabase-js` ajoute lui-même `/rest/v1`, la requête
 * partirait donc vers `/rest/v1/rest/v1/...` et échouerait partout.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "")
    .replace(/\/+$/, "");
}

/**
 * Returns the Supabase connection settings, or `null` when they are incomplete.
 *
 * Callers must handle `null` explicitly rather than falling back to a fake
 * client: a silently broken client is worse than an explicit "not configured".
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return { url: normalizeSupabaseUrl(url), anonKey };
}

/** Name of the private Storage bucket that holds the department's documents. */
export const DOCUMENTS_BUCKET = "documents";

export const APP_NAME = "PCMS";
export const APP_LONG_NAME = "Political Communication Management System";

/**
 * AI layer configuration.
 *
 * `AI_PROVIDER` selects the implementation registered in `src/lib/ai/registry.ts`.
 * The default `mock` provider is deterministic and offline; it never invents
 * facts and is clearly labelled as a placeholder in the interface.
 */
export const aiConfig = {
  provider: readEnv("AI_PROVIDER") ?? "mock",
  model: readEnv("AI_MODEL"),
  /** Server-only. Never expose under a NEXT_PUBLIC_ name. */
  apiKey: readEnv("AI_API_KEY"),
  /** Racine de l'API compatible OpenAI (OpenAI, Mistral, Groq, Ollama…). */
  baseUrl: readEnv("AI_BASE_URL"),
  /**
   * Autorisation globale d'envoyer du contenu à un service externe.
   * Refusée par défaut : il faut l'écrire explicitement.
   */
  allowExternal: readEnv("AI_ALLOW_EXTERNAL") === "true",
  /** Délai maximal d'un appel, en millisecondes. */
  timeoutMs: Number(readEnv("AI_TIMEOUT_MS") ?? 60_000),
} as const;
