# PCMS — Political Communication Management System

Plateforme interne de gestion du service de communication d'un mouvement
politique : documents, brouillons assistés par IA, calendrier éditorial, tâches
et rapports d'activité.

> **Périmètre V1** — un seul administrateur l'utilise aujourd'hui, mais
> l'architecture est prévue pour plusieurs utilisateurs et plusieurs rôles
> (`admin`, `editor`, `reader`) dès le départ : RLS Supabase, autorisations
> côté serveur, journal d'activité.

---

## État d'avancement

| Module | Schéma & RLS | Interface |
| --- | --- | --- |
| Authentification | ✅ | ✅ |
| Tableau de bord | ✅ | ✅ |
| Documents | ✅ | ✅ (parcours admin vérifié sur Supabase réel et dans un vrai navigateur) |
| Assistant IA | ✅ | ✅ (première version : six opérations, brouillons, validation humaine) |
| Calendrier éditorial | ✅ | ⏳ à venir |
| Tâches | ✅ | ⏳ à venir |
| Rapports d'activité | ✅ | ⏳ à venir |

Les pages des modules non commencés annoncent explicitement leur état : elles
n'imitent pas une fonctionnalité absente.

---

## Pile technique

| Élément | Version | Rôle |
| --- | --- | --- |
| Next.js | 16.4.5 (App Router, Turbopack) | Application, rendu serveur, Server Actions |
| React | 19 | Interface |
| TypeScript | 5 | Typage strict |
| Tailwind CSS | 4 | Mise en forme, via `@tailwindcss/turbopack` |
| Supabase | `@supabase/ssr` 0.x, `supabase-js` 2.x | PostgreSQL, authentification, stockage |
| Zod | 4 | Validation de tous les formulaires |
| lucide-react | — | Icônes |

---

## Prérequis

- **Node.js ≥ 20.9** (testé avec Node 24.18)
- **npm** (le projet est verrouillé sur `package-lock.json`)
- Un projet **Supabase** (offre gratuite suffisante)

Sur ce poste, npm pointe vers le miroir `registry.npmmirror.com`
(`~/.npmrc`) ; cela n'a aucun effet sur le code du projet.

---

## Installation

```bash
cd "C:\Users\Enock SHABANI\Dev\pcms"
npm install
Copy-Item .env.example .env.local     # PowerShell
```

Renseignez ensuite `.env.local` (voir ci-dessous), puis :

```bash
npm run dev          # http://localhost:3000
```

---

## Variables d'environnement

| Variable | Obligatoire | Portée | Contenu |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **oui** | navigateur + serveur | URL du projet, `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **oui** | navigateur + serveur | Clé publique « anon » / « publishable » |
| `SUPABASE_SERVICE_ROLE_KEY` | non | **serveur uniquement** | Réservée aux scripts d'administration. Aucun code de l'application ne la lit aujourd'hui. |
| `AI_PROVIDER` | non (`mock`) | serveur | Fournisseur enregistré dans `src/lib/ai/registry.ts` |
| `AI_API_KEY` | non | **serveur uniquement** | Clé du fournisseur d'IA |
| `AI_MODEL` | non | serveur | Identifiant du modèle |

Où les trouver : **Supabase Dashboard → Project Settings → API**.

> ⚠️ Tout ce qui commence par `NEXT_PUBLIC_` est **visible dans le navigateur**.
> Aucune clé secrète ne doit porter ce préfixe.

---

## Base de données

Trois migrations SQL, à exécuter **dans cet ordre** :

1. `supabase/migrations/0001_initial_schema.sql`
   — enums, tables, déclencheurs, fonctions d'autorisation, politiques RLS.
2. `supabase/migrations/0002_documents_storage.sql`
   — bucket privé `documents`, limites de taille et de type, politiques Storage.
3. `supabase/migrations/0003_assistant_ia.sql`
   — colonnes de l'assistant sur `ai_drafts`, historique en ajout seul
   `ai_draft_revisions`, garde-fous de validation humaine.

**Méthode sans CLI** (recommandée sur ce poste, la CLI Supabase n'est pas installée) :

1. Supabase Dashboard → **SQL Editor** → *New query*.
2. Coller le contenu du fichier `0001`, exécuter, vérifier l'absence d'erreur.
3. Répéter avec `0002`, puis avec `0003`.

**Méthode CLI** (si vous l'installez plus tard) :

```bash
supabase link --project-ref <ref>
supabase db push
```

### Créer le premier administrateur

L'inscription libre est **désactivée** : c'est un outil interne.

1. Supabase Dashboard → **Authentication → Users → Add user** : saisir l'e-mail
   et le mot de passe, cocher « Auto-confirm ».
2. Le déclencheur `on_auth_user_created` crée la ligne correspondante dans
   `public.profiles` avec le rôle `reader`.
3. Élever le compte en administrateur, dans le **SQL Editor** :

```sql
update public.profiles
   set role = 'admin'
 where email = 'vous@exemple.fr';
```

4. Se connecter sur `/connexion`.

> La promotion par SQL Editor est possible car aucune session utilisateur n'y est
> ouverte (`auth.uid()` vaut `null`). Depuis l'application, seul un
> administrateur peut modifier un rôle — le déclencheur
> `prevent_role_escalation` bloque toute auto-promotion.

---

## Commandes

```bash
npm run dev      # développement, http://localhost:3000
npm run build    # build de production (Turbopack)
npm run start    # serveur de production
npm run lint     # ESLint (Next 16 n'a plus de commande « next lint »)
npx tsc --noEmit # vérification des types seule
```

> Next.js 16 utilise **Turbopack** en développement comme en production. `next dev`
> écrit dans `.next/dev`, `next build` dans `.next` : les deux peuvent tourner en
> parallèle. Si `next dev` renvoie des 404 sur des routes imbriquées après un
> build, supprimez `.next` avant de relancer.

---

## Structure du projet

```
src/
├── app/
│   ├── layout.tsx                 # racine : <html lang="fr">, rendu dynamique
│   ├── page.tsx                   # « / » → tableau de bord
│   ├── globals.css                # Tailwind + réglages de base
│   ├── error.tsx / not-found.tsx
│   ├── (auth)/connexion/          # page de connexion + formulaire
│   ├── (app)/                     # toutes les zones privées
│   │   ├── layout.tsx             # coquille + garde de session
│   │   ├── tableau-de-bord/
│   │   ├── documents/             # modules : schéma prêt, UI à venir
│   │   ├── assistant/
│   │   ├── calendrier/
│   │   ├── taches/
│   │   ├── rapports/
│   │   └── parametres/            # compte + état de la configuration
│   └── api/sante/route.ts         # sonde de supervision (JSON, sans secret)
├── components/
│   ├── layout/                    # coquille, navigation, écrans d'état
│   └── ui/                        # bouton, carte, formulaire, badge, alerte…
├── lib/
│   ├── actions/                   # Server Actions ('use server')
│   ├── ai/                        # interface fournisseur + registre + « mock »
│   ├── auth/                      # routes, session, rôles
│   ├── data/                      # lectures agrégées (tableau de bord)
│   ├── supabase/                  # clients navigateur / serveur / proxy
│   ├── validation/                # schémas Zod
│   ├── config.ts                  # lecture des variables d'environnement
│   ├── format.ts                  # dates et libellés en français
│   └── utils.ts                   # cn()
├── proxy.ts                       # ex-« middleware » de Next 16 : session + garde
└── types/database.ts              # types de la base (à régénérer si le schéma change)
supabase/migrations/               # SQL versionné
```

---

## Équipe d'agents et travail autonome

Le dépôt définit une petite équipe d'agents (`.claude/agents/`), deux skills
projet (`.claude/skills/`) et deux commandes (`.claude/commands/`). Les fiches
d'état et de suivi vivent dans `docs/autonomie/`.

### Les cinq agents

| Agent | Rôle |
| --- | --- |
| `cto` | Directeur technique et orchestrateur : choisit **une** tâche dans `TACHES.md`, la délègue au bon agent, exige une preuve (commande et sortie), tient le journal, met à jour l'état et arrête la session à l'échéance. Il ne code pas les tâches de fond, sauf une retouche de moins d'une trentaine de lignes sur un seul fichier. |
| `developpeur` | Implémente une tâche bornée (code, migration SQL écrite mais non exécutée, test), lance `typecheck`, `lint` et les tests, et rend le diff significatif avec les sorties de commandes. Il ne conçoit pas l'architecture et ne décide pas du produit. |
| `qa` | Contrôleur qualité indépendant : exécute la chaîne de vérification, cherche à faire échouer le travail, et rend un constat par affirmation (`CONFIRMÉ`, `PARTIEL`, `NON PROUVÉ`, `RÉFUTÉ`, `BLOQUANT`). Il ne corrige rien et n'écrit aucun fichier. |
| `securite` | Relecture de sécurité d'un diff ou d'un fichier sensible : authentification, rôles, politiques RLS, stockage, confidentialité de l'assistant IA, secrets. Verdict `BLOQUANT` / `AVERTISSEMENT` / `RAS`, ancré sur `chemin:ligne`. Il ne modifie rien. |
| `documentation` | Tient `README.md` et `DECISIONS.md` (et `CLAUDE.md` quand l'organisation de l'équipe change), dans le style de la maison : ce qui est vérifié, ce qui est écrit mais non exercé, ce qui est bloqué. Il n'invente ni résultat ni mesure. |

### Les deux skills

| Skill | Ce qu'il couvre |
| --- | --- |
| `pcms-conventions` | Les règles de maison : structure des couches (où lire, où écrire), discipline SQL/RLS, interdiction des secrets, module Documents gelé, et les pièges propres à cette machine (Smart App Control, Tailwind épinglé, Server Actions non reproductibles depuis Node). |
| `pcms-verification` | Ce que chaque commande prouve réellement et ce qu'elle ne prouve pas, aux trois niveaux (logique pure, données réelles, navigateur), avec les prérequis, les codes de sortie de `verify:assistant` et les quatre pièges qui produisent un faux résultat. |

### Les deux commandes

| Commande | Effet |
| --- | --- |
| `/session-autonome [heures]` | Démarre une session bornée dans le temps (4 h par défaut) : ouvre `SESSION.md`, refuse de travailler sur `main` (la branche attendue est `feature/assistant-ia`), boucle tâche par tâche avec preuve, puis remplit `RAPPORT.md`. |
| `/etat-session` | Affiche l'état de la session **en lecture seule** : échéance, tâche en cours, compteur de tâches prouvées et écartées, prochaine tâche, écarts en attente d'un humain. Ne modifie aucun fichier. |

### Les quatre fiches de `docs/autonomie/`

| Fiche | Fonction |
| --- | --- |
| `TACHES.md` | **Quoi faire** : la file des tâches, avec leur agent, leur critère d'acceptation et leur statut (`PROUVÉ`, `ÉCRIT`, `À FAIRE`, `EN COURS`, `BLOQUÉ-HUMAIN`). |
| `SESSION.md` | **Où on en est** : début, échéance (epoch), branche, tâche en cours, budget consommé, déroulé et écarts. |
| `JOURNAL.md` | **Ce qui a été fait**, en ajout seul : une ligne par action, avec la commande et son résultat quand il y en a un. Une ligne ne se réécrit jamais, ne s'efface jamais. |
| `RAPPORT.md` | **Le bilan** de fin de session : ce qui est prouvé, ce qui est écrit mais non exercé, ce qui n'a pas été fait et pourquoi. |

Ces fiches sont sous `docs/` et **pas** sous `.claude/` : l'outil traite
`.claude/` comme de la configuration et refuse toute écriture d'agent dans ce
dossier (« sensitive file »). L'essai du 2026-11-10 l'a montré : le code était
livré, mais l'état, le journal et le rapport étaient impossibles à écrire.

### Lancer une session autonome

```bash
claude -p --agent cto --model sonnet --permission-mode acceptEdits \
  --max-budget-usd <N> \
  --allowedTools "Read,Grep,Glob,Edit,Write,Bash(npm test:*),Bash(npm run typecheck:*),Bash(npm run lint:*),Bash(node --test:*)" \
  --output-format text \
  > docs/autonomie/session.log 2>&1 <<< "SESSION AUTONOME..."
```

**`--allowedTools` n'est pas optionnel.** Sans lui, en mode `-p`, **toute**
commande `Bash` passe par une autorisation que personne n'accorde : la session
reçoit `This command requires approval` à chaque vérification et ne peut rien
prouver. C'est la cause exacte de l'échec de la session du 2026-11-10, où aucune
tâche n'a pu être prouvée alors que le code était écrit.

Une **seule** occurrence de l'option, liste séparée par des virgules : elle est
*variadique* et avale le prompt positionnel, d'où le here-string (`<<<`) — ou,
à défaut, un prompt passé **avant** les options. La syntaxe à deux-points-étoile
a été vérifiée le 2026-11-10 : `Bash(npm run lint:*)` laisse passer
`npm run lint`, `Bash(node --version:*)` laisse passer `node --version`.

`-p` (impression) est la seule forme qui **impose** un plafond de dépense :
`--max-budget-usd` n'agit qu'avec `--print`. Le plafond s'applique **par
processus** : deux lancements simultanés valent deux fois le plafond.

`--model sonnet` est nécessaire lorsqu'un agent sert de session (`--agent cto`) :
le champ `model:` du frontmatter de l'agent ne s'applique pas dans ce cas, et une
session lancée sans `--model` hérite du modèle par défaut de la machine. **Sur ce
poste, `~/.claude/settings.json` route l'API vers un service compatible
(`ANTHROPIC_BASE_URL`, `ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-flash`) : l'alias
`sonnet` y résout vers `deepseek-flash`.** Écrire `--model sonnet` ne fait donc
pas tourner la session sur Sonnet — il évite seulement d'hériter d'un défaut non
maîtrisé. Ne pas présenter cette machine comme travaillant sur Sonnet.

### Arrêter une session

`-p` n'a pas de `claude attach` : on arrête la session en tuant le processus
(`Ctrl-C`, ou `taskkill /PID <pid>`).

**Arrêter veut dire tuer `claude.exe`, pas l'enveloppe shell.** Le 2026-11-10,
un arrêt rapporté comme réussi n'a tué que le wrapper : le processus a continué
huit minutes, écrit dans le dépôt et tronqué la trace du lancement suivant, ce
qui a fait croire à un « écrivain concurrent ». Après **tout** arrêt, vérifier —
et tuer ce qui reste :

```powershell
claude agents --json            # doit ne plus lister de session dans Dev\pcms
Get-Process claude -ErrorAction SilentlyContinue | Stop-Process -Force
```

Avec `claude --bg`, il n'y a **aucun plafond technique** de dépense — seulement
l'échéance de temps inscrite dans `SESSION.md` — et le dossier doit en plus être
approuvé (confiance), ce que `-p` ne demande pas.

### Limites

- Une session **s'arrête net** sur une autorisation qu'elle n'a pas le droit de
  se donner : il ne faut pas compter sur elle pour avancer sans surveillance sur
  une action sensible.
- Interdits pendant une session : `git push`, déploiement, publication. Aucune
  migration n'est exécutée par un agent — les fichiers de
  `supabase/migrations/` s'appliquent à la main dans le SQL Editor.
- Le module Documents est **gelé** : on n'y touche que sur nécessité technique
  démontrée, consignée au journal avant la modification.
- Ce n'est **pas** un travail d'arrière-plan non surveillé : quelqu'un lance la
  session, la surveille et tranche ce qu'un agent n'a pas le droit de faire.
- Lors de la session du 2026-11-10, les commandes de vérification (`npm test`,
  `npm run typecheck`, `npm run lint`) ont été refusées par le harnais
  (`This command requires approval`) parce que le lancement n'avait pas
  `--allowedTools` ; la session s'est close au lieu de produire du travail
  invérifiable. Le défaut était dans la ligne de lancement, pas dans
  l'installation — et un second processus mal arrêté a travaillé en parallèle.
  Le détail est dans `docs/autonomie/RAPPORT.md` et `docs/autonomie/JOURNAL.md`.

---

## Sécurité

Ce qui est réellement en place :

- **Autorisation côté serveur** : la coquille `(app)/layout.tsx` appelle
  `requireSession()` ; chaque Server Action du module Documents revalide la
  session et le rôle avant toute écriture.
  Le `proxy.ts` ne fait que *router* — ce n'est pas une frontière de sécurité.
- **RLS sur toutes les tables** (`0001`) : sans session, aucune ligne n'est
  lisible. Écriture réservée à `admin`/`editor`, suppression à `admin`.
- **Stockage privé** : le bucket `documents` est `public = false`, limité à 10 Mo
  et à une liste blanche de types. Consultation par URL signée uniquement.
- **Journal d'activité non falsifiable** : aucune politique d'insertion n'est
  accordée aux clients, seul un déclencheur `SECURITY DEFINER` écrit dedans.
- **Garde-fou anti-escalade** : un utilisateur ne peut pas modifier son propre
  rôle (`prevent_role_escalation`).
- **Messages de connexion génériques** : l'application ne révèle pas si une
  adresse existe.
- **Redirections ouvertes bloquées** : le paramètre `?suivant=` n'accepte que
  des chemins internes.
- **Aucune indexation** : `robots: noindex, nofollow` sur toute l'application.

Ce qui reste **à faire avant une mise en ligne** :

- Limitation du nombre de tentatives de connexion (Supabase Auth en fournit une
  basique ; un rate-limit applicatif reste souhaitable).
- En-têtes de sécurité HTTP (CSP, HSTS, `X-Frame-Options`) — voir
  `next.config.ts`.
- Rotation des clés et revue des journaux Supabase.

---

## Assistant IA

Six opérations : correction, amélioration rédactionnelle, reformulation, résumé,
traduction, génération de brouillon.

`src/lib/ai/` définit un contrat (`AiProvider`) indépendant de tout fournisseur.
Deux implémentations existent :

- `mock` (par défaut) — hors ligne, déterministe, il n'invente rien : il
  restitue le texte fourni dans un gabarit explicitement non publiable ;
- `openai-compatible` — un `fetch` vers `{AI_BASE_URL}/chat/completions`, donc
  OpenAI, Mistral, Groq, ou un Ollama/LM Studio local, **sans SDK ni dépendance
  ajoutée**.

Changer de fournisseur = changer `AI_PROVIDER` dans `.env.local`. Aucun écran,
aucune Server Action, aucune table ne connaît le fournisseur.

**Confidentialité — deux clés, jamais une seule.** Un contenu ne part vers un
service externe que si (1) `AI_ALLOW_EXTERNAL=true` sur le serveur *et*
(2) l'utilisateur a coché l'autorisation pour cette demande précise. La décision
est prise par `decideSend()` côté serveur ; la case cochée dans le navigateur ne
suffit jamais. Un `AI_BASE_URL` local (`localhost`, `127.0.0.1`) est reconnu
comme local : rien ne sort, aucune autorisation n'est demandée. Au-delà de
60 000 caractères, un envoi externe est refusé, jamais tronqué en silence.

**Validation humaine.** Toute sortie est un `brouillon`. Le parcours est
`brouillon → en_revue → approuve` ou `rejete`. Seul un administrateur approuve
ou rejette — et ce n'est pas l'interface qui le garantit : le déclencheur
`ai_drafts_guard_review` lève une exception pour tout autre rôle. Toute
modification du texte d'un brouillon approuvé le fait retomber en `brouillon`
(déclencheur `ai_drafts_reset_on_content_change`), y compris par un appel direct
à l'API REST.

**Historique.** `ai_draft_revisions` conserve chaque version du texte, en ajout
seul, remplie par déclencheur. Aucune politique d'écriture n'existe sur cette
table : on n'y écrit pas depuis l'application.

---

## Limites assumées et non implémentées

- **Profilage électoral, ciblage individuel et persuasion manipulatoire ne sont
  pas implémentés et ne le seront pas.** Aucune table ne stocke de données
  d'électeurs ou de citoyens.
- Aucun envoi d'e-mail transactionnel (réinitialisation de mot de passe) n'est
  branché : il dépend d'un fournisseur SMTP à configurer dans Supabase.
- Tests automatisés : `npm test` (40 tests au 10 novembre 2026) couvre la logique
  pure — chemins de stockage, signatures de fichiers, consignes de l'assistant,
  décision de confidentialité, validation des formulaires. Les parcours réels se
  vérifient avec `npm run verify:admin`, `verify:navigateur` et `verify:assistant`.

---

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| Écran « Configuration requise » | `.env.local` absent ou incomplet ; redémarrer le serveur après modification |
| `/api/sante` répond `503` | `supabaseConfigured: false` — même cause |
| Connexion refusée avec un mot de passe correct | Compte non confirmé, ou ligne `profiles` absente (vérifier le déclencheur `on_auth_user_created`) |
| Compteurs du tableau de bord à 0 avec un bandeau rouge | Migrations non exécutées, ou politiques RLS non appliquées |
| 404 sur des routes imbriquées en `next dev` | `.next` issu d'un build de production : supprimer `.next` |

Les décisions techniques et leurs justifications sont consignées dans
[`DECISIONS.md`](./DECISIONS.md).
