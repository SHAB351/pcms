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
`/etat-session`), et quatre fiches d'autonomie dans `docs/autonomie/` :
`TACHES.md` (quoi faire), `SESSION.md` (où on en est), `JOURNAL.md` (ce qui a été
fait, en ajout seul), `RAPPORT.md` (le bilan).

**Pourquoi `docs/` et pas `.claude/`** : l'outil traite `.claude/` comme de la
configuration et **refuse toute écriture d'agent** dans ce dossier (« sensitive
file »). Les fiches y étaient, et l'essai du 2026-11-10 a montré la conséquence :
code livré, mais état, journal et rapport impossibles à écrire. Ne les remets
jamais sous `.claude/`.

## Session autonome

```bash
claude -p --agent cto --model sonnet --permission-mode acceptEdits \
  --max-budget-usd 10 \
  --allowedTools "Read,Grep,Glob,Edit,Write,Bash(npm test:*),Bash(npm run typecheck:*),Bash(npm run lint:*),Bash(node --test:*)" \
  --output-format text \
  > docs/autonomie/session.log 2>&1 <<< "SESSION AUTONOME D'UNE HEURE..."
```

**`--allowedTools` n'est pas optionnel.** Sans lui, en mode `-p`, **toute**
commande `Bash` passe par une autorisation que personne n'accorde : la session
reçoit `This command requires approval` à chaque vérification et ne peut rien
prouver. C'est la cause exacte de l'échec de la session du 2026-11-10. Une seule
occurrence de l'option, liste séparée par des virgules : elle est *variadique* et
avale aussi le prompt positionnel, d'où le here-string (`<<<`) ci-dessus.
Syntaxe vérifiée le 2026-11-10 : `Bash(npm run lint:*)` a bien laissé passer
`npm run lint` (`> eslint .`), et `Bash(node --version:*)` a laissé passer
`node --version` (`v24.18.0`).

`-p` (impression) est la seule forme qui **impose** un plafond de dépense :
`--max-budget-usd` n'agit qu'avec `--print`. Avec `claude --bg`, il n'y a **aucun
plafond technique** — seulement l'échéance de temps écrite dans `SESSION.md`. Le
plafond s'applique **par processus** : deux lancements simultanés valent deux
fois le plafond.

**`--model sonnet` est obligatoire.** Le champ `model:` du frontmatter d'un agent
ne s'applique **pas** quand cet agent sert de session (`--agent cto`) : une
session lancée sans `--model` hérite du modèle par défaut de la machine
(`deepseek-flash` ici, que Claude Code ne reconnaît pas et dont il suppose la
fenêtre de contexte). Constaté deux fois le 2026-11-10.

**Mais `sonnet` n'est pas Sonnet sur ce poste.** `~/.claude/settings.json` route
l'API vers un service compatible (`ANTHROPIC_BASE_URL`,
`ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-flash`) : l'alias résout vers
`deepseek-flash`. `--model sonnet` sert donc à éviter un défaut non maîtrisé, pas
à obtenir Sonnet. Ne jamais présenter cette machine comme travaillant sur Sonnet.

`--bg` exige en plus que le dossier soit approuvé (confiance), ce que `-p` ne
demande pas. En contrepartie, `-p` n'a pas de `claude attach` : on arrête la
session en tuant le processus.

**Arrêter veut dire tuer `claude.exe`, pas l'enveloppe shell.** Le 2026-11-10, un
arrêt « réussi » n'a tué que le wrapper : le processus a continué huit minutes et
a écrit dans le dépôt pendant qu'un second lancement y travaillait. Vérifier
après tout arrêt :

```powershell
claude agents --json            # doit ne plus lister de session dans Dev\pcms
Get-Process claude -ErrorAction SilentlyContinue | Stop-Process -Force
```

La session travaille sur le dépôt et **s'arrête net** sur une autorisation qu'elle
n'a pas le droit de se donner : ne compte pas dessus pour avancer sans
surveillance sur une action sensible.
