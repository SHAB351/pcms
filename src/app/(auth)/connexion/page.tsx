import type { Metadata } from "next";
import { ConfigurationRequired } from "@/components/layout/configuration-required";
import { isSupabaseConfigured } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suivant?: string | string[] }>;
}) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const params = await searchParams;
  const suivant = typeof params.suivant === "string" ? params.suivant : undefined;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          PC
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
          PCMS
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Plateforme interne du service de communication
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm suivant={suivant} />
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        L&apos;accès est réservé aux membres du service. Les comptes sont créés
        par un administrateur ; l&apos;inscription libre est désactivée.
      </p>
    </div>
  );
}
