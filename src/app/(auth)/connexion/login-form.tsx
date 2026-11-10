"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { connexion, type LoginFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";

const INITIAL_STATE: LoginFormState = { status: "idle" };

export function LoginForm({ suivant }: { suivant?: string }) {
  const [state, formAction, pending] = useActionState(connexion, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="suivant" value={suivant ?? ""} />

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="Connexion refusée">
          <p>{state.message}</p>
        </Alert>
      ) : null}

      <Field
        label="Adresse e-mail"
        htmlFor="email"
        error={state.fieldErrors?.email}
        required
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.email ?? ""}
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        error={state.fieldErrors?.password}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password ? true : undefined}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Connexion…
          </>
        ) : (
          "Se connecter"
        )}
      </Button>
    </form>
  );
}
