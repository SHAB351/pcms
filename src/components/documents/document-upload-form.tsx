"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { televerserDocument, type DocumentFormState } from "@/lib/actions/documents";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { formatFileSize } from "@/lib/format";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/validation/schemas";

const INITIAL_STATE: DocumentFormState = { status: "idle" };

/** Message local immédiat : évite d'envoyer 10 Mo pour se voir refuser. */
function localFileError(file: File | undefined): string | null {
  if (!file) return "Sélectionnez un fichier.";
  if (file.size === 0) return "Le fichier est vide.";
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `Le fichier dépasse la limite de ${formatFileSize(MAX_DOCUMENT_BYTES)}.`;
  }
  if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Format non autorisé (PDF, Word, Excel, PowerPoint, texte, CSV, PNG ou JPEG).";
  }
  return null;
}

export function DocumentUploadForm({ categories }: { categories: string[] }) {
  const [state, formAction, pending] = useActionState(
    televerserDocument,
    INITIAL_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const error = localFileError(file);
    setFileError(error);
    setSelected(file && !error ? `${file.name} — ${formatFileSize(file.size)}` : null);

    // Reprendre le nom du fichier comme titre par défaut évite une saisie
    // inutile ; l'utilisateur reste libre de le remplacer.
    if (file && !error && title.trim() === "") {
      const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      setTitle(base.slice(0, 200));
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="Dépôt impossible">
          <p>{state.message}</p>
        </Alert>
      ) : null}

      <Field label="Titre" htmlFor="title" required error={state.fieldErrors?.title}>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          required
          aria-invalid={state.fieldErrors?.title ? true : undefined}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Catégorie" htmlFor="category" hint="Facultatif" error={state.fieldErrors?.category}>
          <Input id="category" name="category" maxLength={80} list="document-categories" />
          <datalist id="document-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>

        <Field
          label="Fichier"
          htmlFor="fichier"
          required
          hint={`${formatFileSize(MAX_DOCUMENT_BYTES)} maximum. PDF, Word, Excel, PowerPoint, texte, CSV, PNG, JPEG.`}
          error={fileError ?? state.fieldErrors?.fichier}
        >
          <Input
            id="fichier"
            name="fichier"
            type="file"
            accept={ALLOWED_DOCUMENT_MIME_TYPES.join(",")}
            onChange={handleFileChange}
            required
            className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
          />
        </Field>
      </div>

      {selected ? (
        <p className="text-xs text-slate-500">Fichier sélectionné : {selected}</p>
      ) : null}

      <Field label="Description" htmlFor="description" hint="Facultatif — objet du document, contexte utile au service." error={state.fieldErrors?.description}>
        <Textarea id="description" name="description" maxLength={2000} rows={3} />
      </Field>

      <Button type="submit" disabled={pending || Boolean(fileError)}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Envoi…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Déposer le document
          </>
        )}
      </Button>
    </form>
  );
}
