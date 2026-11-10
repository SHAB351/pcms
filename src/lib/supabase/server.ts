import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/config";
import type { Database } from "@/types/database";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase n'est pas configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 *
 * Un nouveau client est créé à chaque appel : ne jamais le mettre en cache entre
 * deux requêtes, la session est portée par les cookies de la requête.
 */
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) throw new SupabaseNotConfiguredError();

  // Next.js 16 : cookies() est asynchrone.
  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Depuis un Server Component, l'écriture de cookies est interdite.
          // Le rafraîchissement de session est assuré par src/proxy.ts.
        }
      },
    },
  });
}
