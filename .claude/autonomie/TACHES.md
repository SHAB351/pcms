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
| A-01 | Architecture de fournisseur interchangeable | — | changer `AI_PROVIDER` ne touche ni écran, ni action, ni table ; `src/lib/ai/registry.ts` ne dépend que du contrat `AiProvider` | `ÉCRIT` |
| A-02 | Correction et amélioration rédactionnelle | — | deux opérations distinctes, consignes séparées, prompt construit sans invention de fait | `ÉCRIT` |
| A-03 | Reformulation et traduction | — | la traduction exige une langue cible ; Zod refuse l'absence | `ÉCRIT` |
| A-04 | Résumé documentaire | — | un document `text/plain` ou `text/csv` sert de source ; un format non lisible est refusé avec un message explicite | `ÉCRIT` |
| A-05 | Gestion des brouillons | — | liste paginée, recherche, fiche, historique en ajout seul | `ÉCRIT` |
| A-06 | Validation humaine | — | un non-administrateur ne peut pas approuver, **y compris par appel direct à l'API REST** ; toute retouche d'un texte approuvé le fait retomber en brouillon | `BLOQUÉ-HUMAIN` — migration 0003 non appliquée |
| A-07 | Tests et documentation | — | `npm test` vert, README à jour, DECISIONS.md §23 écrit | `PROUVÉ` (40 tests au 2026-11-10) |

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
| T-01 | Garde de cohérence de la limite de source | developpeur | un test échoue si `AI_MAX_SOURCE_CHARS` (Zod) et `MAX_EXTERNAL_SOURCE_CHARS` (confidentialité) divergent | `À FAIRE` |
| T-02 | Tests de la couche `src/lib/data/assistant.ts` | developpeur | `parseDraftListParams` et `buildDraftsQuery` couverts : page invalide, filtre de statut inconnu, recherche avec caractères spéciaux, retour `?…` sans chemin | `À FAIRE` |
| T-03 | Sonde `/api/sante` : état de l'assistant | developpeur | la sonde indique le fournisseur IA actif et s'il est local, **sans jamais** exposer de clé ni d'URL complète ; un test vérifie l'absence de secret dans la réponse | `À FAIRE` |
| T-04 | États vides et messages d'erreur de `/assistant` | developpeur | aucun écran ne montre un message technique nu ; un module sans donnée dit quoi faire | `À FAIRE` |
| T-05 | README : équipe d'agents et session autonome | documentation | la section décrit les cinq agents, les deux skills, et comment lancer/arrêter une session — sans inventer de fonctionnalité | `À FAIRE` |
| T-06 | DECISIONS.md : consigner l'organisation d'agents | documentation | nouvelle section, numéro pris dans le fichier, décrit le choix et ses limites (dont l'absence de travail en arrière-plan non surveillé) | `À FAIRE` |
| T-07 | Audit « aucun secret dans les sorties » | securite | relève chaque `console.log`/`console.error` des scripts et actions ; verdict BLOQUANT/AVERTISSEMENT/RAS avec `chemin:ligne` | `À FAIRE` |

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

Une session autonome de 4 h traite en général 3 à 5 tâches de la file, pas les
sept. Le CTO choisit, il ne coche pas. Il vaut mieux trois tâches prouvées que
sept tâches « faites » sans sortie de commande.
