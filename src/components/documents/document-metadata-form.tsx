"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { enregistrerDocument, type DocumentFormState } from "@/lib/actions/documents";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { DOCUMENT_STATUSES } from "@/lib/documents/constants";
import { DOCUMENT_STATUS_LABELS } from "@/lib/format";
import type { DocumentRecord } from "@/types/database";

const INITIAL_STATE: DocumentFormState = { status: "idle" };

export function DocumentMetadataForm({ document }: { document: DocumentRecord }) {
  const [state, formAction, pending] = useActionState(
    enregistrerDocument,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={document.id} />

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="Modification refusée">
          <p>{state.message}</p>
        </Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success" title="Enregistré">
          <p>{state.message}</p>
        </Alert>
      ) : null}

      <Field label="Titre" htmlFor="title" required error={state.fieldErrors?.title}>
        <Input
          id="title"
          name="title"
          defaultValue={document.title}
          maxLength={200}
          required
          aria-invalid={state.fieldErrors?.title ? true : undefined}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Catégorie" htmlFor="category" hint="Facultatif" error={state.fieldErrors?.category}>
          <Input id="category" name="category" defaultValue={document.category ?? ""} maxLength={80} />
        </Field>

        <Field label="Statut" htmlFor="statut">
          <Select id="statut" name="statut" defaultValue={document.status}>
            {DOCUMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DOCUMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor="description"
        hint="Facultatif"
        error={state.fieldErrors?.description}
      >
        <Textarea
          id="description"
          name="description"
          defaultValue={document.description ?? ""}
          maxLength={2000}
          rows={4}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Enregistrement…
          </>
        ) : (
          <>
            <Save className="h-4 w-4" aria-hidden="true" />
            Enregistrer
          </>
        )}
      </Button>
    </form>
  );
}
