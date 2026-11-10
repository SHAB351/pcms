"use client";

import { useActionState, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { genererBrouillon, type AssistantFormState } from "@/lib/actions/assistant";
import {
  AI_OPERATIONS,
  AI_TARGET_LANGUAGES,
  getOperation,
  isAiOperationId,
} from "@/lib/ai/operations";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { SourceDocumentOption } from "@/lib/data/assistant";

const INITIAL_STATE: AssistantFormState = { status: "idle" };

export type AssistantProviderInfo = {
  label: string;
  isLocal: boolean;
  isConfigured: boolean;
  configurationHint?: string;
  fallback: boolean;
};

export function AssistantForm({
  provider,
  documents,
}: {
  provider: AssistantProviderInfo;
  documents: SourceDocumentOption[];
}) {
  const [state, formAction, pending] = useActionState(genererBrouillon, INITIAL_STATE);
  const [operation, setOperation] = useState<string>("redaction");
  const [sourceMode, setSourceMode] = useState<"texte" | "document">("texte");

  const current = getOperation(isAiOperationId(operation) ? operation : "redaction");
  const needsSource = current.requiresSource;
  const requiresExternalAuthorization = !provider.isLocal;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="Aucun brouillon produit">
          <p>{state.message}</p>
        </Alert>
      ) : null}

      <Field
        label="Opération"
        htmlFor="operation"
        required
        error={state.fieldErrors?.operation}
        hint={current.description}
      >
        <Select
          id="operation"
          name="operation"
          value={operation}
          onChange={(event) => setOperation(event.target.value)}
        >
          {AI_OPERATIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Titre du brouillon" htmlFor="title" required error={state.fieldErrors?.title}>
        <Input id="title" name="title" maxLength={200} required />
      </Field>

      <Field
        label="Consigne"
        htmlFor="brief"
        required
        hint="Ce que vous attendez. N'indiquez ici aucun fait que vous ne voulez pas voir répété."
        error={state.fieldErrors?.brief}
      >
        <Textarea
          id="brief"
          name="brief"
          rows={3}
          maxLength={4000}
          required
          placeholder="Ex. : corrige ce communiqué sans changer le sens, ton institutionnel."
        />
      </Field>

      {needsSource ? (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="sourceMode"
                checked={sourceMode === "texte"}
                onChange={() => setSourceMode("texte")}
              />
              Coller le texte
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="sourceMode"
                checked={sourceMode === "document"}
                onChange={() => setSourceMode("document")}
              />
              Utiliser un document
            </label>
          </div>

          {sourceMode === "texte" ? (
            <Field
              label="Texte à traiter"
              htmlFor="sourceText"
              required
              hint="Seule source autorisée : l'assistant n'ajoute aucun fait extérieur."
              error={state.fieldErrors?.sourceText}
            >
              <Textarea id="sourceText" name="sourceText" rows={10} maxLength={60000} />
            </Field>
          ) : (
            <Field
              label="Document source"
              htmlFor="documentId"
              hint="Seuls les documents texte (TXT, CSV) sont lisibles sans outil d'extraction."
              error={state.fieldErrors?.documentId}
            >
              <Select id="documentId" name="documentId" defaultValue="">
                <option value="">— Aucun document —</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Objectif éditorial"
          htmlFor="objective"
          hint="Facultatif"
          error={state.fieldErrors?.objective}
        >
          <Input id="objective" name="objective" maxLength={200} />
        </Field>

        {current.needsTargetLanguage ? (
          <Field
            label="Langue cible"
            htmlFor="targetLanguage"
            required
            error={state.fieldErrors?.targetLanguage}
          >
            <Input
              id="targetLanguage"
              name="targetLanguage"
              list="ai-languages"
              maxLength={40}
              required
            />
            <datalist id="ai-languages">
              {AI_TARGET_LANGUAGES.map((language) => (
                <option key={language} value={language} />
              ))}
            </datalist>
          </Field>
        ) : (
          <Field
            label="Longueur indicative (mots)"
            htmlFor="maxWords"
            hint="Facultatif"
            error={state.fieldErrors?.maxWords}
          >
            <Input id="maxWords" name="maxWords" type="number" min={50} max={5000} />
          </Field>
        )}
      </div>

      {requiresExternalAuthorization ? (
        <Alert tone="warning" title="Ce fournisseur est externe">
          <p>
            Le texte saisi quittera ce poste pour être traité par « {provider.label} ». Ne
            déposez ici aucun document confidentiel sans accord de votre hiérarchie.
          </p>
          <label className="mt-2 flex items-start gap-2 font-medium">
            <input type="checkbox" name="externalAuthorized" value="on" className="mt-0.5" />
            <span>
              J&apos;autorise l&apos;envoi de ce texte à ce service externe pour cette demande.
            </span>
          </label>
          {state.fieldErrors?.externalAuthorized ? (
            <p className="text-xs font-medium text-red-700">{state.fieldErrors.externalAuthorized}</p>
          ) : null}
        </Alert>
      ) : null}

      {!provider.isConfigured ? (
        <Alert tone="danger" title="Fournisseur non configuré">
          <p>{provider.configurationHint}</p>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending || !provider.isConfigured}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Génération…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Générer un brouillon
          </>
        )}
      </Button>
    </form>
  );
}
