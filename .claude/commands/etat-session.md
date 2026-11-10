---
description: Affiche l'état de la session autonome PCMS — échéance, tâche en cours, dernières actions — sans rien modifier
---

Rends un état de la session, **en lecture seule**. Ne modifie aucun fichier, ne
lance aucune tâche.

Rassemble d'abord :

```bash
date -u +%FT%TZ && date -u +%s
git branch --show-current && git status --short && git log --oneline -3
```

Puis lis `.claude/autonomie/SESSION.md`, les cinq dernières lignes de
`.claude/autonomie/JOURNAL.md`, et le tableau de `TACHES.md`.

Réponds en six lignes maximum :

1. **Session** : en cours / terminée / aucune, et depuis quand.
2. **Échéance** : heure locale, et s'il reste plus ou moins de 30 minutes.
3. **Tâche en cours** : ID et agent, ou aucune.
4. **Compteur** : prouvées / écartées cette session.
5. **Prochaine tâche** que le CTO prendrait, et pourquoi celle-là.
6. **Écarts** en attente d'un humain — s'il n'y en a pas, écris « aucun ».

Si l'échéance est dépassée et que la session est encore marquée `EN COURS`,
signale-le en premier : c'est le seul cas qui demande une action immédiate.
