import { aiConfig } from "@/lib/config";
import { buildPrompt } from "@/lib/ai/operations";
import {
  AiCallError,
  AiNotConfiguredError,
  type AiGenerationRequest,
  type AiGenerationResult,
  type AiProvider,
} from "@/lib/ai/types";

/**
 * Fournisseur générique « API compatible OpenAI ».
 *
 * Un seul adaptateur couvre OpenAI, Mistral, Groq, Together, un Ollama ou un
 * LM Studio local : tous exposent `POST {base}/chat/completions`. C'est le choix
 * le plus léger possible — un `fetch`, aucun SDK, aucune dépendance à installer.
 *
 * Configuration, dans `.env.local` (côté serveur uniquement) :
 *   AI_PROVIDER=openai-compatible
 *   AI_BASE_URL=https://api.mistral.ai/v1
 *   AI_MODEL=mistral-large-latest
 *   AI_API_KEY=…                      (jamais sous un nom NEXT_PUBLIC_)
 *   AI_ALLOW_EXTERNAL=true            (uniquement si le service est hors du poste)
 *
 * Un `AI_BASE_URL` pointant sur `127.0.0.1` ou `localhost` est considéré comme
 * **local** : le contenu ne quitte pas la machine, donc aucune autorisation
 * d'envoi externe n'est demandée.
 */

function isLocalEndpoint(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  try {
    const { hostname } = new URL(baseUrl);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export function createOpenAiCompatibleProvider(): AiProvider {
  const baseUrl = aiConfig.baseUrl?.replace(/\/+$/, "");
  const model = aiConfig.model;
  const apiKey = aiConfig.apiKey;
  const local = isLocalEndpoint(baseUrl);

  const configured = Boolean(baseUrl && model && (apiKey || local));

  return {
    info: {
      id: "openai-compatible",
      label: local
        ? `Modèle local (${model ?? "non précisé"})`
        : `Service externe (${model ?? "non précisé"})`,
      isConfigured: configured,
      isLocal: local,
      configurationHint: configured
        ? undefined
        : "Renseignez AI_BASE_URL, AI_MODEL et AI_API_KEY (ou un AI_BASE_URL local) dans .env.local.",
    },

    async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
      if (!configured || !baseUrl || !model) {
        throw new AiNotConfiguredError(
          "Le fournisseur « openai-compatible » n'est pas configuré.",
        );
      }

      const prompt = buildPrompt({
        operation: request.operation,
        brief: request.brief,
        sourceText: request.sourceMaterial,
        objective: request.objective,
        targetLanguage: request.targetLanguage,
        maxWords: request.maxWords,
      });

      // Le délai est porté par un AbortSignal : sans lui, une requête sortante
      // bloquée immobilise une Server Action jusqu'au délai de la plateforme.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), aiConfig.timeoutMs);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // On ne recopie jamais le corps d'erreur du fournisseur : il peut
          // contenir des fragments du texte envoyé.
          throw new AiCallError(
            `Le fournisseur a répondu ${response.status}. Aucun brouillon n'a été produit.`,
          );
        }

        const payload = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
          model?: string;
        };
        const content = payload.choices?.[0]?.message?.content?.trim();

        if (!content) {
          throw new AiCallError("Réponse vide du fournisseur. Aucun brouillon n'a été produit.");
        }

        return {
          content,
          provider: "openai-compatible",
          model: payload.model ?? model,
          warnings: local
            ? ["Texte produit par un modèle local : relecture humaine obligatoire."]
            : [
                "Texte produit par un service externe : relecture humaine obligatoire avant toute publication.",
              ],
          externalSent: !local,
        };
      } catch (error) {
        if (error instanceof AiCallError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new AiCallError(
            `Le fournisseur n'a pas répondu dans le délai imparti (${Math.round(aiConfig.timeoutMs / 1000)} s).`,
          );
        }
        throw new AiCallError(
          `Impossible de joindre le fournisseur : ${error instanceof Error ? error.message : "erreur inconnue"}.`,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
