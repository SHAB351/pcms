import { AppShell } from "@/components/layout/app-shell";
import { ConfigurationRequired } from "@/components/layout/configuration-required";
import { requireSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * Toutes les routes de ce groupe exigent une session. Le proxy les protège en
 * amont ; `requireSession()` re-vérifie ici, car une URL peut toujours être
 * atteinte sans passer par le proxy (rendu interne, préchargement).
 *
 * Le rendu dynamique est imposé globalement par src/app/layout.tsx.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const session = await requireSession();

  return <AppShell profile={session.profile}>{children}</AppShell>;
}
