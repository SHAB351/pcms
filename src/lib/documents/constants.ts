import type { DocumentStatus } from "@/types/database";

/**
 * Constantes partagées entre le serveur et le navigateur.
 *
 * Ce fichier ne doit importer **aucun** module serveur (client Supabase, `next/
 * headers`, etc.) : il est chargé par des composants clients. C'est précisément
 * la raison de son existence — importer la même constante depuis
 * `lib/data/documents.ts` entraînait le client Supabase dans le bundle client et
 * faisait échouer le build.
 */

export const DOCUMENTS_PAGE_SIZE = 20;

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "brouillon",
  "en_revue",
  "valide",
  "archive",
];
