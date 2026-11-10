# Journal des actions

**Ajout seul. Une ligne ne se réécrit jamais, ne s'efface jamais.** Une erreur se
consigne : c'est précisément ce qui évite de la refaire.

Format d'une ligne :

```
- <AAAA-MM-JJTHH:MMZ> | <agent> | <ID tâche> | <action> | preuve: <commande> -> <résultat>
```

Un agent qui n'a pas de preuve écrit `preuve: aucune`.

---

- 2026-11-10T04:10Z | cto | — | `git init` sur le dépôt, identité locale `enock@pcms.local`, commit de référence `2ac12a7`, branche de travail `feature/assistant-ia` créée | preuve: `git log --oneline -1` -> `2ac12a7 socle : état du projet avant le travail autonome`
- 2026-11-10T04:10Z | cto | — | `.gitignore` complété (`/.next-server.log`, `.claude/settings.local.json`, `/scratchpad/`) ; 93 fichiers indexés, aucun `.env` réel | preuve: `git diff --cached --name-only | grep -E '\.env'` -> aucun
- 2026-11-10T04:20Z | cto | — | création de l'équipe : 5 agents (cto, developpeur, qa, securite, documentation), 2 skills (pcms-conventions, pcms-verification), fiches d'autonomie | preuve: aucune (création de fichiers)
- 2026-11-10T04:20Z | cto | — | `.claude/settings.json` écrit **en refus seulement** : le classifieur a rejeté une liste d'autorisations (`git commit`, `git checkout`…) non demandée explicitement par Enock. Décision : la configuration n'ouvre rien, elle ferme (`Read(.env)`, `git push`, `vercel`, `supabase db push`) | preuve: aucune
- 2026-11-10T04:20Z | qa | A-06 | constat : la migration `0003_assistant_ia.sql` n'est pas appliquée, donc **rien** du comportement en base de l'assistant n'est prouvé | preuve: `npm run verify:assistant` -> code 2, « MIGRATION MANQUANTE … column ai_drafts.operation does not exist »
