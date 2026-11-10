import { aiConfig } from "@/lib/config";
import { mockProvider } from "@/lib/ai/providers/mock";
import { createOpenAiCompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import type { AiProvider, AiProviderInfo } from "@/lib/ai/types";

/**
 * Registre des fournisseurs d'IA disponibles.
 *
 * Pour ajouter un fournisseur :
 *  1. créer `providers/<nom>.ts` exportant un objet `AiProvider` ;
 *  2. l'enregistrer ci-dessous ;
 *  3. renseigner `AI_PROVIDER` dans `.env.local`.
 *
 * Changer de fournisseur est une variable d'environnement, pas une réécriture :
 * aucun écran, aucune Server Action, aucune table ne connaît le fournisseur.
 *
 * Un fournisseur dont `info.isConfigured` vaut `false` ne doit jamais être
 * appelé : l'interface affiche `configurationHint` à la place.
 */
function buildProviders(): Record<string, AiProvider> {
  const providers: Record<string, AiProvider> = { mock: mockProvider };

  // Construit à la demande : la clé d'API n'existe que côté serveur, et le
  // registre est importé par des modules eux-mêmes serveur uniquement.
  const external = createOpenAiCompatibleProvider();
  if (aiConfig.provider === "openai-compatible") {
    providers["openai-compatible"] = external;
  }

  return providers;
}

export function listProviders(): AiProvider[] {
  return Object.values(buildProviders());
}

/**
 * Fournisseur sélectionné par `AI_PROVIDER`.
 *
 * Si la valeur configurée est inconnue, on retombe explicitement sur `mock`
 * plutôt que d'échouer silencieusement : l'interface signale alors le repli.
 */
export function getProvider(): AiProvider {
  const providers = buildProviders();
  return providers[aiConfig.provider] ?? mockProvider;
}

/**
 * Description transmissible à l'interface.
 *
 * Sans la clé d'API ni l'URL complète : un écran n'a besoin que de savoir si le
 * contenu sort du poste, pas comment joindre le fournisseur.
 */
export function getProviderInfo(): AiProviderInfo & { fallback: boolean } {
  const providers = buildProviders();
  const selected = providers[aiConfig.provider] ?? mockProvider;
  return {
    ...selected.info,
    fallback: !(aiConfig.provider in providers),
  };
}
