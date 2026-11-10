"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canWrite, isAdmin, requireSession } from "@/lib/auth/session";
import { getDocument } from "@/lib/data/documents";
import {
  SIGNATURE_SAMPLE_BYTES,
  signatureMatchesMimeType,
} from "@/lib/documents/file-signature";
import {
  buildStoragePath,
  removeDocumentObject,
  uploadDocumentObject,
} from "@/lib/documents/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  documentFileSchema,
  documentMetadataSchema,
} from "@/lib/validation/schemas";
import { DOCUMENT_STATUSES } from "@/lib/documents/constants";
import type { DocumentStatus } from "@/types/database";

/**
 * Server Actions du module Documents.
 *
 * Chaque action : (1) vérifie la session, (2) vérifie le droit métier,
 * (3) valide les entrées, (4) laisse RLS trancher en dernier ressort. Une action
 * ne fait jamais confiance à l'interface : les boutons masqués ne protègent rien.
 */

export type DocumentFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

function flattenIssues(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readStatus(formData: FormData): DocumentStatus | null {
  const value = readText(formData, "statut");
  return DOCUMENT_STATUSES.includes(value as DocumentStatus)
    ? (value as DocumentStatus)
    : null;
}

/** Dépôt d'un nouveau document. */
export async function televerserDocument(
  _previousState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const session = await requireSession();

  if (!canWrite(session.profile)) {
    return {
      status: "error",
      message: "Votre rôle ne permet pas de déposer un document.",
    };
  }

  const file = formData.get("fichier");
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Sélectionnez un fichier à déposer.",
      fieldErrors: { fichier: "Aucun fichier reçu." },
    };
  }

  const metadata = documentMetadataSchema.safeParse({
    title: readText(formData, "title"),
    description: readText(formData, "description"),
    category: readText(formData, "category"),
  });

  const fileCheck = documentFileSchema.safeParse({
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });

  if (!metadata.success || !fileCheck.success) {
    return {
      status: "error",
      message: "Vérifiez les champs signalés.",
      fieldErrors: {
        ...(metadata.success ? {} : flattenIssues(metadata.error.issues)),
        ...(fileCheck.success ? {} : flattenIssues(fileCheck.error.issues)),
      },
    };
  }

  // Le type annoncé par le navigateur n'est pas une preuve : on compare avec la
  // signature réelle des premiers octets.
  const sample = new Uint8Array(
    await file.slice(0, SIGNATURE_SAMPLE_BYTES).arrayBuffer(),
  );
  if (!signatureMatchesMimeType(file.type, sample)) {
    return {
      status: "error",
      message:
        "Le contenu du fichier ne correspond pas au type annoncé. Renommer un fichier ne change pas son format.",
      fieldErrors: { fichier: "Contenu incompatible avec l'extension." },
    };
  }

  const storagePath = buildStoragePath(file.name);
  const upload = await uploadDocumentObject(file, storagePath);
  if (!upload.ok) {
    return { status: "error", message: upload.message };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      title: metadata.data.title,
      description: metadata.data.description ?? null,
      category: metadata.data.category ?? null,
      status: "brouillon",
      storage_path: upload.path,
      file_name: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Le fichier ne doit pas rester orphelin dans le bucket.
    await removeDocumentObject(upload.path);
    return {
      status: "error",
      message: `Le fichier a été envoyé mais sa fiche n'a pas pu être enregistrée (${error?.message ?? "réponse vide"}). Le fichier a été retiré du stockage.`,
    };
  }

  revalidatePath("/documents");
  revalidatePath("/tableau-de-bord");
  redirect(`/documents/${data.id}?nouveau=1`);
}

/** Modification des métadonnées et du statut. */
export async function enregistrerDocument(
  _previousState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const session = await requireSession();
  const id = readText(formData, "id");

  if (!canWrite(session.profile)) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier un document." };
  }

  const metadata = documentMetadataSchema.safeParse({
    title: readText(formData, "title"),
    description: readText(formData, "description"),
    category: readText(formData, "category"),
  });
  const status = readStatus(formData);

  if (!metadata.success) {
    return {
      status: "error",
      message: "Vérifiez les champs signalés.",
      fieldErrors: flattenIssues(metadata.error.issues),
    };
  }
  if (!status) {
    return { status: "error", message: "Statut invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .update({
      title: metadata.data.title,
      description: metadata.data.description ?? null,
      category: metadata.data.category ?? null,
      status,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { status: "error", message: `Enregistrement refusé : ${error.message}` };
  }
  if (!data) {
    return {
      status: "error",
      message: "Document introuvable ou modification non autorisée.",
    };
  }

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { status: "success", message: "Modifications enregistrées." };
}

/** Change uniquement le statut (archivage, validation, retour en brouillon). */
export async function changerStatutDocument(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = readText(formData, "id");
  const status = readStatus(formData);

  if (!canWrite(session.profile) || !status) {
    redirect(`/documents/${id}?erreur=droits`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("documents")
    .update({ status })
    .eq("id", id);

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);

  redirect(`/documents/${id}${error ? "?erreur=statut" : ""}`);
}

/** Suppression définitive : fiche puis fichier. Réservée aux administrateurs. */
export async function supprimerDocument(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = readText(formData, "id");

  if (!isAdmin(session.profile)) {
    redirect(`/documents/${id}?erreur=droits`);
  }

  const { document } = await getDocument(id);
  if (!document) {
    redirect("/documents?erreur=introuvable");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) {
    redirect(`/documents/${id}?erreur=suppression`);
  }

  // La fiche est supprimée : l'objet du bucket devient inaccessible via
  // l'application. On le retire aussi, mais un échec ici n'annule pas la
  // suppression déjà actée — il est signalé à l'opérateur.
  const removed = await removeDocumentObject(document.storage_path);

  revalidatePath("/documents");
  revalidatePath("/tableau-de-bord");
  redirect(`/documents?supprime=1${removed ? "" : "&erreur=fichier-orphelin"}`);
}
