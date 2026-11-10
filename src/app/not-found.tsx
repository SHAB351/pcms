import Link from "next/link";
import { HOME_PATH } from "@/lib/auth/routes";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Erreur 404
      </p>
      <h1 className="mt-2 text-lg font-semibold text-slate-900">
        Page introuvable
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        L&apos;adresse demandée n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href={HOME_PATH}
        className="mt-6 text-sm font-medium text-blue-700 underline"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
