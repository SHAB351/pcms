# Avis de sécurité — Assistant IA

- **Date** : 2026-11-10
- **Branche** : `feature/assistant-ia` (travail non commité) — *état au moment de
  l'analyse ; depuis commité en `b3d49bf` et poussé sur `origin/feature/assistant-ia`.*
- **Périmètre fermé** : `src/lib/ai/confidentiality.ts`, `src/lib/actions/assistant.ts`,
  `src/lib/data/assistant.ts`, `src/lib/validation/schemas.ts`.
- **Contexte lu sans être jugé** : `src/lib/ai/registry.ts`, `src/lib/ai/types.ts`,
  `src/lib/ai/providers/*`, `src/lib/ai/operations.ts`, `src/lib/config.ts`,
  `src/lib/auth/session.ts`, `src/lib/supabase/server.ts`, migrations `0001`/`0002`/`0003`.
- **Limite majeure** : la migration `supabase/migrations/0003_assistant_ia.sql`
  **n'est pas appliquée**. Aucun comportement en base (RLS, déclencheurs,
  colonnes) n'est exercé ni prouvé ici. Les constats qui en dépendent sont
  marqués « non vérifié ».

## Q1 — Sortie réseau : un texte peut-il partir sans les deux clés ?

**Chemin nominal — RAS.** `genererBrouillon` appelle `decideSend`
(`src/lib/actions/assistant.ts:106-110`) avec `allowExternal: aiConfig.allowExternal`
(lu côté serveur, `src/lib/config.ts:89`) et `userAuthorized: input.externalAuthorized`
(case du formulaire). `decideSend` (`src/lib/ai/confidentiality.ts:56-77`) refuse
tant que l'une des deux clés manque ; un fournisseur local est le seul cas
autorisé sans clé. L'appel au fournisseur (`assistant.ts:130`) est postérieur à
la décision : aucun autre point d'émission réseau n'existe dans les quatre
fichiers. Vérifié par lecture et par `tests/assistant.test.mjs` (23/23).

**AVERTISSEMENT — `isLocalEndpoint` fait confiance au seul nom d'hôte.**
`src/lib/ai/providers/openai-compatible.ts:30-43` : `localhost`, `127.0.0.1`,
`::1`, `*.local` sont déclarés locaux. Scénario : un `AI_BASE_URL` pointant sur
un proxy local (ou un tunnel `*.local`) qui relaie vers un service cloud est
traité comme local → aucune des deux clés n'est demandée et `external_sent=false`
(`openai-compatible.ts:132`), alors que le texte sort. Non déclenchable par un
utilisateur : la configuration de l'opérateur décide. *Preuve non couverte :
aucun appel réseau réel exécuté.*

**AVERTISSEMENT — `external_sent` est auto-déclaré, non recoupé.**
`src/lib/actions/assistant.ts:161` enregistre `result.externalSent`, produit par
le fournisseur, alors que l'autorisation a été décidée à partir de
`provider.info.isLocal`. Les deux concordent aujourd'hui (même variable `local`,
`openai-compatible.ts:49,132` ; `mock` renvoie `false`). Mais aucune assertion ne
garantit `result.externalSent === decision.external` : un futur fournisseur qui
se déclare local tout en émettant enregistrerait `external_sent=false` sur un
envoi réel. Défense en profondeur à ajouter, non exploitable en l'état.

## Q2 — Troncature : refus ou coupe silencieuse ?

**RAS.** `checkExternalSize` (`src/lib/ai/confidentiality.ts:91-103`) renvoie un
refus explicite au-delà de `MAX_EXTERNAL_SOURCE_CHARS = 60_000`
(`confidentiality.ts:89`), uniquement pour un envoi externe. Le texte n'est
jamais coupé avant l'envoi. `assistantRequestSchema` borne `sourceText` à
`AI_MAX_SOURCE_CHARS = 60_000` (`src/lib/validation/schemas.ts:106,122-129`), et
`tests/assistant.test.mjs` vérifie l'alignement des deux constantes et le refus
au-delà. *Preuve non couverte : une troncature par la fenêtre de contexte du
modèle distant n'est pas observable ici ; notre code n'en est pas la cause mais
elle n'est pas détectée après coup.*

## Q3 — Secrets dans messages, logs, warnings, réponses

**RAS — aucune clé, aucun jeton, aucun en-tête `Authorization` dans les quatre
fichiers.** La clé n'apparaît que comme en-tête côté provider, jamais
interpolée dans un message. `grep` ciblé : aucune occurrence de `console.`,
`process.env`, `apiKey`, `authorization`, `Bearer` dans `confidentiality.ts` et
`schemas.ts` (voir commandes). `.env.example` ne contient que des valeurs vides ;
`.gitignore:34` exclut `.env*`.

**AVERTISSEMENT — l'URL de base peut atteindre le navigateur.**
`src/lib/actions/assistant.ts:138-143` renvoie tel quel `AiCallError.message`.
Or `openai-compatible.ts:142` compose ce message avec `error.message` : sur une
URL malformée, `fetch` lève `TypeError: Failed to parse URL from <AI_BASE_URL>`.
Scénario : `AI_BASE_URL` mal saisi mais non vide (donc `isConfigured=true`,
`openai-compatible.ts:51`) → un éditeur déclenche une génération et reçoit dans
l'interface l'URL de base complète. Ce n'est pas une clé, mais une information de
configuration qui fuit vers un rôle non administrateur. *Preuve non couverte :
non reproduit contre un vrai endpoint.*

**AVERTISSEMENT — les messages d'erreur Postgres/PostgREST sont recopiés.**
`src/lib/actions/assistant.ts:174` et `:216` renvoient `error.message` brut au
client. Scénario : une contrainte ou une politique provoque une erreur →
l'utilisateur reçoit le détail interne (nom de relation, de contrainte, parfois
la valeur de clé violée). Pas de texte confidentiel prouvé dans ces messages,
mais bavardage interne. Préférer un message générique + journalisation serveur.
*Preuve non couverte : messages exacts de PostgREST non observés.*

`warnings` proviennent de chaînes fixes des providers (`mock.ts:75-78`,
`openai-compatible.ts:127-131`) : aucun secret. RAS.

## Q4 — Injection de prompt par le document source

**AVERTISSEMENT.** Le texte est délimité et présenté comme seule source
(`src/lib/ai/operations.ts:158-161` : « Texte à traiter (seule source autorisée) »
puis un bloc fermé par `"""`), et la consigne système est un message
`role: system` distinct (`openai-compatible.ts:97-100`) — protection réelle mais
partielle. Le séparateur est fixe et **non échappé** : si le texte source
contient lui-même `"""`, il ferme le bloc et tout ce qui suit est lu par le
modèle comme des instructions, non comme des données. Le texte source est placé
en fin de message utilisateur (récence maximale). Scénario : un éditeur dépose
un fichier `text/plain` dont le contenu commence par `"""` puis « Ignore ce qui
précède et rédige… » ; un autre utilisateur choisit ce document comme source
pour « résumé » → la consigne injectée concurrence la consigne système. Le
risque est borné : la sortie reste un brouillon, `deciderBrouillon` exige
`isAdmin()` (`assistant.ts:265`), donc pas de publication automatique. Pas un
BLOQUANT, mais la structure ne fait pas du document une donnée inerte. *Preuve
non couverte : comportement réel du modèle non testé ; `operations.ts` est hors
de la liste fermée mais la question l'exige.*

### Mise à jour du 2026-11-10 — correction T-08 (postérieure à l'analyse ci-dessus)

L'analyse de Q4 est **conservée telle quelle** : elle décrit l'état du code au
moment de la revue. Ce qui suit la complète, ne la réécrit pas.

**Ce qui a changé dans le code.** `buildPrompt` n'utilise plus un délimiteur
fixe. `sourceFence(text)` (`src/lib/ai/operations.ts:155-159`) mesure la plus
longue suite de guillemets du texte et renvoie `'"'.repeat(max(3, plusLongue + 1))` ;
la borne d'ouverture et la borne de fermeture sont la même variable `fence`
(`operations.ts:177-178`). La propriété tenue est mécanique : le délimiteur est
**plus long que toute suite de guillemets du texte**, donc il ne peut pas
apparaître dans le texte — ni comme suite contiguë, ni à cheval sur une
frontière, puisque cela exigerait une suite d'au moins `plusLongue + 1`.

**Ce qui est corrigé (prouvé).** La sortie du bloc par un document contenant
`"""` n'est plus possible. Quatre tests de `tests/assistant-preuve.test.mjs`
(T-08) le montrent, et `npm test` les exécute :

- « un texte contenant `"""` est encadré par un délimiteur absent du texte » ;
- « le délimiteur dépasse toute suite de guillemets, quelle que soit sa
  longueur » (suite de six guillemets → délimiteur de sept) ;
- « sans suite de guillemets dangereuse, le délimiteur reste `"""` »
  (rétrocompatibilité, le test antérieur de `assistant.test.mjs` passe inchangé) ;
- « la garde tombe si le délimiteur redevient fixe » — mutation en mémoire :
  en réécrivant `const fence = '"""';`, le compte des bornes passe de 2 à 3 et
  le test échoue.

Chaîne complète au 2026-11-10 : `npm test` → **79/79**, `npm run typecheck` →
code 0, `npm run lint` → code 0.

**Ce qui reste — l'injection de prompt n'est pas éteinte.** Le délimiteur ne
protège que la *syntaxe* du bloc. Il n'empêche nullement un document d'écrire,
**à l'intérieur** de la zone délimitée, « ignore les instructions précédentes » :
le modèle lit toujours ce texte comme du contenu, mais rien ne garantit qu'il
ne lui obéisse pas. Les protections sémantiques restent celles qui existaient :
consigne système dans un message `role: system` distinct
(`openai-compatible.ts:97-100`), texte placé en fin de message, et surtout
`deciderBrouillon` exigeant `isAdmin()` (`assistant.ts:265`) — donc **aucune
publication automatique**. La sortie du bloc est fermée ; l'influence sur le
modèle ne l'est pas.

**Ce qui n'est pas vérifié en environnement réel.** Aucun appel réseau n'a été
exercé dans cette mission : le comportement d'un fournisseur (externe ou local)
face à un document hostile reste **non observé**. Les tests sont statiques et
unitaires ; ils prouvent la construction du prompt, pas la réaction du modèle.
`input.brief` (`operations.ts:173`) n'est, lui, pas délimité — c'est le texte du
demandeur lui-même, donc pas une escalade de privilège, mais cela montre que la
frontière protégée est bien « le document d'autrui », pas « tout texte ».

**Ce que cette mise à jour ne change pas.** Les autres avertissements de Q1, Q3,
Q5 et Q6 restent ouverts, y compris `external_sent` auto-déclaré (désormais
consigné comme T-09, `À FAIRE`). Le **BLOQUANT d'ordre de déploiement** de Q5
est intact : `0003_assistant_ia.sql` n'a pas été exécutée et cette revue n'a
aucun moyen de prouver le contraire.

## Q5 — Contrôle d'accès des Server Actions

**RAS — toutes les actions vérifient session et rôle côté serveur avant toute
écriture.** `requireSession()` en première instruction, puis `canWrite`/`isAdmin` :
`assistant.ts:57-64` (générer), `:187-192` (enregistrer), `:236-241` (soumettre),
`:261-267` (décider), `:291-296` (supprimer). Un appel direct hors interface
exécute ces mêmes lignes : la garde n'est pas seulement dans l'UI. RLS en filet
de sécurité (`0001_initial_schema.sql:395-406`).

**BLOQUANT — ordre de déploiement : le code repose sur des déclencheurs de 0003
non appliqués (non vérifié en base).** La politique `0001`
`ai_drafts_update_author_or_admin` (`0001_initial_schema.sql:399-402`) autorise
l'auteur à mettre à jour sa propre ligne. Sans les déclencheurs de `0003` :
1. un éditeur (auteur) peut écrire `status='approuve'` par un PATCH REST direct,
   c'est-à-dire **s'auto-approuver** — exactement ce que
   `guard_ai_draft_review` (`0003_assistant_ia.sql:104-120`) doit interdire ;
2. `enregistrerBrouillon` (`assistant.ts:207-213`) met à jour `content` sans
   vérifier `isEditableStatus` ; sans `reset_ai_draft_on_content_change`
   (`0003:134-146`), un brouillon déjà `approuve` reste `approuve` après
   modification du texte, et le message `assistant.ts:229` (« annule toute
   validation antérieure ») est alors faux.
Ces points ne peuvent pas être prouvés ici (pas d'accès base, migration non
appliquée) et sont **fermés par l'application de 0003**. Ne pas exposer le module
avant. *Preuve non couverte : tout le comportement base.*

**RAS (schéma) — auto-promotion de rôle.** `prevent_role_escalation`
(`0001_initial_schema.sql:150-168`) bloque le changement de son propre rôle hors
administrateur. Non exercé ici.

**AVERTISSEMENT — `listDrafts` expose `source_text` de tous les brouillons à
tout rédacteur.** `src/lib/data/assistant.ts:72` sélectionne `source_text` et
`content` ; la politique `ai_drafts_select_author_or_writer`
(`0001:391-393`) accorde la lecture à `created_by = auth.uid() or can_write()`,
soit **tout `admin` ou `editor`**. Scénario : l'éditeur A colle un paragraphe
confidentiel dans un brouillon ; l'éditeur B ouvre `/assistant` et lit ce
`source_text`. Conforme à la politique écrite, donc pas une faille au sens de la
frontière RLS, mais si l'intention était « auteur ou administrateur », l'effet
est plus large. À confirmer par le CTO ; ne pas modifier la politique sans
décision consignée.

## Q6 — `readDocumentSource` : périmètre et taille

**RAS — pas de lecture hors du périmètre RLS applicable.**
`src/lib/data/assistant.ts:174-205` utilise le client serveur porteur de la
session (`src/lib/supabase/server.ts:28`, clé anon + cookies, pas de
`service_role`). La ligne `documents` est donc filtrée par
`documents_select_authenticated` (`0001:372-374`, tout authentifié) et le
téléchargement par `documents_storage_read` (`0002:37-39`, tout authentifié sur
le bucket) : les deux périmètres coïncident, il n'existe pas de périmètre
documentaire par utilisateur dans ce module. Le type MIME est revérifié côté
serveur (`data/assistant.ts:188`) sur la liste `AI_READABLE_DOCUMENT_MIME_TYPES`
(`schemas.ts:98`). Le contrôle `UUID_PATTERN` (`:34`) est faible mais sans effet
(invalide → erreur Postgres → « introuvable »).

**AVERTISSEMENT — pas de plafond de taille à cette couche.**
`data/assistant.ts:204` fait `await file.text()` sans borne ; la seule borne
amont est `file_size_limit` du bucket (~10 Mio, `0002`). Ce n'est **pas une
fuite** : pour un envoi externe, `checkExternalSize` refuse au-delà de 60 000
caractères (`assistant.ts:121-125`), donc la limite est reportée correctement à
la couche d'envoi. C'est en revanche un risque de ressource (chaîne de ~10 Mio en
mémoire par requête ; prompt non borné vers un provider local). Un plafond à la
lecture est souhaitable, non bloquant. *Preuve non couverte : aucun document réel
lu ici.*

## Ce que la preuve ne couvre pas (faute d'accès à la base / migration 0003)

- RLS de `ai_drafts`, `ai_draft_revisions`, `documents`, `storage.objects` non
  exercées ; tout le raisonnement RLS vient de la lecture des `.sql`.
- Déclencheurs `record_ai_draft_revision`, `guard_ai_draft_review`,
  `reset_ai_draft_on_content_change`, `prevent_role_escalation` : non exécutés.
- Colonnes ajoutées par 0003 (`operation`, `source_text`, `document_id`,
  `target_language`, `external_sent`, `warnings`) absentes de `0001` : l'insert
  de `genererBrouillon` (`assistant.ts:148-169`) échouera tant que 0003 n'est pas
  appliquée — le module est **non fonctionnel** en l'état, pas seulement « non
  vérifié ».
- Appel réseau réel à un fournisseur (externe ou local) : non exécuté.
- Comportement du modèle face à une injection : non testé.
- `git ls-files` (recherche `.env*` versionné) : commande refusée par
  l'environnement (autorisation) ; vérification faite par `.gitignore:34-36` et
  `Glob **/.env*` (seul `.env.example`, valeurs vides).

## Verdict général

Aucune fuite réseau directe ni élévation de privilège **dans le code des Server
Actions** : les deux clés sont exigées, le refus de taille est un refus, et les
cinq actions contrôlent session et rôle. Deux points méritent une action avant
usage réel : (1) **BLOQUANT d'ordre de déploiement** — appliquer
`0003_assistant_ia.sql` avant d'exposer le module, sous peine d'auto-approbation
par PATCH REST et de validation qui survit à une retouche ; (2) la délimitation
du texte source (`"""` non échappé) laisse une injection de prompt possible par
un document, bornée par la relecture admin — **partiellement corrigée depuis
(T-08, voir la mise à jour en Q4 : la sortie du bloc est fermée, l'influence
sémantique sur le modèle ne l'est pas)**. Le reste relève d'avertissements de
robustesse (URL de base dans un message d'erreur, erreurs Postgres recopiées,
`source_text` visible de tout éditeur, pas de plafond à `readDocumentSource`).

## Commandes exécutées

- `node --test tests/assistant.test.mjs` → `tests 23`, `pass 23`, `fail 0`.
- `Grep` motif `error\??\.message|console\.|process\.env|apiKey|authorization|Bearer`
  sur `src/lib/actions/assistant.ts` → occurrences lignes 141, 174, 216.
- Même motif sur `src/lib/data/assistant.ts` → aucune occurrence.
- Même motif sur `src/lib/ai/confidentiality.ts` → aucune occurrence (seul
  `refusal` sort, lignes 22/46/60/70/94/99).
- Même motif sur `src/lib/validation/schemas.ts` → aucune occurrence.
- `git -C … ls-files` → refusée par l'environnement (autorisation) ; remplacée
  par `Glob **/.env*` (`.env.example` uniquement) et lecture de `.gitignore`.

Extrait réel (`node --test`) :
```
✔ les six opérations demandées existent, une seule fois chacune (7.6096ms)
✔ le texte source est délimité et reste la seule source (0.3481ms)
...
ℹ tests 23  ℹ pass 23  ℹ fail 0
```

## Ajout de l'opérateur — 2026-11-10 (non produit par l'agent `securite`)

**Constat.** La sonde `GET /api/sante` (`src/app/api/sante/route.ts`) est
**publique et non authentifiée** — c'est délibéré, pour qu'un moniteur externe
puisse l'appeler. Jusqu'au 2026-11-10, sa réponse contenait un objet `ai` :
`id`, `label`, `isLocal`, `isConfigured`, `fallback`, ainsi que `aiProvider`.
Or `label` **contenait le nom du modèle** configuré, et `isConfigured`
**indiquait si une clé est présente**.

**Ce que ce n'est pas.** Ni la clé, ni l'URL de base, ni un jeton : `getProviderInfo()`
ne transmet rien de tel, et cette note ne contredit pas le « RAS » de Q3 sur les
secrets. La divulgation porte sur une **information de configuration**, pas sur
un secret.

**Décision — 2026-11-10, option 2, validée par le propriétaire**
(`DECISIONS.md` §25). La route publique n'expose plus que `status` et
`supabaseConfigured`. Les métadonnées du fournisseur restent internes, via
`getProviderInfo()`, que la route **n'importe plus**. Le registre n'a pas été
modifié.

### Risque corrigé — et ce qui le prouve

La divulgation est fermée **structurellement**, pas par filtrage : la route ne
charge plus le registre d'IA, donc elle ne peut en recopier aucun champ, quel
que soit l'état du fournisseur. `tests/sante.test.mjs` (6 tests) le vérifie à
trois niveaux :

1. **Forme exacte de la réponse** — `Object.keys(body).sort()` vaut exactement
   `['status', 'supabaseConfigured']`, en `200` comme en `503`.
2. **Absence nominative** — `ai`, `label`, `isConfigured`, `isLocal`, `fallback`,
   `aiProvider`, `id` sont absents ; ni `openai-compatible`, ni `mock`, ni un nom
   de modèle n'apparaissent dans la réponse sérialisée.
3. **Preuve structurelle** — les spécificateurs d'importation de la route valent
   exactement `['@/lib/config', 'next/server']`, sans `require` ni `import()`
   dynamique. C'est cette assertion qui rend les deux précédentes solides : un
   bouchon peut mentir, une liste d'imports ne le peut pas.

Le test vérifie aussi qu'aucune clé, aucun jeton (`Bearer-TEST-TOKEN`) et aucune
URL (`https://secret.example/v1`, hôte RFC 2606) ne sortent, et que le registre
exporte toujours `getProviderInfo` et `getProvider` — il n'a pas été amputé pour
faire passer le test.

### Ce que ces tests ne prouvent pas

- **Aucun appel HTTP réel à Next** : routes, middlewares et cache ne sont pas
  exercés. Le test appelle la fonction `GET` exportée et sérialise sa réponse.
- **Le registre réel n'est pas exercé** — et il n'a plus besoin de l'être depuis
  cette route, puisqu'elle ne l'importe pas. Cela reste vrai pour l'écran
  `/assistant` (`page.tsx:40`), qui l'appelle directement.
- **La décision de réduire la surface n'a pas été confrontée à un pentest** : on
  prouve une absence de champ, pas une résistance à une attaque.

### Réserve à consigner

`timestamp` a été retiré de la réponse au titre du « uniquement » de la consigne.
Un moniteur qui l'utilisait pour dater la mesure ou détecter un cache ne l'a
plus ; les en-têtes HTTP (`Date`) restent disponibles. Aucun client de ce dépôt
ne consommait ce champ.
