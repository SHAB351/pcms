import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { HOME_PATH, LOGIN_PATH, isProtectedPath } from "@/lib/auth/routes";
import { contentSecurityPolicy, preventPrivateCaching } from "@/lib/security";

/**
 * Proxy Next.js 16 (anciennement « middleware »).
 *
 * Deux responsabilités, dans cet ordre :
 *  1. rafraîchir la session Supabase et réécrire les cookies ;
 *  2. rediriger les visiteurs non connectés hors des zones privées.
 *
 * Ce n'est PAS la couche d'autorisation : les Server Actions et les politiques
 * RLS vérifient de nouveau l'identité et le rôle. Le proxy n'évite que le rendu
 * inutile d'une page privée.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development", process.env.NEXT_PUBLIC_SUPABASE_URL);
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);
  const { response, user } = await updateSession(request);
  const secure = (result: NextResponse) => {
    result.headers.set("Content-Security-Policy", csp);
    preventPrivateCaching(result.headers);
    return result;
  };
  const { pathname } = request.nextUrl;

  const isLoginRoute = pathname === LOGIN_PATH;

  if (isProtectedPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("suivant", pathname);
    const redirectResponse = NextResponse.redirect(url);
    // Conserver les cookies de session rafraîchis sur la redirection.
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return secure(redirectResponse);
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = HOME_PATH;
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return secure(redirectResponse);
  }

  return secure(response);
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les ressources statiques et les fichiers d'image :
     * inutile de payer un appel réseau d'authentification pour elles.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
