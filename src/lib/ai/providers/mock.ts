import { getOperation } from "@/lib/ai/operations";
import type {
  AiGenerationRequest,
  AiGenerationResult,
  AiProvider,
} from "@/lib/ai/types";

/**
 * Fournisseur factice, hors ligne et déterministe.
 *
 * Il sert à valider le parcours « consigne → brouillon → relecture » tant
 * qu'aucun fournisseur réel n'est branché. Il N'INVENTE RIEN : il ne sait pas
 * rédiger, il ne réécrit pas le texte reçu, il le restitue sous une forme
 * explicitement étiquetée comme non publiable. Son intérêt est d'être honnête :
 * l'interface et la base peuvent être exercées de bout en bout sans qu'aucun
 * contenu ne quitte le poste.
 */
export const mockProvider: AiProvider = {
  info: {
    id: "mock",
    label: "Générateur factice (hors ligne)",
    isConfigured: true,
    isLocal: true,
    configurationHint:
      "Aucun fournisseur d'IA réel n'est branché : le texte produit est un gabarit de travail, pas une rédaction.",
  },

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    const operation = getOperation(request.operation);
    const lines: string[] = [
      `## Gabarit — ${operation.label}`,
      "",
      `**Consigne reçue :** ${request.brief.trim()}`,
    ];

    if (request.objective) lines.push(`**Objectif :** ${request.objective}`);
    if (request.operation === "traduction") {
      lines.push(`**Langue cible :** ${request.targetLanguage}`);
    }

    if (request.sourceMaterial && request.sourceMaterial.trim().length > 0) {
      lines.push(
        "",
        "### Texte fourni (reproduit sans transformation)",
        "",
        request.sourceMaterial.trim(),
      );
    } else if (operation.requiresSource) {
      lines.push(
        "",
        "> Aucun texte à traiter n'a été fourni. Cette opération ne peut pas produire de résultat.",
      );
    } else {
      lines.push(
        "",
        "### Points à traiter",
        "1. Le fait principal et sa date exacte (à sourcer).",
        "2. Les acteurs concernés et leur rôle (à vérifier).",
        "3. Les chiffres à citer (aucun chiffre sans source).",
        "4. La citation éventuelle (uniquement si un verbatim est fourni).",
      );
    }

    lines.push(
      "",
      "---",
      "*Gabarit produit hors ligne : aucun fait, chiffre ou citation n'a été ajouté. " +
        "Relecture humaine obligatoire ; ne pas publier en l'état.*",
    );

    return {
      content: lines.join("\n"),
      provider: "mock",
      model: "gabarit-v2",
      warnings: [
        "Fournisseur factice : le texte est un gabarit, pas une rédaction.",
        "Aucun fait, chiffre ou citation n'a été ajouté automatiquement.",
      ],
      externalSent: false,
    };
  },
};
