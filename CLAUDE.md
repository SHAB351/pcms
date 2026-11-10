# PCMS — consignes de travail

Plateforme interne de communication politique. Next.js 16 (App Router, Turbopack),
React 19, Tailwind 4, Supabase, Zod 4, TypeScript strict, **interface en français**.

## À lire avant de toucher au code

1. `DECISIONS.md` — le journal des arbitrages. Une décision écrite ne se renverse
   pas parce qu'elle gêne.
2. `.claude/skills/pcms-conventions/SKILL.md` — structure des couches, lignes
   rouges SQL/RLS, pièges propres à cette machine.
3. `.claude/skills/pcms-verification/SKILL.md` — ce qu'une commande prouve
   réellement, et les quatre pièges qui produisent un faux résultat.

## Lignes rouges

- **Module Documents gelé** : validé et vérifié (29 + 23 contrôles). On n'y touche
  que sur nécessité démontrée, consignée au journal **avant** la modification.
- **Jamais** de politique RLS assouplie pour faire passer un test.
- **Jamais** de secret dans le code, un commentaire, un log, un rapport ou un
  message de commit. `.env.local` ne se lit pas.
- **Jamais** de migration exécutée par un agent : `supabase/migrations/*.sql`
  s'applique à la main dans le SQL Editor.
- **Jamais** de `git push`, de déploiement, de publication.
- Calendrier, Tâches, Rapports **ne sont pas commencés** : on ne les commence pas.

## L'équipe d'agents

Cinq agents dans `.claude/agents/` (`cto`, `developpeur`, `qa`, `securite`,
`documentation`), deux skills projet, deux commandes (`/session-autonome`,
`/etat-session`), et quatre fiches d'autonomie dans `.claude/autonomie/` :
`TACHES.md` (quoi faire), `SESSION.md` (où on en est), `JOURNAL.md` (ce qui a été
fait, en ajout seul), `RAPPORT.md` (le bilan).

## Session autonome

```bash
claude --bg --permission-mode acceptEdits --agent cto "/session-autonome 4"
```

Suivre : `claude agents` puis `claude logs <id>` — reprendre la main : `claude attach <id>`
— arrêter : `claude stop <id>`.

La session tourne dans un processus d'arrière-plan géré par Claude Code : elle
survit à la fermeture du terminal, mais **elle s'arrête net** si elle bute sur une
autorisation qu'elle n'a pas le droit de se donner. Ne compte pas dessus pour
avancer sans surveillance sur une action sensible.
