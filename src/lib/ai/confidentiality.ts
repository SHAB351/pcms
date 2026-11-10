/**
 * Décision de confidentialité, prise à un seul endroit et côté serveur.
 *
 * Envoyer un document du service à un fournisseur externe est une décision
 * sensible. Elle exige deux clés, jamais une seule :
 *
 *  1. **l'opérateur** autorise globalement les sorties, par `AI_ALLOW_EXTERNAL=true`
 *     dans l'environnement du serveur (valeur par défaut : refus) ;
 *  2. **l'utilisateur** autorise explicitement, pour cette requête, l'envoi du
 *     texte affiché à l'écran.
 *
 * Un fournisseur local (`mock`, ou un modèle servi sur le poste) ne fait sortir
 * aucun contenu : aucune autorisation n'est alors demandée, parce qu'en réclamer
 * une banaliserait le geste sans rien protéger.
 */

export type SendDecision = {
  /** Le contenu de cette requête quitte-t-il le poste ? */
  external: boolean;
  allowed: boolean;
  /** Motif du refus, rédigé pour être affiché tel quel à l'utilisateur. */
  refusal?: string;
};

export type SendDecisionInput = {
  provider: {
    id: string;
    label: string;
    isLocal: boolean;
    isConfigured: boolean;
    configurationHint?: string;
  };
  /** Autorisation globale de l'opérateur (`AI_ALLOW_EXTERNAL`). */
  allowExternal: boolean;
  /** Autorisation cochée par l'utilisateur pour cette requête. */
  userAuthorized: boolean;
};

export function decideSend(input: SendDecisionInput): SendDecision {
  const { provider } = input;

  if (!provider.isConfigured) {
    return {
      external: !provider.isLocal,
      allowed: false,
      refusal:
        provider.configurationHint ??
        `Le fournisseur « ${provider.label} » n'est pas configuré.`,
    };
  }

  if (provider.isLocal) {
    return { external: false, allowed: true };
  }

  if (!input.allowExternal) {
    return {
      external: true,
      allowed: false,
      refusal:
        "L'envoi vers un service externe est désactivé sur ce serveur " +
        "(AI_ALLOW_EXTERNAL n'est pas activé). Le texte n'a pas quitté le poste.",
    };
  }

  if (!input.userAuthorized) {
    return {
      external: true,
      allowed: false,
      refusal:
        "Ce fournisseur est externe : cochez l'autorisation d'envoi pour continuer. " +
        "Le texte n'a pas quitté le poste.",
    };
  }

  return { external: true, allowed: true };
}

/**
 * Garde-fou de taille : un envoi externe au-delà de cette limite est refusé
 * plutôt que tronqué en silence. Tronquer un document confidentiel pour le faire
 * tenir dans un quota est une fuite partielle, pas une protection.
 */
export const MAX_EXTERNAL_SOURCE_CHARS = 60_000;

export function checkExternalSize(
  decision: SendDecision,
  sizeChars: number,
): { ok: true } | { ok: false; refusal: string } {
  if (!decision.external) return { ok: true };
  if (sizeChars <= MAX_EXTERNAL_SOURCE_CHARS) return { ok: true };
  return {
    ok: false,
    refusal:
      `Le texte fait ${sizeChars} caractères ; l'envoi externe est refusé au-delà de ` +
      `${MAX_EXTERNAL_SOURCE_CHARS}. Réduisez le texte ou utilisez un fournisseur local.`,
  };
}
