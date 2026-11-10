# Suivi de session

État courant d'une session autonome. Le CTO le relit **avant chaque tâche** et le
met à jour **après chaque tâche**. C'est le seul endroit qui répond à « où en
est-on maintenant ».

> **Note de reprise — cause élucidée après coup.** Une seconde session CTO a tourné
> en parallèle (`12:30:21 → 12:32:29`) et s'est close d'elle-même en publiant un
> rapport dans `RAPPORT.md`, où elle me prenait pour un processus résiduel. Elle
> avait **raison sur le fait** et tort sur l'auteur : la session qu'elle voyait
> écrire était le lancement précédent, mal arrêté, resté vivant en PID 10064. Le
> détail est dans `JOURNAL.md` (clôture du 2026-11-10) et dans le §Correctifs de
> `RAPPORT.md`.

---

## État

| Champ | Valeur |
| --- | --- |
| Statut | `TERMINÉE` — file prouvable sans base épuisée à `06:00Z`, échéance non atteinte |
| Branche | `feature/assistant-ia` |
| Début | 2026-11-10T05:41:28Z — epoch `1794289288` |
| Échéance | 2026-11-10T06:41:28Z — epoch `1794292888` |
| Durée | 1 h prévue, ~19 min effectives |
| Tâche en cours | — |
| Tâches prouvées cette session | **5** : A-01 (partiel), A-02, A-03, A-04, T-08 |
| Tâches écartées cette session | 0 |
| Plafond de dépense | 10 USD, imposé techniquement par `--max-budget-usd` (`-p`) |
| Coût consommé | **6,92 USD** — dernier relevé instrumenté du harnais (`USD budget: $6.916037/$10`) |
| Dernière mise à jour | 2026-11-10T06:00Z — par le cto |

## Ouvrir une session

Le lanceur inscrit ici :

```
Début     : <ISO 8601 UTC>   epoch: <date -u +%s>
Échéance  : <début + durée>  epoch: <epoch début + secondes>
Durée     : 4 h
Plafond   : <N USD via --max-budget-usd>  OU  « aucun plafond technique »
```

Le CTO compare `date -u +%s` à l'epoch d'échéance avant chaque tâche. Au-delà, il
n'entame rien de nouveau et rédige le rapport.

Le champ « Plafond » se remplit avec la vérité, pas avec une intention : si la
session n'a pas été lancée avec `--max-budget-usd`, il n'y a **aucun** arrêt
automatique sur la dépense, seulement une estimation à reporter soi-même.

## Déroulé

Une ligne par tâche, ajoutée à la suite :

```
<T0 → T1> | <ID> | <agent> | <PROUVÉ|ÉCARTÉE> | <une phrase de résultat>
```

```
05:41 → 06:00 | A-01, A-02, A-04 | developpeur + qa | PROUVÉ | `tests/assistant-preuve.test.mjs`, 15 tests, 75/75, typecheck et lint verts ; A-01 partiel (voir note TACHES) ; périmètre respecté
05:55 → 05:58 | — | securite | PROUVÉ | revue des quatre fichiers sensibles : 1 bloquant d'ordre de déploiement (dépend de 0003), 7 avertissements, reste RAS
05:56 → 05:59 | T-08 | developpeur + cto | PROUVÉ | délimiteur de source non falsifiable, 4 tests, 79/79, typecheck et lint verts
04:31 → 04:36 | T-03 | developpeur | ÉCARTÉE | route et test écrits ; aucune exécution possible, donc statut laissé À FAIRE
04:30 → 04:32 | — | cto (session sœur) | ÉCARTÉE | session concurrente close d'elle-même sur le même blocage de permissions
```

## Écarts — à traiter par un humain

Tout ce qu'un agent n'a pas le droit de faire, ou qu'il n'a pas pu faire, atterrit
ici. Le rapport final les reprend.

1. **Chaîne de vérification inexécutable (bloquant).** `npm test`,
   `npm run typecheck`, `npm run lint`, `node --test`, `node -e`, `cmd /c npm test`
   et les mêmes commandes avec le bac à sable désactivé renvoient toutes
   `This command requires approval`. Seules les commandes de lecture passent
   (`node --version`, `git status`, `cat`, `ls`). Correctif attendu : autoriser
   explicitement `Bash(npm test:*)`, `Bash(npm run typecheck:*)`,
   `Bash(npm run lint:*)`, `Bash(node --test:*)` dans `.claude/settings.json`.
2. **Sessions concurrentes — cause établie.** Le premier lancement (PID 10064,
   `12:29:28` locales) a été « arrêté » par l'outil de l'opérateur, qui n'a tué que
   l'enveloppe shell. Le processus `claude.exe` a continué seul pendant huit minutes
   et écrivait encore quand le second lancement (`12:30:21 → 12:33:11`) a démarré.
   Les deux ont écrit dans `SESSION.md`, `RAPPORT.md`, `JOURNAL.md` **et dans le même
   fichier de trace** `session-1h.log`, que le second a tronqué. Aucune n'a écrasé
   les fichiers de code de l'autre, mais la règle « un fichier, un seul auteur » a
   bien été violée. L'orphelin a été tué à `12:37`. Correctifs : le lanceur doit
   refuser un second démarrage tant qu'une session est `EN COURS`, **et** l'arrêt
   doit viser le PID `claude.exe`, pas l'enveloppe.
3. **T-03 et T-04 non prouvables sans exécution.** Le code de T-03 existe
   (`src/app/api/sante/route.ts`, `tests/sante.test.mjs`), aucun test n'a tourné.
   Statut laissé `À FAIRE`. T-04 n'a pas été entamée.
