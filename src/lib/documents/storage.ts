import { DOCUMENTS_BUCKET } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Accès au bucket privé « documents ».
 *
 * Règles tenues ici :
 * - aucun nom de fichier fourni par l'utilisateur n'est utilisé comme chemin tel
 *   quel (traversée de répertoire, caractères de contrôle, collisions) ;
 * - aucune URL publique n'existe : la lecture passe par une URL signée de courte
 *   durée ;
 * - le client utilisé porte la session de l'utilisateur, donc les politiques
 *   Storage (`can_write`, `is_admin`) s'appliquent réellement.
 */

/** Durée de vie d'un lien de téléchargement, en secondes. */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

const MAX_STEM_LENGTH = 60;

/**
 * Réduit un nom de fichier à un fragment sûr : ASCII, minuscules, sans accent,
 * sans chemin. L'extension est conservée si elle est plausible.
 */
export function sanitizeFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < fileName.length - 1;
  const rawStem = hasExtension ? fileName.slice(0, lastDot) : fileName;
  const rawExtension = hasExtension ? fileName.slice(lastDot + 1) : "";

  const stem =
    rawStem
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, MAX_STEM_LENGTH) || "fichier";

  const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);

  return extension ? `${stem}.${extension}` : stem;
}

/**
 * Chemin de stockage : année puis identifiant aléatoire.
 *
 * L'identifiant aléatoire évite qu'un chemin deviné permette d'écraser le
 * fichier d'un collègue (`upsert` reste désactivé côté Storage).
 */
export function buildStoragePath(fileName: string, now: Date = new Date()): string {
  const year = String(now.getUTCFullYear());
  const unique = crypto.randomUUID();
  return `${year}/${unique}-${sanitizeFileName(fileName)}`;
}

export type StorageResult = { ok: true; path: string } | { ok: false; message: string };

/**
 * Envoie un fichier déjà validé (type, taille) dans le bucket privé.
 *
 * Le tableau de bord Supabase peut renvoyer un message technique : il est
 * traduit, mais jamais masqué — l'opérateur doit pouvoir diagnostiquer.
 */
export async function uploadDocumentObject(
  file: File,
  storagePath: string,
): Promise<StorageResult> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "private, max-age=0",
      upsert: false,
    });

  if (error) {
    return { ok: false, message: `Envoi du fichier refusé par le stockage : ${error.message}` };
  }

  return { ok: true, path: storagePath };
}

/**
 * URL signée de téléchargement, valable une minute.
 *
 * `download` force `Content-Disposition: attachment` : le navigateur enregistre
 * le fichier au lieu de l'afficher, ce qui évite qu'un fichier déposé soit rendu
 * comme une page dans l'origine du service.
 */
export async function createSignedDownloadUrl(
  storagePath: string,
  fileName: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS, { download: fileName });

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Supprime l'objet du stockage. Réservé aux administrateurs par les politiques. */
export async function removeDocumentObject(storagePath: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
  return !error;
}
