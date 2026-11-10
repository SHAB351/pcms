"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { safeRedirectTarget } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/schemas";

export type LoginFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Renvoyé au formulaire pour ne pas vider le champ e-mail. */
  email?: string;
};

/**
 * N'accepte que les chemins internes : une valeur comme `//evil.example` ou
 * `https://evil.example` est ignorée, ce qui bloque les redirections ouvertes.
 */
export async function connexion(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Vérifiez les champs signalés.",
      fieldErrors,
      email: typeof formData.get("email") === "string" ? String(formData.get("email")) : "",
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message:
        "Supabase n'est pas configuré sur ce serveur. Renseignez les variables d'environnement avant de vous connecter.",
      email: parsed.data.email,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Message volontairement générique : ne pas révéler si l'adresse existe.
    return {
      status: "error",
      message: "Adresse e-mail ou mot de passe incorrect.",
      email: parsed.data.email,
    };
  }

  redirect(safeRedirectTarget(formData.get("suivant")));
}

export async function deconnexion(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect(LOGIN_PATH);
}
