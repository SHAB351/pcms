---
description: Démarre une session de travail autonome bornée dans le temps sur PCMS (4 h par défaut)
argument-hint: "[durée en heures, ex. 4]"
---

Démarre une session de travail autonome sur PCMS.

Durée demandée : **$ARGUMENTS** heures (si vide : 4).

Tu tiens le rôle du **CTO** (`.claude/agents/cto.md`). Applique-le à la lettre.

## 1. Ouvrir la session

```bash
date -u +%FT%TZ && date -u +%s && git branch --show-current && git log --oneline -1
```

Écris dans `docs/autonomie/SESSION.md` : début, échéance (epoch début +
durée × 3600), branche, statut `EN COURS`. Une ligne dans
`docs/autonomie/JOURNAL.md` aussi.

Vérifie que la branche est bien `feature/assistant-ia`. Si tu es sur `main`,
**arrête-toi** : tu ne travailles pas sur la branche principale.

## 2. Boucler

Répète jusqu'à l'échéance ou jusqu'à épuisement des tâches `À FAIRE` :

1. `date -u +%s` — si l'échéance est dépassée, sors de la boucle **sans entamer
   de nouvelle tâche**.
2. Prends la première tâche `À FAIRE` de `docs/autonomie/TACHES.md`. Jamais
   une `BLOQUÉ-HUMAIN`.
3. Marque-la `EN COURS` dans `SESSION.md`.
4. Délègue à l'agent indiqué, avec l'ID, le critère d'acceptation recopié et les
   fichiers concernés.
5. Exige la preuve (commande + sortie). Pas de preuve = pas `PROUVÉ`.
6. Fais relire par `qa` toute tâche qui touche du comportement, et par `securite`
   toute tâche qui touche auth, RLS, stockage, IA ou secrets.
7. Mets à jour la ligne de `TACHES.md`, la ligne du déroulé dans `SESSION.md`, et
   ajoute une ligne à `JOURNAL.md`.

## 3. Fermer

Remplis `docs/autonomie/RAPPORT.md` en entier. Passe `docs/autonomie/SESSION.md`
en `TERMINÉE`. Réponds en français, en séparant **prouvé**, **écrit non exercé**,
**bloqué**.

## Interdits

Pas de `git push`, pas de migration exécutée, pas de déploiement, pas de secret
affiché, pas de modification du module Documents, pas de politique RLS touchée.
Ne prolonge pas la session de toi-même.

## Budget

Inscris dans `docs/autonomie/SESSION.md` le plafond dont tu disposes **tel qu'il
est**, pas tel que tu l'espères :

- si la session a été lancée avec `--max-budget-usd`, écris « plafond technique
  N USD » — le CLI coupe ;
- sinon, écris « aucun plafond technique — estimation seulement » et reporte le
  coût annoncé après chaque tâche.

Après chaque tâche, compare le coût consommé au coût moyen observé par tâche. Si
le reste du budget ne couvre pas une tâche de plus, clos la session et écris le
rapport.
