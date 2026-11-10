"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/config";
import type { Database } from "@/types/database";

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Client Supabase côté navigateur, créé paresseusement.
 *
 * La création est différée à l'appel (et non au chargement du module) pour que
 * l'application puisse démarrer sans variables d'environnement et afficher un
 * diagnostic au lieu de planter au premier rendu.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase n'est pas configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    );
  }

  cachedClient = createBrowserClient<Database>(config.url, config.anonKey, {
    isSingleton: true,
  });
  return cachedClient;
}
