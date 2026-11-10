import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export type SessionContext = {
  userId: string;
  email: string;
  profile: Profile;
};

/**
 * Profil de repli lorsqu'un compte existe mais que sa ligne `profiles` manque
 * (par exemple si le trigger `on_auth_user_created` n'a pas été installé).
 * Rôle « reader » : le plus restrictif, jamais une élévation implicite.
 */
function fallbackProfile(userId: string, email: string): Profile {
  const now = new Date().toISOString();
  return {
    id: userId,
    email,
    full_name: null,
    role: "reader",
    created_at: now,
    updated_at: now,
  };
}

/** Utilisateur et profil courants, ou `null` si personne n'est connecté. */
export async function getSession(): Promise<SessionContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? "",
    profile: profile ?? fallbackProfile(user.id, user.email ?? ""),
  };
}

/** Comme `getSession`, mais redirige vers la connexion si nécessaire. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}

/** Vérifie qu'un rôle fait partie des rôles attendus (défense en profondeur). */
export function hasRole(profile: Profile, roles: UserRole[]): boolean {
  return roles.includes(profile.role);
}

/** Un administrateur ou un rédacteur peut créer et modifier du contenu. */
export function canWrite(profile: Profile): boolean {
  return hasRole(profile, ["admin", "editor"]);
}

export function isAdmin(profile: Profile): boolean {
  return profile.role === "admin";
}
