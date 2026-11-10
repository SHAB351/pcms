import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/config";
import type { Database } from "@/types/database";

/**
 * Rafraîchit la session Supabase et renvoie la réponse à transmettre.
 *
 * Appelé depuis src/proxy.ts. Le rafraîchissement doit avoir lieu avant tout
 * rendu, sinon un jeton expiré n'est pas réécrit dans les cookies et la
 * prochaine requête échoue de façon difficile à diagnostiquer.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  const config = getSupabaseConfig();

  // Sans configuration, on laisse passer : l'interface affichera un écran de
  // configuration explicite plutôt qu'une boucle de redirection.
  if (!config) {
    return { response: NextResponse.next({ request }), user: null };
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // En-têtes anti-cache exigés par @supabase/ssr dès qu'un cookie de
        // session est écrit : sans eux, un CDN peut servir la session d'un
        // utilisateur à un autre.
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        }
      },
    },
  });

  // getUser() vérifie le jeton auprès du serveur d'authentification : c'est la
  // seule vérification fiable, getSession() se contente de lire le cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
