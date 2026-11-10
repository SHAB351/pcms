/**
 * Contrat commun aux fournisseurs d'IA.
 *
 * L'application ne connaît que cette interface : remplacer le fournisseur ne
 * demande que l'ajout d'un fichier dans `./providers` et une ligne dans
 * `registry.ts`. Aucun appel réseau n'est effectué ailleurs qu'ici, et
 * uniquement côté serveur.
 */

import type { AiOperationId } from "@/lib/ai/operations";

export type AiGenerationRequest = {
  /** Opération demandée parmi les six de l'assistant. */
  operation: AiOperationId;
  /** Consigne principale rédigée par l'utilisateur. */
  brief: string;
  /** Objectif éditorial facultatif (communiqué, discours, publication…). */
  objective?: string;
  /** Texte à transformer. Seule source de faits autorisée. */
  sourceMaterial?: string;
  /** Langue cible, pour une traduction. */
  targetLanguage?: string;
  /** Longueur indicative demandée. */
  maxWords?: number;
};

export type AiGenerationResult = {
  /** Texte proposé. Toujours un brouillon soumis à relecture humaine. */
  content: string;
  provider: string;
  model: string;
  /**
   * Avertissements à afficher avec le brouillon (fournisseur factice,
   * limite atteinte, sources absentes…).
   */
  warnings: string[];
  /** `true` si le texte a réellement quitté le poste. Toujours `false` en local. */
  externalSent: boolean;
};

export type AiProviderInfo = {
  id: string;
  label: string;
  /** `true` seulement si la configuration nécessaire est réellement présente. */
  isConfigured: boolean;
  /**
   * `true` si le fournisseur travaille sur le poste, sans transfert réseau du
   * contenu. C'est cette valeur — et non une case cochée — qui décide si une
   * autorisation d'envoi est nécessaire.
   */
  isLocal: boolean;
  /** Message affiché à l'opérateur lorsque `isConfigured` vaut `false`. */
  configurationHint?: string;
};

export interface AiProvider {
  readonly info: AiProviderInfo;
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
}

export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export class AiCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiCallError";
  }
}
