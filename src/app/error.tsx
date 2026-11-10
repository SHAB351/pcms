"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Journalisation côté navigateur uniquement : le message d'erreur ne doit
    // pas être affiché tel quel, il peut contenir des informations internes.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        Une erreur inattendue s&apos;est produite
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        L&apos;action n&apos;a pas abouti. Vous pouvez réessayer ; si le problème
        persiste, signalez la référence ci-dessous à l&apos;administrateur.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-slate-500">
          Référence : {error.digest}
        </p>
      ) : null}
      <Button onClick={reset} className="mt-6">
        Réessayer
      </Button>
    </div>
  );
}
