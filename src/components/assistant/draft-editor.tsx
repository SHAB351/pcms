"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { enregistrerBrouillon, type AssistantFormState } from "@/lib/actions/assistant";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";

const INITIAL_STATE: AssistantFormState = { status: "idle" };

export function DraftEditor({
  id,
  title,
  content,
  alreadyReviewed,
}: {
  id: string;
  title: string;
  content: string;
  /** `true` si le brouillon était approuvé : le texte retouché repassera en brouillon. */
  alreadyReviewed: boolean;
}) {
  const [state, formAction, pending] = useActionState(enregistrerBrouillon, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="Enregistrement impossible">
          <p>{state.message}</p>
        </Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success" title="Enregistré">
          <p>{state.message}</p>
        </Alert>
      ) : null}

      <Field label="Titre" htmlFor="draft-title" required error={state.fieldErrors?.title}>
        <Input id="draft-title" name="title" defaultValue={title} maxLength={200} required />
      </Field>

      <Field
        label="Texte du brouillon"
        htmlFor="draft-content"
        required
        hint={
          alreadyReviewed
            ? "Ce brouillon est approuvé : toute modification du texte annule la validation (règle appliquée en base)."
            : "Relisez intégralement avant de soumettre à validation."
        }
        error={state.fieldErrors?.content}
      >
        <Textarea
          id="draft-content"
          name="content"
          defaultValue={content}
          rows={18}
          className="font-mono text-[13px] leading-relaxed"
          required
        />
      </Field>

      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" aria-hidden="true" />
        {pending ? "Enregistrement…" : "Enregistrer les modifications"}
      </Button>
    </form>
  );
}
