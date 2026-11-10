# Tâches — PCMS

Liste de travail de l'équipe d'agents. Le CTO choisit **une** tâche à la fois,
toujours dans l'ordre : d'abord les `À FAIRE`, jamais une `BLOQUÉ-HUMAIN`.

## Vocabulaire des statuts

| Statut | Sens exact |
| --- | --- |
| `PROUVÉ` | une commande l'a montré, et sa sortie est citée au JOURNAL |
| `ÉCRIT` | le code existe et compile, mais aucun comportement n'a été exercé |
| `À FAIRE` | rien n'existe encore |
| `EN COURS` | un agent y travaille en ce moment |
| `BLOQUÉ-HUMAIN` | attend une action qu'un agent n'a pas le droit de faire |

Un statut ne monte jamais `ÉCRIT` → `PROUVÉ` sans une ligne de journal qui
contient la commande et son résultat.

---

## Mission 3 — Assistant IA (état au 2026-11-10)

| ID | Tâche | Agent | Critère d'acceptation | Statut |
| --- | --- | --- | --- | --- |
| A-01 | Architecture de fournisseur interchangeable | developpeur | changer `AI_PROVIDER` ne touche ni écran, ni action, ni table ; `src/lib/ai/registry.ts` ne dépend que du contrat `AiProvider` | `PROUVÉ` (partiel — voir note) — session du 2026-11-10 : `tests/assistant-preuve.test.mjs`, 3 tests, `npm test` -> **75/75** ; le contrat n'est importé qu'en `import type`, aucun écran/action n'importe `@/lib/ai/providers/*` ; mutation en mémoire d'une page -> détectée |
| A-02 | Correction et amélioration rédactionnelle | developpeur | deux opérations distinctes, consignes séparées, prompt construit sans invention de fait | `PROUVÉ` — session du 2026-11-10 : 4 tests, `npm test` -> 75/75 ; six consignes deux à deux distinctes ; retirer la distinction correction/amélioration fait tomber le test (mutation en mémoire) |
| A-03 | Reformulation et traduction | developpeur | la traduction exige une langue cible ; Zod refuse l'absence | `PROUVÉ` — session du 2026-11-10 : `npm test` -> `✔ une traduction sans langue cible est refusée` (75/75) |
| A-04 | Résumé documentaire | developpeur | un document `text/plain` ou `text/csv` sert de source ; un format non lisible est refusé avec un message explicite | `PROUVÉ` — session du 2026-11-10 : 8 tests sur `readDocumentSource` (client Supabase simulé), `npm test` -> 75/75 ; PDF refusé avec message explicitant le format, `text/plain` et `text/csv` lus ; retirer la vérification MIME fait passer le PDF (mutation en mémoire) |
| A-05 | Gestion des brouillons | — | liste paginée, recherche, fiche, historique en ajout seul | `ÉCRIT` partiel — pagination et recherche prouvées par T-02 ; **fiche et historique en ajout seul exigent la migration 0003**, donc non prouvables |
| A-06 | Validation humaine | — | un non-administrateur ne peut pas approuver, **y compris par appel direct à l'API REST** ; toute retouche d'un texte approuvé le fait retomber en brouillon | `BLOQUÉ-HUMAIN` — migration 0003 non appliquée |
| A-07 | Tests et documentation | — | `npm test` vert, README à jour, DECISIONS.md §23 écrit | `PROUVÉ` (79 tests au 2026-11-10) |

### Note A-01 — le critère était mal écrit (constat QA du 2026-11-10)

Le critère « `src/lib/ai/registry.ts` ne dépend que du contrat `AiProvider` » est
**littéralement faux par construction** : le registre doit importer les
fournisseurs concrets pour les enregistrer. Il se lit en réalité : « le registre
est le seul à connaître les fournisseurs concrets ». Ce qui est mesuré et prouvé
est la seconde formulation — contrat importé uniquement en `import type`
(`AiProvider`, `AiProviderInfo`), et **aucun** fichier de `src/app/` ni de
`src/lib/actions/` n'importe `@/lib/ai/providers/*`. Ce qui **n'est pas** couvert
par cette preuve : « ni table » (aucune requête exercée), et le comportement réel
de basculement (`getProvider()` n'est pas appelé par le test).

### A-06 — ce qui bloque exactement

La migration `supabase/migrations/0003_assistant_ia.sql` n'a pas été exécutée.
Elle contient les colonnes de l'assistant, la table `ai_draft_revisions`, les
déclencheurs `ai_drafts_guard_review` et `ai_drafts_reset_on_content_change`, et
la politique de lecture seule de l'historique.

**Action humaine, une seule fois :** Supabase → SQL Editor → New query → coller
tout le fichier → exécuter. Ensuite `npm run verify:assistant` doit passer du
code de sortie 2 au code 0.

Tant que ce n'est pas fait, **aucun agent ne peut prouver A-06**, et aucun ne doit
l'écrire comme fonctionnel.

---

## File d'attente — travail faisable sans base de données

Ces tâches se prouvent avec `typecheck`, `lint` et `npm test` seulement.

| ID | Tâche | Agent | Critère d'acceptation | Statut |
| --- | --- | --- | --- | --- |
| T-01 | Garde de cohérence de la limite de source | developpeur | un test échoue si `AI_MAX_SOURCE_CHARS` (Zod) et `MAX_EXTERNAL_SOURCE_CHARS` (confidentialité) divergent | `PROUVÉ` — essai du 2026-11-10, mutation à `59_999` → 1 échec nommé, restauration → 48/48 |
| T-02 | Tests de la couche `src/lib/data/assistant.ts` | developpeur | `parseDraftListParams` et `buildDraftsQuery` couverts : page invalide, filtre de statut inconnu, recherche avec caractères spéciaux, retour `?…` sans chemin | `PROUVÉ` — essai du 2026-11-10, `tests/assistant-data.test.mjs`, 7 tests, 48/48 |
| T-03 | Sonde `/api/sante` : état de l'assistant | developpeur | la sonde indique le fournisseur IA actif et s'il est local, **sans jamais** exposer de clé ni d'URL complète ; un test vérifie l'absence de secret dans la réponse | `PROUVÉ` — code livré en séance, vérifié par l'opérateur hors séance : `npm test` -> 51/51, `typecheck` et `lint` sans diagnostic (RAPPORT.md §Correctifs, 04:36Z) |
| T-04 | États vides et messages d'erreur de `/assistant` | developpeur | un test lit `src/app/(app)/assistant/page.tsx`, `src/app/(app)/assistant/[id]/page.tsx` et `src/components/assistant/*.tsx`, et **échoue** si un libellé visible contient `Error:`, `undefined`, `null`, `NaN`, `[object Object]` ou `TypeError` ; il vérifie aussi que les deux pages déclarent un état vide et un état d'erreur non vides | `PROUVÉ` — opérateur, hors session (2026-11-10) : `tests/assistant-ui.test.mjs`, 9 tests, `npm test` -> **60/60** ; **4 mutations** (libellé « Titre undefined », état vide sans `description`, historique vide sans texte, erreur de lecture sans consigne) font chacune échouer le test nommé, puis restauration -> vert |
| T-05 | README : équipe d'agents et session autonome | documentation | la section décrit les cinq agents, les deux skills, et comment lancer/arrêter une session — sans inventer de fonctionnalité | `PROUVÉ` — session du 2026-11-10, section « Équipe d'agents et travail autonome » (l. 197-277), `git diff --stat README.md` -> 84 insertions, aucun autre fichier |
| T-06 | DECISIONS.md : consigner l'organisation d'agents | documentation | nouvelle section, numéro pris dans le fichier, décrit le choix et ses limites (dont l'absence de travail en arrière-plan non surveillé) | `PROUVÉ` — opérateur, hors session (2026-11-10) : `DECISIONS.md` §24 « Équipe d'agents et travail autonome », dix décisions structurantes, règles de concurrence, limites opérationnelles, ce qui a échoué ; §23 reste intact |
| T-07 | Audit « aucun secret dans les sorties » | securite | **chaque** `console.*` de `src/` et `scripts/` (aujourd'hui 64 lignes) est listé avec un verdict BLOQUANT/AVERTISSEMENT/RAS et `chemin:ligne` ; le compte annoncé égale la sortie de `grep -rn "console\." src/ scripts/ \| wc -l` | `PROUVÉ` — opérateur, hors session (2026-11-10) : `docs/securite/audit-console-2026-11-10.md`, **64 lignes classées** (0 BLOQUANT, 5 AVERTISSEMENT, 59 RAS) ; `grep -rn "console\." src/ scripts/ \| wc -l` -> `64`, et le tableau compte 64 lignes |
| T-08 | Délimiteur de source non falsifiable | developpeur | un document dont le texte contient `"""` ne peut pas refermer le bloc « seule source autorisée » et faire lire la suite comme une instruction ; un test échoue si le délimiteur est fixe | `PROUVÉ` — session du 2026-11-10 : `sourceFence()` dans `src/lib/ai/operations.ts`, 4 tests, `npm test` -> **79/79** ; le délimiteur dépasse toute suite de guillemets du texte ; mutation en mémoire (délimiteur fixe) -> 3 bornes au lieu de 2, test rouge |
| T-09 | `external_sent` adossé à la décision, pas au fournisseur | developpeur | la valeur enregistrée dans `ai_drafts.external_sent` est celle de `decideSend()`, ou une divergence est refusée ; un test le vérifie | `À FAIRE` — avertissement de la revue sécurité du 2026-11-10 (`src/lib/actions/assistant.ts:161`) |

## Bloqué par une action humaine

| ID | Tâche | Qui | Statut |
| --- | --- | --- | --- |
| H-01 | Appliquer `0003_assistant_ia.sql` dans le SQL Editor | Enock | `BLOQUÉ-HUMAIN` |
| H-02 | Créer les comptes `editor` et `reader` (décision reportée) | Enock | `BLOQUÉ-HUMAIN` |
| H-03 | Désactiver les inscriptions publiques dans Supabase Auth | Enock | `BLOQUÉ-HUMAIN` |

## Hors périmètre — ne pas commencer

Calendrier, Tâches, Rapports. `README.md` les annonce comme à venir ; une page
qui les imiterait serait un mensonge.

---

## Note de session

La session du 2026-11-10 est **bornée à 1 heure** (décision d'Enock), plafonnée à
**10 USD** par `--max-budget-usd`, en mode `-p` — le seul mode où le plafond est
réellement imposé par le CLI.

Une heure traite en général **3 à 5 tâches** de la file, pas les sept. Le CTO
choisit, il ne coche pas. Il vaut mieux trois tâches prouvées que sept tâches
« faites » sans sortie de commande. Si la file est épuisée avant l'heure, la
session se **clôt** : on n'invente pas de travail pour remplir le temps.
