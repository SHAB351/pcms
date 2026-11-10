/**
 * Constantes du module Assistant, séparées des lectures Supabase.
 *
 * Un composant client qui importerait `@/lib/data/assistant` tirerait le client
 * serveur dans le bundle du navigateur : le build casse. C'est exactement le
 * piège rencontré sur le module Documents ; la séparation est donc volontaire.
 */

export const AI_DRAFT_STATUSES = [
  "brouillon",
  "en_revue",
  "approuve",
  "rejete",
] as const;

export type AiDraftStatusValue = (typeof AI_DRAFT_STATUSES)[number];

export const DRAFT_STATUS_LABELS: Record<AiDraftStatusValue, string> = {
  brouillon: "Brouillon",
  en_revue: "En relecture",
  approuve: "Approuvé",
  rejete: "Rejeté",
};

export const DRAFTS_PAGE_SIZE = 20;

/** Un statut qui autorise encore une modification libre du texte. */
export function isEditableStatus(status: AiDraftStatusValue): boolean {
  return status !== "approuve" && status !== "rejete";
}
