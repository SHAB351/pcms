/** Chemins de l'application, centralisés pour éviter les chaînes magiques. */

export const HOME_PATH = "/tableau-de-bord";
export const LOGIN_PATH = "/connexion";

/** Toutes les zones nécessitant une session. Le préfixe protège les sous-routes. */
export const PROTECTED_PREFIXES = [
  "/tableau-de-bord",
  "/documents",
  "/assistant",
  "/calendrier",
  "/taches",
  "/rapports",
  "/parametres",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Libellé lisible d'une route, utilisé dans l'en-tête de l'application. */
export const ROUTE_TITLES: Record<string, string> = {
  "/tableau-de-bord": "Tableau de bord",
  "/documents": "Documents",
  "/assistant": "Assistant IA",
  "/calendrier": "Calendrier éditorial",
  "/taches": "Tâches",
  "/rapports": "Rapports d'activité",
  "/parametres": "Paramètres",
};

export function getRouteTitle(pathname: string): string {
  const match = Object.keys(ROUTE_TITLES)
    .filter((route) => pathname === route || pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_TITLES[match] : "PCMS";
}
