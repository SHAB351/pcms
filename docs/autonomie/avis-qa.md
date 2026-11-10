# Avis du QA — contrôle indépendant de `tests/assistant-preuve.test.mjs`

Date : 2026-11-10. Branche : `feature/assistant-ia`. Contrôle demandé par le CTO.
Aucun fichier de code n'a été modifié par ce contrôle.

## Chaîne exécutée (réelle)

- `npm run typecheck` -> aucune sortie de diagnostic, exécution réussie.
- `npm run lint` -> aucune sortie de diagnostic, exécution réussie.
- `npm test` -> `tests 75 / pass 75 / fail 0 / cancelled 0 / skipped 0 / todo 0`,
  durée `3760.9351 ms`. Les 15 tests de `tests/assistant-preuve.test.mjs` sont
  nommés un par un dans la sortie (A-01 x3, A-02 x4, A-04 x8).

## Verdicts

- **A-01 : PARTIEL.** Les trois tests sont statiques. Ils prouvent que
  `src/lib/ai/registry.ts` a exactement quatre importations, que le contrat
  `@/lib/ai/types` est importé en `import type` avec `AiProvider` et
  `AiProviderInfo` seulement, et qu'aucun `.ts`/`.tsx` de `src/app/` ou
  `src/lib/actions/` (22 fichiers) n'importe `lib/ai/providers/…`. Ils ne
  prouvent pas le comportement de `getProvider()` quand `AI_PROVIDER` change, ni
  quoi que ce soit sur les tables. L'analyseur ne voit ni `export … from`, ni
  `import()` dynamique, ni `require()`.
- **A-02 : CONFIRMÉ au niveau 1.** `buildPrompt` est exécuté pour les six
  opérations (fichier réel, sans dépendance à simuler). Les six premières lignes
  de consigne sont deux à deux distinctes ; correction et amélioration ne
  partagent aucune phrase ; le prompt système contient « n'inventes jamais un
  fait » et « [à compléter] » pour les six ; le texte et le brief fournis sont
  présents et le texte est déclaré « seule source autorisée ».
- **A-04 : CONFIRMÉ au niveau 1, avec Supabase simulé.** `readDocumentSource`
  (fichier réel) est exécuté avec un faux client : UUID invalide refusé avant
  création du client, document absent ou en erreur refusé, PDF refusé avec un
  message nommant PDF/Word et sans téléchargement, `text/plain` et `text/csv`
  restitués, échec de téléchargement signalé. ne prouve ni RLS, ni Storage réel,
  ni migration 0003.

## Mutations

Les trois mutations sont en mémoire, sur des chaînes lues du disque, sans
écriture : le fichier ne contient aucune écriture (`writeFile`, `appendFile`,
`createWriteStream` : aucune occurrence).

1. A-01 « le garde-fou détecte réellement… » : ajoute un import à la **copie en
   mémoire** d'une vraie page. C'est un contrôle positif de l'analyseur, pas une
   mutation du source de production.
2. A-02 « la garde tombe… » : remplace la consigne réelle de l'amélioration par
   celle de la correction, et vérifie que le compte distinct passe de 6 à 5.
   Mutation réelle du source, en mémoire.
3. A-04 « le refus du PDF échouerait… » : remplace la ligne réelle de contrôle
   MIME par `if (false)` et vérifie que le PDF passe en `ok: true`. Mutation
   réelle du source, en mémoire.

## Périmètre

Depuis le début de session (`2026-11-10 13:41:28 +0800`), seuls trois fichiers
ont été écrits : `docs/autonomie/SESSION.md` (CTO), `tests/assistant-preuve.test.mjs`
et `docs/autonomie/avis-developpeur.md` (développeur). `tests/assistant.test.mjs`
a un mtime de `11:56:40`, antérieur à la session ; son diff ajoute un test, il
n'en retire ni n'en assouplit aucun. **Périmètre respecté.**

## Réserves

- `npm run verify:assistant` n'a pas été lancé : migration 0003 non appliquée,
  donc rien du comportement en base n'est prouvé.
- Aucune exécution navigateur : le chemin de clic réel n'est pas prouvé.
