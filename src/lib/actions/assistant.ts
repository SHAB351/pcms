"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiConfig } from "@/lib/config";
import { canWrite, isAdmin, requireSession } from "@/lib/auth/session";
import { getProvider } from "@/lib/ai/registry";
import { checkExternalSize, decideSend } from "@/lib/ai/confidentiality";
import {
  AiCallError,
  AiNotConfiguredError,
  type AiGenerationResult,
} from "@/lib/ai/types";
import { readDocumentSource } from "@/lib/data/assistant";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  aiDraftContentSchema,
  assistantRequestSchema,
} from "@/lib/validation/schemas";
import type { AiDraftStatus } from "@/types/database";

/**
 * Server Actions du module Assistant.
 *
 * Trois invariants, vérifiés ici pour chaque action :
 *  1. la session et le rôle sont relus côté serveur — l'interface ne protège rien ;
 *  2. aucun contenu ne part vers un service externe sans les deux autorisations
 *     de `decideSend` ;
 *  3. un texte produit reste un brouillon : seul un administrateur l'approuve.
 */

export type AssistantFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function flattenIssues(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** Génère un brouillon, l'enregistre, puis ouvre sa fiche. */
export async function genererBrouillon(
  _previousState: AssistantFormState,
  formData: FormData,
): Promise<AssistantFormState> {
  const session = await requireSession();

  if (!canWrite(session.profile)) {
    return {
      status: "error",
      message: "Votre rôle ne permet pas de générer un brouillon.",
    };
  }

  const parsed = assistantRequestSchema.safeParse({
    operation: readText(formData, "operation"),
    title: readText(formData, "title"),
    brief: readText(formData, "brief"),
    objective: readText(formData, "objective"),
    sourceText: readText(formData, "sourceText"),
    documentId: readText(formData, "documentId"),
    targetLanguage: readText(formData, "targetLanguage"),
    maxWords: readText(formData, "maxWords"),
    externalAuthorized: readText(formData, "externalAuthorized"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vérifiez les champs signalés.",
      fieldErrors: flattenIssues(parsed.error.issues),
    };
  }

  const input = parsed.data;

  // --- Source unique --------------------------------------------------------
  let sourceText = input.sourceText ?? "";
  let documentId: string | null = null;
  if (input.documentId) {
    const source = await readDocumentSource(input.documentId);
    if (!source.ok) {
      return {
        status: "error",
        message: source.reason,
        fieldErrors: { documentId: source.reason },
      };
    }
    sourceText = source.text;
    documentId = input.documentId;
  }

  // --- Confidentialité ------------------------------------------------------
  const provider = getProvider();
  const decision = decideSend({
    provider: provider.info,
    allowExternal: aiConfig.allowExternal,
    userAuthorized: input.externalAuthorized,
  });

  if (!decision.allowed) {
    const refusal = decision.refusal ?? "Envoi refusé.";
    return {
      status: "error",
      message: refusal,
      fieldErrors: { externalAuthorized: refusal },
    };
  }

  const size = sourceText.length + input.brief.length;
  const sizeCheck = checkExternalSize(decision, size);
  if (!sizeCheck.ok) {
    return { status: "error", message: sizeCheck.refusal };
  }

  // --- Appel du fournisseur -------------------------------------------------
  let result: AiGenerationResult;
  try {
    result = await provider.generate({
      operation: input.operation,
      brief: input.brief,
      objective: input.objective,
      sourceMaterial: sourceText || undefined,
      targetLanguage: input.targetLanguage,
      maxWords: input.maxWords,
    });
  } catch (error) {
    const message =
      error instanceof AiNotConfiguredError || error instanceof AiCallError
        ? error.message
        : "La génération a échoué. Aucun brouillon n'a été enregistré.";
    return { status: "error", message };
  }

  // --- Enregistrement -------------------------------------------------------
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_drafts")
    .insert({
      title: input.title,
      brief: input.brief,
      content: result.content,
      operation: input.operation,
      // Le texte source n'est conservé que s'il a été collé : pour un document,
      // la référence suffit et dupliquer son contenu multiplierait les copies
      // d'un texte potentiellement confidentiel.
      source_text: documentId ? null : (input.sourceText ?? null),
      document_id: documentId,
      target_language: input.targetLanguage ?? null,
      external_sent: result.externalSent,
      warnings: result.warnings,
      provider: result.provider,
      model: result.model,
      status: "brouillon",
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: `Le texte a été produit mais n'a pas pu être enregistré (${error?.message ?? "réponse vide"})`,
    };
  }

  revalidatePath("/assistant");
  redirect(`/assistant/${data.id}?nouveau=1`);
}

/** Enregistre une correction manuelle du texte (auteur ou administrateur). */
export async function enregistrerBrouillon(
  _previousState: AssistantFormState,
  formData: FormData,
): Promise<AssistantFormState> {
  const session = await requireSession();
  const id = readText(formData, "id");

  if (!canWrite(session.profile)) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier un brouillon." };
  }

  const parsed = aiDraftContentSchema.safeParse({
    title: readText(formData, "title"),
    content: readText(formData, "content"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vérifiez les champs signalés.",
      fieldErrors: flattenIssues(parsed.error.issues),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_drafts")
    .update({ title: parsed.data.title, content: parsed.data.content })
    .eq("id", id)
    .select("status")
    .maybeSingle();

  if (error) {
    return { status: "error", message: `Enregistrement refusé : ${error.message}` };
  }
  if (!data) {
    return { status: "error", message: "Brouillon introuvable ou modification non autorisée." };
  }

  revalidatePath("/assistant");
  revalidatePath(`/assistant/${id}`);

  return {
    status: "success",
    message:
      data.status === "brouillon"
        ? "Brouillon enregistré. Une correction du texte annule toute validation antérieure."
        : "Brouillon enregistré.",
  };
}

/** Soumet le brouillon à relecture (auteur ou administrateur). */
export async function soumettreBrouillon(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = readText(formData, "id");

  if (!canWrite(session.profile)) {
    redirect(`/assistant/${id}?erreur=droits`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_drafts")
    .update({ status: "en_revue" })
    .eq("id", id)
    .in("status", ["brouillon", "rejete"]);

  revalidatePath(`/assistant/${id}`);
  revalidatePath("/assistant");
  redirect(`/assistant/${id}${error ? "?erreur=statut" : "?soumis=1"}`);
}

/**
 * Approuve ou rejette un brouillon. Réservé à l'administrateur : le déclencheur
 * `ai_drafts_guard_review` le vérifie aussi en base, pour qu'un appel direct à
 * l'API REST ne contourne pas cette règle.
 */
export async function deciderBrouillon(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = readText(formData, "id");
  const decision = readText(formData, "decision");

  if (!isAdmin(session.profile)) {
    redirect(`/assistant/${id}?erreur=droits`);
  }

  if (decision !== "approuve" && decision !== "rejete") {
    redirect(`/assistant/${id}?erreur=decision`);
  }

  const status: AiDraftStatus = decision;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_drafts")
    .update({
      status,
      reviewed_by: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath(`/assistant/${id}`);
  revalidatePath("/assistant");
  redirect(`/assistant/${id}${error ? "?erreur=decision" : `?${decision}=1`}`);
}

/** Suppression définitive, réservée à l'administrateur. */
export async function supprimerBrouillon(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = readText(formData, "id");

  if (!isAdmin(session.profile)) {
    redirect(`/assistant/${id}?erreur=droits`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_drafts").delete().eq("id", id);

  if (error) {
    redirect(`/assistant/${id}?erreur=suppression`);
  }

  revalidatePath("/assistant");
  redirect("/assistant?supprime=1");
}
