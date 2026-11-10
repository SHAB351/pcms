/**
 * Les six opérations de l'assistant.
 *
 * Une opération décrit trois choses, et rien d'autre : ce qu'elle attend comme
 * entrée, la consigne envoyée au fournisseur, et l'avertissement affiché avec
 * le résultat. Tout le reste (base de données, droits, validation humaine) est
 * commun à toutes les opérations.
 */

export type AiOperationId =
  | "correction"
  | "amelioration"
  | "reformulation"
  | "resume"
  | "traduction"
  | "redaction";

export type AiOperation = {
  id: AiOperationId;
  label: string;
  description: string;
  /** `true` si l'opération n'a aucun sens sans un texte à traiter. */
  requiresSource: boolean;
  /** `true` si la langue cible doit être renseignée. */
  needsTargetLanguage: boolean;
};

export const AI_OPERATIONS: readonly AiOperation[] = [
  {
    id: "correction",
    label: "Correction orthographique et grammaticale",
    description:
      "Corrige la langue sans changer le sens, le ton ni l'ordre des idées.",
    requiresSource: true,
    needsTargetLanguage: false,
  },
  {
    id: "amelioration",
    label: "Amélioration rédactionnelle",
    description:
      "Rend le texte plus clair et plus ferme, sans ajouter de fait nouveau.",
    requiresSource: true,
    needsTargetLanguage: false,
  },
  {
    id: "reformulation",
    label: "Reformulation",
    description:
      "Dit la même chose autrement, pour un autre public ou un autre canal.",
    requiresSource: true,
    needsTargetLanguage: false,
  },
  {
    id: "resume",
    label: "Résumé de document",
    description:
      "Condense un texte fourni ou un document texte du module Documents.",
    requiresSource: true,
    needsTargetLanguage: false,
  },
  {
    id: "traduction",
    label: "Traduction",
    description:
      "Traduit le texte fourni vers la langue demandée, sans rien ajouter.",
    requiresSource: true,
    needsTargetLanguage: true,
  },
  {
    id: "redaction",
    label: "Génération de brouillon",
    description:
      "Propose un premier jet à partir d'une consigne et des seuls éléments fournis.",
    requiresSource: false,
    needsTargetLanguage: false,
  },
] as const;

export function isAiOperationId(value: string): value is AiOperationId {
  return AI_OPERATIONS.some((operation) => operation.id === value);
}

export function getOperation(id: AiOperationId): AiOperation {
  const operation = AI_OPERATIONS.find((candidate) => candidate.id === id);
  if (!operation) throw new Error(`Opération inconnue : ${id}`);
  return operation;
}

/** Langues proposées ; le champ reste libre pour les autres. */
export const AI_TARGET_LANGUAGES = [
  "français",
  "anglais",
  "chinois (mandarin)",
  "espagnol",
  "portugais",
  "swahili",
  "lingala",
  "arabe",
] as const;

export type AiPrompt = { system: string; user: string };

export type AiPromptInput = {
  operation: AiOperationId;
  /** Consigne rédigée par l'utilisateur. */
  brief: string;
  /** Texte à transformer, ou éléments fournis pour une rédaction. */
  sourceText?: string;
  /** Objectif éditorial facultatif (communiqué, discours…). */
  objective?: string;
  /** Renseigné pour une traduction. */
  targetLanguage?: string;
  /** Longueur indicative demandée. */
  maxWords?: number;
};

/**
 * Consigne commune. Elle est volontairement absolue sur les faits : un
 * assistant de communication institutionnelle qui invente un chiffre coûte
 * plus cher qu'un assistant qui refuse de le produire.
 */
export const SYSTEM_PROMPT = [
  "Tu assistes un service de communication institutionnelle francophone.",
  "Règle absolue : tu n'inventes jamais un fait, un chiffre, une date, un nom",
  "ni une citation. Tu ne travailles que sur le texte fourni par l'utilisateur.",
  "Si une information manque, tu écris explicitement « [à compléter] » au lieu",
  "de la deviner. Tu ne promets rien au nom de l'institution.",
  "Ta réponse contient uniquement le texte demandé, sans préambule ni excuse.",
].join(" ");

const INSTRUCTIONS: Record<AiOperationId, string> = {
  correction:
    "Corrige l'orthographe, la grammaire, la ponctuation et les accords. Conserve le sens, le ton, le registre et l'ordre des idées. Ne reformule pas les phrases déjà correctes.",
  amelioration:
    "Améliore la clarté, la concision et la fermeté du texte. Supprime les répétitions et les tournures vagues. N'ajoute aucun fait, aucun chiffre et aucune promesse.",
  reformulation:
    "Reformule le texte en conservant exactement les mêmes informations. Adapte le registre à l'objectif indiqué, sans ajouter ni retirer aucun fait.",
  resume:
    "Résume le texte en conservant les faits, les chiffres et les dates tels quels. Signale explicitement ce qui relève d'une décision, d'une opinion ou d'une annonce.",
  traduction:
    "Traduis le texte dans la langue demandée. Ne traduis pas les noms propres, les sigles institutionnels ni les intitulés officiels. N'ajoute aucune information.",
  redaction:
    "Rédige un premier jet à partir de la consigne et des éléments fournis. Marque « [à compléter] » partout où une information manque. Termine par la liste des points à vérifier avant publication.",
};

/**
 * Délimiteur du bloc « texte à traiter ».
 *
 * Un délimiteur fixe `"""` peut être refermé par un document qui contient
 * lui-même cette suite : la fin du document serait alors lue comme une
 * instruction (injection de prompt). On choisit donc une suite de guillemets
 * plus longue que toute suite présente dans le texte. Sans suite de trois
 * guillemets ou plus, le délimiteur reste `"""`.
 */
function sourceFence(text: string): string {
  const suites = text.match(/"+/g) ?? [];
  const plusLongue = suites.reduce((max, suite) => Math.max(max, suite.length), 0);
  return '"'.repeat(Math.max(3, plusLongue + 1));
}

export function buildPrompt(input: AiPromptInput): AiPrompt {
  const operation = getOperation(input.operation);
  const parts: string[] = [INSTRUCTIONS[input.operation]];

  if (input.operation === "traduction") {
    parts.push(`Langue cible : ${input.targetLanguage}.`);
  }
  if (input.objective) parts.push(`Objectif éditorial : ${input.objective}.`);
  if (input.maxWords && input.maxWords > 0) {
    parts.push(`Longueur indicative : environ ${input.maxWords} mots.`);
  }

  parts.push("", "Consigne de l'utilisateur :", input.brief.trim());

  if (input.sourceText && input.sourceText.trim().length > 0) {
    const source = input.sourceText.trim();
    const fence = sourceFence(source);
    parts.push("", "Texte à traiter (seule source autorisée) :", fence, source, fence);
  } else if (operation.requiresSource) {
    parts.push(
      "",
      "Aucun texte n'a été fourni. Réponds uniquement : « Aucun texte à traiter n'a été fourni. »",
    );
  }

  return { system: SYSTEM_PROMPT, user: parts.join("\n") };
}
