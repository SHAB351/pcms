# Décisions techniques — PCMS

Journal des choix d'ingénierie, avec leur justification et leur coût. Une
décision non consignée ici n'a pas été prise.

---

## 1. Emplacement du projet

`C:\Users\Enock SHABANI\Dev\pcms` — cohérent avec les autres projets du poste
(`academicai`, `ccfc-connect`, `article-dechets-kinshasa`). Le dossier personnel
racine n'est pas un dépôt de code.

**Coût** : aucun.

---

## 2. Next.js 16.4.5, App Router, Turbopack par défaut

Version stable la plus récente disponible au moment de la mise en place. Next 16
utilise Turbopack pour `dev` **et** `build` ; aucun réglage webpack n'est présent
dans le projet, donc aucun conflit.

**Conséquence à connaître** : en Next 16, `middleware.ts` est renommé
`proxy.ts` et la fonction exportée s'appelle `proxy`. Le projet suit la nouvelle
convention (`src/proxy.ts`). Le runtime est `nodejs` et n'est pas configurable.

**Coût** : cette version diffère sensiblement de Next 14/15 sur plusieurs points
(`cookies()` asynchrone, `params`/`searchParams` asynchrones, `next lint` supprimé,
absence de `serverRuntimeConfig`). La documentation embarquée dans
`node_modules/next/dist/docs/` fait foi — la consulter avant d'ajouter un module.

---

## 3. `cacheComponents` désactivé

Le modèle Cache Components (PPR) exige d'envelopper les données non mises en
cache dans `<Suspense>` et de marquer les fonctions avec `'use cache'`.

**Pourquoi non** : chaque écran de cette application est propre à un utilisateur
(session + lignes filtrées par RLS). Il n'y a rien à pré-générer ; activer le
modèle n'apporterait que des frontières `<Suspense>` supplémentaires et des
erreurs de build à chaque lecture de données.

**Réversible** : rouvrir ce point si des pages publiques et cacheables
apparaissent (site institutionnel, par exemple).

---

## 4. Rendu dynamique global (`force-dynamic` sur la racine)

**Décision** : `export const dynamic = "force-dynamic"` dans `src/app/layout.tsx`,
donc sur toute l'application.

**Pourquoi** : l'état de configuration et la session sont lus à chaque requête.

**Bug réel corrigé grâce à ce choix** — au premier build, `/connexion` était
pré-générée **statiquement** : la page affichait « Configuration requise » même
une fois les variables d'environnement renseignées, parce que le HTML avait été
figé pendant le build sans credentials. Vérifié : après correction, la route est
`ƒ (Dynamic)` et le formulaire apparaît dès que les variables sont présentes.

**Coût** : aucun cache de page. Acceptable pour une application interne dont le
trafic est de l'ordre de quelques utilisateurs.

---

## 5. Authentification : `@supabase/ssr` avec `getAll` / `setAll`

Le contrat `get/set/remove` est déprécié. Le projet utilise `getAll`/`setAll`,
et **applique les en-têtes anti-cache** que la bibliothèque renvoie dans
`setAll(cookies, headers)` : sans eux, un CDN ou un reverse proxy peut mettre en
cache une réponse porteuse de `Set-Cookie` et servir la session d'un utilisateur
à un autre.

Le rafraîchissement de session a lieu dans `src/proxy.ts`, avant tout rendu.
La vérification d'identité utilise `auth.getUser()` (vérification serveur du
jeton), et non `getSession()` qui se contente de relire le cookie.

---

## 6. Autorisation : double barrière, et ce que le proxy n'est pas

- **`proxy.ts`** ne fait que rediriger un visiteur sans session hors des zones
  privées. Ce n'est **pas** une frontière de sécurité, et le code le dit
  explicitement.
- **`(app)/layout.tsx`** appelle `requireSession()` : deuxième vérification,
  utile si une route est atteinte hors du proxy (rendu interne, préchargement).
- **RLS PostgreSQL** est la barrière réelle : même un appel direct à l'API
  Supabase avec la clé publique ne lit que ce que l'utilisateur a le droit de
  lire. Aucune lecture privilégiée n'est utilisée dans l'application : le client
  « serveur » porte la session de l'utilisateur.

**Non retenu** : une vérification uniquement côté page. Elle laisse passer des
Server Actions si l'on oublie un contrôle.

---

## 7. Rôles : `reader` par défaut, pas d'inscription libre

Trois rôles : `admin` (tout, y compris suppression), `editor` (création et
modification de contenu), `reader` (lecture ; peut faire avancer une tâche dont
il est le titulaire).

**Décisions** :
- Aucun formulaire d'inscription : les comptes sont créés par un administrateur
  depuis le tableau de bord Supabase.
- Le déclencheur `on_auth_user_created` crée la ligne `profiles` avec
  `role = 'reader'` — jamais `admin`, même pour le premier compte. Décider
  dynamiquement « le premier inscrit est admin » crée une fenêtre de course et
  une surface d'attaque inutile.
- La promotion se fait explicitement en SQL (procédure dans le README).
- `prevent_role_escalation` interdit à une session authentifiée non-admin de
  changer un rôle, mais laisse passer les sessions sans `auth.uid()` (SQL Editor,
  `service_role`) afin que la voie d'administration reste ouverte.

---

## 8. Stockage des documents : bucket privé, contraintes serveur

Bucket `documents` avec `public = false`, `file_size_limit = 10 Mio` et liste
blanche de types MIME, appliqués **par le serveur de stockage** et non seulement
par le formulaire. La même liste est dupliquée dans
`src/lib/validation/schemas.ts` pour donner un message clair avant l'envoi.

**Pourquoi les deux** : la validation Zod améliore l'expérience ; la contrainte
du bucket est celle qui protège réellement (un client peut contourner le
formulaire).

Consultation par URL signée à durée limitée — aucune URL publique, aucun lien
permanent.

---

## 9. Journal d'activité alimenté par déclencheurs, non modifiable

`activity_log` n'accorde **aucune** politique d'insertion aux clients. Seule la
fonction `SECURITY DEFINER log_activity()` écrit, via des déclencheurs sur
`documents`, `ai_drafts`, `calendar_entries` et `tasks`.

**Pourquoi** : un journal que l'application peut réécrire n'a aucune valeur en
rapport d'activité. La table est de fait en ajout seul.

**Coût** : toute nouvelle table devant apparaître dans les rapports doit recevoir
son déclencheur.

---

## 10. Couche IA : interface + fournisseur factice, rien de plus

`src/lib/ai/types.ts` définit le contrat ; `registry.ts` sélectionne
l'implémentation via `AI_PROVIDER`. Seul `mock` est enregistré.

**Pourquoi pas d'adaptateur réel tout de suite** : aucun fournisseur n'a été
choisi, aucune clé fournie, et il est interdit de présenter une intégration
comme fonctionnelle sans l'avoir testée. Écrire un adaptateur non testé
donnerait une fausse impression de maturité.

Le fournisseur `mock` est **déterministe et hors ligne** ; il produit un plan de
travail à partir de la consigne et des éléments fournis, et n'ajoute aucun fait,
chiffre ou citation. C'est exactement la garantie demandée.

**Règle** : toute sortie est un brouillon `status = 'brouillon'`, et
`ai_drafts.reviewed_by` / `reviewed_at` tracent la validation humaine.

---

## 11. Validation : Zod côté serveur, autoritaire

Les schémas de `src/lib/validation/schemas.ts` sont utilisés dans les Server
Actions. La validation côté navigateur n'est qu'un confort.

**Zod 4** : les messages passent par `{ error: "…" }` (et non `message`),
`z.email()` est une fabrique de premier niveau.

---

## 12. Interface en français, routes en français sans accents

Les URL utilisent des segments ASCII (`/taches`, `/parametres`,
`/tableau-de-bord`) : les accents dans les chemins sont sources d'encodages
divergents entre clients et proxys.

**Non retenu** : `/tasks`, `/settings` — l'interface est en français, la cohérence
prime.

---

## 13. Thème clair uniquement

Pas de mode sombre. L'outil est utilisé en journée sur des postes bureautiques ;
un second thème double la surface de vérification visuelle sans bénéfice mesuré.
`color-scheme: light` est déclaré pour éviter l'inversion automatique du
navigateur.

---

## 14. Types de base écrits à la main

`src/types/database.ts` reflète les migrations. La CLI Supabase n'est pas
installée sur ce poste, donc `supabase gen types` n'est pas disponible.

**Coût** : toute modification de migration doit être répercutée à la main, ou
les types régénérés. C'est noté en tête du fichier.

---

## 15. Pas de tests automatisés à ce stade

Aucun test n'est fourni. Ce n'est pas un oubli, c'est un report assumé.

**Ce qui a été vérifié au lieu de cela** :
- `npx tsc --noEmit` : aucune erreur.
- `npm run lint` : aucune erreur.
- `npm run build` : build réussi, toutes les routes en dynamique.
- Serveur de production réellement démarré, puis requêtes HTTP :
  - sans credentials → écran de configuration sur `/`, `/connexion`,
    `/tableau-de-bord`, `/documents`, `/parametres` (HTTP 200), et `/api/sante`
    en 503 `configuration_incomplete` ;
  - avec un Supabase factice injoignable → `/api/sante` en 200, `/connexion`
    affiche le formulaire (champs `email` et `password` présents),
    `/tableau-de-bord` redirige en 307 vers
    `/connexion?suivant=%2Ftableau-de-bord` ;
  - `/page-inexistante` → 404 avec la page dédiée.

**Ce qui n'a pas pu être vérifié** (voir section suivante).

---

## 16. Ce qui n'est pas vérifié — à ne pas présenter comme acquis

1. **Le SQL n'a jamais été exécuté.** `psql` exige un mot de passe qui n'est pas
   disponible pour l'instance locale, et il n'existe pas de CLI Supabase ni de
   Docker sur ce poste. Les deux migrations sont relues mais **non validées** par
   un moteur PostgreSQL. À exécuter d'abord sur un projet Supabase de test.
2. **Aucun parcours d'authentification réel** : la connexion, la création de
   profil par déclencheur et les politiques RLS n'ont pas été exercés, faute de
   projet Supabase.
3. **Aucun test du stockage** : dépôt, URL signée et politiques du bucket n'ont
   pas été essayés.
4. **Aucun rendu visuel relu** : l'interface est décrite par le code, pas
   observée dans un navigateur.

---

## 17. Reste à faire avant mise en ligne

- En-têtes de sécurité HTTP (CSP, HSTS, `X-Frame-Options`) dans `next.config.ts`.
- Limitation des tentatives de connexion.
- Réinitialisation de mot de passe (dépend d'un SMTP configuré dans Supabase).
- Tests automatisés (Vitest pour la logique pure, Playwright pour un parcours
  de connexion).
- Initialisation du dépôt Git : le dossier n'est **pas** encore un dépôt
  (`create-next-app` n'en a pas créé ici). `.gitignore` est déjà prêt et
  versionne `.env.example` tout en ignorant `.env*`.

## 18. Reprise du 10 novembre 2026 — protections locales

Modifications : CSP par nonce dans le proxy (rendu déjà dynamique), en-têtes nosniff/frame/referrer/permissions et HSTS en production, no-store sur réponses et redirections, validation stricte des destinations de connexion, compteur calendrier exact distinct de la liste limitée à cinq.

Commandes ajoutées : npm test et npm run typecheck. Sept tests locaux passent : destinations de redirection, CSP, cache privé, compteur calendrier et mode dégradé. Le test du dashboard utilise un client simulé ; il ne valide pas PostgREST sur une base réelle. TypeScript et ESLint passent.

Limites : build tenté deux fois, échec Turbopack lors du lancement de son processus CSS (« node process exited before we could connect »), y compris avec réseau autorisé. Cause racine non confirmée ; aucun test HTTP ni vérification visuelle des nouvelles protections. Ne pas annoncer une version prête à déployer.

Supabase : les outils sont désormais visibles, mais list_projects, list_organizations et search_docs renvoient tous -32001 Unknown tool côté service. Aucun accès à une base, aucune migration, aucun test RLS ou stockage. Les cinq modules métier restent à développer. La limitation durable des connexions et les corrections SQL restent ouvertes. Ne pas réinstaller des dépendances ni reconstruire l’architecture pour masquer ces blocages.

---

## 19. Build et CSS : cause racine trouvée (Smart App Control bloque le binaire natif de Tailwind)

**Symptôme** : la compilation réussissait, mais le CSS produit ne contenait que
le preflight (7 661 octets) — **aucune classe utilitaire**, donc une interface
entièrement sans style. Le rapport du 10 novembre mentionnait en plus un échec
Turbopack « node process exited before we could connect to it ».

**Cause mesurée, et non supposée** :

1. `require('@tailwindcss/oxide-win32-x64-msvc')` échoue avec
   `ERR_DLOPEN_FAILED: An Application Control policy has blocked this file`.
   La politique **Smart App Control** de Windows 11 refuse le binaire natif neuf
   livré par `@tailwindcss/oxide@4.3.5`.
2. Oxide **n'échoue pas** pour autant : il bascule silencieusement sur son
   implémentation **WASI** (`ExperimentalWarning: WASI is an experimental
   feature`). Or cette implémentation n'a aucun accès au système de fichiers.
3. Conséquence exacte : `@source <dossier>` ne trouve **aucun** fichier, donc
   aucune classe. Preuve croisée : `@source inline("rounded-xl")` **émettait**
   bien `.rounded-xl` (calcul pur, sans disque) tandis que le scan de `src`, d'un
   dossier temporaire et d'un chemin neuf sans espace renvoyait 0 candidat.
   L'échec était donc machine, pas projet.
4. Les binaires de `@tailwindcss/oxide@4.3.3`, déjà présents sur ce poste pour
   `academicai` et `ai-research-hub`, **se chargent sans erreur**.

**Correctif** : épingler `tailwindcss`, `@tailwindcss/postcss`, `@tailwindcss/oxide`
et `@tailwindcss/node` en **4.3.3 exact** (sans `^`), avec `overrides` dans
`package.json` pour que les dépendances transitives ne dérivent pas. Ne **pas**
désactiver Smart App Control : c'est le sens de la règle déjà appliquée aux `.pyd`
Python sur ce poste.

**Preuve après correctif** : le CSS passe de 7 661 à **26 143 octets** et contient
les utilitaires utilisés (`rounded-xl`, `bg-slate-50`, `text-slate-900`, `px-4`,
`flex`) ainsi que des variantes responsives (`md:`). `npm run build` réussit,
`npm run lint` et `npm run typecheck` aussi.

**Garde-fou** : `tests/tailwind-native.test.mjs` (3 tests) vérifie que la version
installée est celle épinglée et que le binaire natif **se charge réellement** via
`process.dlopen`, avec le message d'erreur explicite au lieu du repli silencieux.
Sans ce test, une simple montée de version reproduirait la panne sans aucune
erreur visible.

**Intégration Tailwind** : PostCSS (`postcss.config.mjs` + `@tailwindcss/postcss`),
solution officielle Next 16 + Tailwind 4. Le loader `@tailwindcss/turbopack` a été
retiré de `next.config.ts` et de `package.json` : il ne s'exécutait pas.

**Honnêteté sur le message Turbopack** : l'erreur « node process exited before we
could connect to it » **n'a pas été reproduite** dans cette session (build, dev,
build concurrent au dev, et port 3000 occupé : tous réussissent). Lien plausible
mais **non prouvé** : le repli WASI s'exécute dans un processus enfant, et un
processus enfant qui meurt au démarrage est précisément ce que Turbopack rapporte
par ce message. Après correctif, le build enchaîne trois fois sans erreur.

**Ajout d'une contrainte** : ce poste ne peut pas monter de version de Tailwind
sans en vérifier le binaire natif. Sur un autre poste (ou en CI), l'épinglage
n'est pas nécessaire — mais reste sans danger.


---

## 20. Module Documents — dépôt réel, stockage privé, garde-fous

**Ce qui est construit** (fichiers) :

- `src/lib/documents/storage.ts` — chemin de stockage, envoi, URL signée, suppression.
- `src/lib/documents/file-signature.ts` — cohérence type déclaré / premiers octets.
- `src/lib/documents/constants.ts` — constantes partagées client/serveur.
- `src/lib/data/documents.ts` — liste filtrée et paginée, fiche, catégories.
- `src/lib/actions/documents.ts` — dépôt, modification, changement de statut, suppression.
- `src/app/(app)/documents/page.tsx` et `documents/[id]/page.tsx` — liste + fiche.
- `src/app/api/documents/[id]/telecharger/route.ts` — téléchargement par URL signée.
- `src/components/documents/*` — formulaire de dépôt, filtres, édition, badge, suppression.

**Décisions et leur coût** :

1. **Dépôt par Server Action** (et non par envoi direct du navigateur vers
   Storage). Avantage : une seule validation serveur, aucune clé exposée, un
   échec de fiche annule le fichier. Coût : `experimental.serverActions.bodySizeLimit`
   passé à `12mb` dans `next.config.ts` (la limite par défaut est 1 Mo, sous le
   10 Mio du bucket). Un fichier de 10 Mio transite donc en mémoire du serveur.
2. **Contrôle de signature binaire**. `file.type` vient du client et se falsifie.
   Le bucket filtre déjà les types, mais sur ce même type déclaré : un binaire
   renommé `.png` passerait. Les premiers octets sont donc comparés au type
   annoncé (PDF, PNG, JPEG, ZIP des formats OOXML, OLE du .doc). Ce n'est pas un
   antivirus — c'est un refus des incohérences évidentes.
3. **`Content-Disposition: attachment`** sur l'URL signée (`download`), et URL
   valable **60 secondes**. Un fichier déposé n'est jamais rendu comme une page
   dans l'origine du service, et un lien copié expire presque aussitôt.
4. **Chemin de stockage à identifiant aléatoire** (`année/uuid-nom-assaini`) :
   `upsert` désactivé, donc aucun dépôt ne peut écraser le fichier d'un collègue,
   et un chemin ne se devine pas. Le nom d'origine est assaini (accents, `..`,
   séparateurs de chemin).
5. **Recherche : échappement des filtres PostgREST**. `.or()` et `ilike` ont leur
   propre syntaxe ; les caractères `, ( ) " % _ \` sont retirés du terme saisi.
   Sans cela, un usager pourrait réécrire la requête.
6. **Constantes dans `src/lib/documents/constants.ts`** : un composant client
   (`document-metadata-form.tsx`) importait `DOCUMENT_STATUSES` depuis
   `lib/data/documents.ts`, ce qui tirait le client Supabase serveur dans le
   bundle navigateur et **faisait échouer le build**. Le module de constantes
   n'importe rien de serveur. Ne pas refusionner les deux.
7. **Suppression en deux temps** : la fiche d'abord, le fichier ensuite. Un échec
   du second laisse un orphelin, signalé à l'écran (`?erreur=fichier-orphelin`)
   plutôt que masqué.

**Vérifié** : `npm run typecheck`, `npm run lint`, `npm run build` (les routes
`/documents`, `/documents/[id]` et `/api/documents/[id]/telecharger` sont bien
émises), 17 tests unitaires. Sur un serveur de production réel : visiteur sans
session → 307 vers `/connexion?suivant=…` pour les deux pages, et **401 JSON**
pour la route de téléchargement.

**NON vérifié — à ne pas présenter comme acquis** : aucun dépôt réel, aucune URL
signée réelle, aucune politique RLS exercée, aucun rendu visuel constaté. Il n'y
a **aucun fichier `.env.local`** sur ce poste : l'URL du projet Supabase et la
clé publique ne sont pas disponibles, et elles ne peuvent pas être devinées. Tant
que ces deux valeurs ne sont pas fournies, le module est écrit mais pas prouvé.

---

## 21. Connexion au projet Supabase réel — 10 novembre 2026

**Ce qui est vérifié, avec les vraies clés** (aucune clé n'est reproduite ici) :

- `.env.local` contient l'URL du projet et une **clé publishable** moderne
  (`sb_publishable_…`), pas un JWT `anon` historique. `@supabase/ssr` 0.12 la gère.
- Le projet répond : `GET /auth/v1/health` → **200**, GoTrue **v2.197.0**.
- Les **six tables existent** : interrogées sans session, elles répondent toutes
  `401 / code 42501` (permission refusée au rôle `anon`), ce qui est le
  comportement attendu puisque les politiques visent `authenticated`.
- L'application démarre avec la configuration réelle : `/api/sante` → `200
  {"supabaseConfigured":true}`, `/connexion` affiche le formulaire, `/documents`
  et `/tableau-de-bord` redirigent vers `/connexion?suivant=…`.
- En-têtes de sécurité servis en production : CSP à nonce, `X-Frame-Options:
  DENY`, `nosniff`, `no-referrer`, `Permissions-Policy`, `private, no-store`.
- `POST /auth/v1/token` avec des identifiants inconnus → **400
  `invalid_credentials`**, message générique (aucune fuite d'existence de compte).

**Défaut trouvé et corrigé** : `NEXT_PUBLIC_SUPABASE_URL` contenait
`…/rest/v1/`, c'est-à-dire l'URL de l'API REST et non celle du projet. Sans
correction, `supabase-js` aurait composé `/rest/v1/rest/v1/…` et **tous** les
appels auraient échoué. `normalizeSupabaseUrl()` retire un chemin `/rest/v1` et
les barres finales ; un test le couvre. Corriger dans le code plutôt que dans le
fichier d'environnement évite que la faute revienne au prochain collage.

**État de l'inscription publique** (`GET /auth/v1/settings`) :
`disable_signup: false` — **encore ouverte**, donc à fermer ; et
`mailer_autoconfirm: false` — toute inscription exige un e-mail confirmé.

**Conséquence sur les tests** : sans clé `service_role` (volontairement non
fournie) ni accès au tableau de bord, je ne peux ni créer de comptes confirmés,
ni élever des rôles, ni exécuter de SQL. Les tests RLS et le parcours Document de
bout en bout exigent donc trois comptes créés à la main. Le harnais est prêt :
`npm run verify:documents` (`scripts/verifier-documents.mjs`) — il ouvre trois
sessions réelles, dépose un vrai fichier, vérifie l'URL signée octet par octet,
le refus d'accès public, les refus d'écriture du lecteur, le refus de suppression
du rédacteur, la suppression par l'administrateur, puis nettoie derrière lui.
**Il n'a pas encore tourné : aucun résultat ne peut en être tiré.**

---

## 22. Parcours administrateur du module Documents, vérifié — 10 novembre 2026

**Ce qui est mesuré, pas supposé.** Deux harnais ont tourné contre le projet
Supabase réel avec le compte administrateur, et rien d'autre :

- `npm run verify:admin` — **29 vérifications, 0 échec.** Session, profil
  `admin`, dépôt dans le bucket privé, fiche, recherche, URL signée (octets
  comparés un à un, `content-disposition: attachment`), refus de l'URL publique,
  modification des métadonnées et du statut, puis parcours applicatif par
  cookies `@supabase/ssr` rejoués : `/tableau-de-bord`, `/documents`, la fiche,
  la route `/api/documents/[id]/telecharger` en 302 vers une URL signée, et la
  redirection d'un visiteur sans cookie.
- `npm run verify:navigateur` — **23 vérifications, 0 échec.** Chrome piloté par
  le protocole DevTools : connexion par le formulaire, dépôt par le formulaire,
  fiche, modification, téléchargement, suppression par le bouton. Le fichier de
  test fait **3 Mo**, au-delà de la limite de 1 Mo de Next par défaut : c'est la
  seule preuve réelle que `experimental.serverActions.bodySizeLimit: "12mb"`
  est pris en compte.

**Pourquoi un troisième harnais.** Les Server Actions ne sont pas appelables
depuis Node de façon fiable. Trois tentatives ont été faites et documentées :

1. POST multipart avec le champ `$ACTION_ID_<hex>` lu dans le HTML — le chemin
   sans JavaScript. Next ne le reconnaît pas ici (l'action est référencée par un
   `$ACTION_REF`, et le POST est retombé sur la page : 303 vers `/connexion`,
   aucune fiche créée, aucune erreur d'identifiant d'action dans le journal).
2. En-tête `Next-Action` erroné — **400**, « Server Reference ID did not match
   the expected format » : preuve que l'en-tête est bien lu.
3. En-tête `Next-Action` correct avec les arguments encodés à la main
   (`0` = état précédent, `1_<champ>` = champs du formulaire) — **500, digest
   1003696864, « Connection closed »**, et de façon intermittente une session
   perdue (`307 /connexion?suivant=/documents`) alors que le même cookie
   réussissait en GET et sur un POST nu. L'endpoint Supabase `/auth/v1/user`
   répond **200 huit fois sur huit** avec ce même jeton : le défaut est dans ma
   requête forgée, pas dans l'application. **Conclusion : ne pas conclure.**

**Décision :** le seul juge acceptable du chemin de clic est un navigateur.
`scripts/verifier-navigateur.mjs` utilise Chrome (ou Edge) déjà installé sur le
poste via le protocole DevTools — **aucune dépendance ajoutée**, ce qui compte
avec 8 Go de RAM et une politique Smart App Control qui bloque les binaires
natifs neufs. Le fichier est fourni par `DOM.setFileInputFiles`, les champs sont
remplis en passant par le setter natif puis un événement `input`, exactement
comme React l'attend.

**Piège de harnais, pas de l'application.** La première exécution a signalé la
suppression en échec. Cause : mon attente portait sur un chemin qui *commence*
par `/documents`, or `/documents/<id>?erreur=…` aussi. Le script lisait la base
avant même que l'action ait navigué. L'attente exige désormais exactement
`/documents` ou `/documents?…`. Deuxième exécution : verte. Rien n'a été corrigé
dans le produit, parce que le produit n'était pas en cause.

**Non vérifié, et qui doit le rester tant que ce n'est pas fait :**

- Les rôles `editor` et `reader`. Les comptes n'existent pas ; sur décision
  explicite, on ne les crée pas maintenant. `npm run verify:documents` (matrice
  RLS sur trois comptes) est écrit mais **n'a jamais tourné** : aucun de ses
  résultats ne peut être cité.
- La fermeture des inscriptions publiques (`disable_signup: false` dans le
  projet Supabase). C'est une action de tableau de bord, pas de code.

---

## 23. Assistant IA — architecture et garde-fous — 10 novembre 2026

**Ce qui existait et a été réutilisé** : `ai_drafts` et ses politiques RLS
(0001), le contrat `AiProvider` et son registre, `getSession`/`canWrite`/`isAdmin`,
le client Supabase serveur, Zod, les primitives d'interface, le journal
`activity_log` déjà branché sur `ai_drafts`. Le module Documents n'a pas été
modifié : l'assistant le lit en lecture seule, sous les politiques existantes.

**Une seule migration** (`0003_assistant_ia.sql`), sans toucher aux précédentes :
colonnes `operation`, `source_text`, `document_id`, `target_language`,
`external_sent`, `warnings` ; table `ai_draft_revisions` en ajout seul ; trois
déclencheurs. Aucune politique existante n'est remplacée ni contournée.

**Décisions structurantes :**

1. **Confidentialité à deux clés.** `decideSend()` exige `AI_ALLOW_EXTERNAL=true`
   côté serveur *et* une case cochée par l'utilisateur pour la demande précise.
   Un `AI_BASE_URL` local est reconnu comme tel : rien ne sort, donc aucune
   autorisation n'est demandée — réclamer une case pour un traitement local
   banaliserait le geste sans rien protéger. Au-delà de 60 000 caractères, un
   envoi externe est **refusé**, jamais tronqué : une troncature silencieuse
   d'un document confidentiel est une fuite partielle, pas une protection.
2. **La validation humaine est en base, pas dans l'interface.**
   `ai_drafts_guard_review` lève une exception si un non-administrateur tente
   d'écrire `approuve` ou `rejete` ; `ai_drafts_reset_on_content_change` fait
   retomber un brouillon approuvé en `brouillon` dès que le texte change, avec
   `reviewed_by` remis à nul. Les deux protègent aussi contre un appel direct à
   l'API REST, que l'interface ne couvre pas.
3. **Un adaptateur `fetch`, aucun SDK.** `openai-compatible` couvre OpenAI,
   Mistral, Groq, Ollama et LM Studio avec le même code. Rien à installer : la
   contrainte Smart App Control et les 8 Go de RAM rendent toute dépendance
   lourde coûteuse pour un bénéfice nul.
4. **Un seul point de sortie réseau.** Tous les appels passent par
   `src/lib/ai/providers/*`. Un `fetch` ajouté ailleurs serait un contournement
   de la règle de confidentialité.
5. **Le texte d'un document source n'est pas recopié** dans `ai_drafts` : on
   conserve `document_id`. Dupliquer un contenu confidentiel multiplierait les
   copies et les durées de conservation.
6. **Seuls les documents texte (TXT, CSV) servent de source.** Un PDF ou un DOCX
   exigerait une bibliothèque d'extraction ; un « résumé » produit sur un
   fichier illisible serait une invention. L'interface le dit, l'action refuse.
7. **Historique écrit par déclencheur.** `ai_draft_revisions` n'a aucune
   politique d'insertion : l'application ne peut pas l'alimenter à la main, donc
   l'historique ne peut pas être falsifié par l'application.

**Vérifié réellement :** `npm run build` (routes `/assistant` et
`/assistant/[id]` présentes), `npm run typecheck`, `npm run lint`, `npm test`
**40/40** dont 22 nouveaux tests sur les opérations, les consignes, la décision
de confidentialité et la validation des demandes. Le module Documents repasse
`verify:admin` **29/29** et `verify:navigateur` **23/23** : il n'a pas bougé.

**Non vérifié, et qui ne peut pas l'être avant une action manuelle :** la
migration `0003` **n'est pas appliquée**. Sans clé `service_role`, je ne peux pas
exécuter de SQL. `npm run verify:assistant` le détecte et s'arrête sur un message
explicite (`column ai_drafts.operation does not exist`). Tant que la migration
n'est pas passée : aucun brouillon ne peut être enregistré, et **aucune des
règles de validation ou d'historique n'a été exercée en base** — elles sont
écrites, pas prouvées.

**Piège à ne pas répéter :** une Server Action n'est pas reproductible depuis
Node (voir §22). Le parcours de l'assistant se vérifie avec un vrai navigateur,
d'où `scripts/verifier-assistant.mjs`, sur le modèle de `verifier-navigateur.mjs`.

---

## 24. Équipe d'agents et travail autonome — 10 novembre 2026

**Le problème posé.** Le travail restant (tests, audits, documentation) est
borné et vérifiable, mais il demande du temps suivi. Un agent lancé sur ce dépôt
doit donc être **contrôlable** (on sait ce qu'il fait, et sa preuve est une
commande, pas une affirmation), **économe** (le plafond n'est pas une intention)
et **fiable** (l'état survit à la session). Une équipe de cinq agents a été
créée : `cto`, `developpeur`, `qa`, `securite`, `documentation`, avec deux skills
projet (`pcms-conventions`, `pcms-verification`), deux commandes
(`/session-autonome`, `/etat-session`) et quatre fiches de suivi — `TACHES.md`,
`SESSION.md`, `JOURNAL.md`, `RAPPORT.md`.

**Décisions structurantes :**

1. **Le CTO orchestre, il ne code pas.** Il choisit *une* tâche, la délègue au
   bon agent, exige la preuve et tient les fiches. Seule exception, pour la
   dépense : une retouche de moins d'une trentaine de lignes sur un seul fichier,
   qu'il fait lui-même plutôt que de payer une délégation. Un orchestrateur qui
   code devient un développeur qui oublie d'orchestrer.
2. **Un fichier n'a qu'un seul auteur à la fois.** Ni deux sous-agents, ni le
   fil principal pendant qu'un sous-agent y travaille. Le CTO attend la fin
   d'une tâche avant d'en déléguer une qui recoupe les mêmes fichiers, et
   répartit les tâches sur des fichiers indépendants. Un `git status` qui montre
   un fichier hors de la liste autorisée pour la tâche en cours vaut tâche
   **écartée**, pas tâche réussie. Cette règle a un coût : elle interdit le
   parallélisme sur un même fichier, elle ne l'interdit pas sur des fichiers
   distincts.
3. **Les fiches de suivi vivent dans `docs/autonomie/`, jamais sous `.claude/`.**
   L'outil traite `.claude/` comme de la configuration et **refuse toute écriture
   d'agent** dans ce dossier (« sensitive file »). L'essai du 2026-11-10 l'a
   établi quatre fois : le code était livré, mais l'état, le journal et le
   rapport étaient impossibles à écrire. Les fichiers de *configuration* des
   agents et des skills restent, eux, sous `.claude/`.
4. **`PROUVÉ` veut dire « une commande l'a montré », pas « l'agent l'affirme ».**
   Un statut ne monte jamais de `ÉCRIT` à `PROUVÉ` sans une ligne de journal qui
   contient la commande et sa sortie. Le vocabulaire est fermé : `PROUVÉ`,
   `ÉCRIT`, `À FAIRE`, `EN COURS`, `BLOQUÉ-HUMAIN`.
5. **L'indépendance des contrôleurs est structurelle, pas déclarative.** `qa` et
   `securite` n'ont pas l'outil `Write` : ils ne peuvent pas corriger ce qu'ils
   jugent, donc ils ne peuvent pas maquiller un constat. Un contrôleur qui
   répare finit par juger ce qu'il a réparé.
6. **Le plafond de dépense n'est technique que sous `-p`.** `--max-budget-usd`
   n'agit qu'avec `--print`, et là il **coupe réellement** ; `claude --bg` n'a
   aucun plafond. Le plafond s'applique **par processus** : deux lancements
   simultanés valent deux fois le plafond. Toute autre forme d'arrêt sur budget
   est une estimation que l'agent doit reporter lui-même, écrite comme telle.
7. **`--allowedTools` fait partie du contrat de lancement.** Sans lui, en mode
   `-p`, **toute** commande `Bash` passe par une autorisation que personne
   n'accorde, et la session ne peut rien prouver. L'option est *variadique* :
   une seule occurrence, liste séparée par des virgules, et le prompt passé par
   here-string (ou avant les options).
8. **Le modèle réel de cette machine n'est pas Sonnet.** Les cinq agents portent
   `model: sonnet` dans leur frontmatter, mais ce champ **ne s'applique pas**
   quand l'agent sert de session (`--agent cto`), et `~/.claude/settings.json`
   route l'API vers un service compatible avec
   `ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-flash`. L'alias `sonnet` résout donc
   vers `deepseek-flash` : rien dans ce dépôt ne doit présenter l'équipe comme
   travaillant sur Sonnet. Les deux seules choses que `--model sonnet` garantit
   sont la stabilité du choix et l'absence d'héritage d'un défaut non maîtrisé.
9. **Aucun travail d'arrière-plan non surveillé.** Une session est lancée,
   surveillée et close par quelqu'un. Elle **s'arrête net** sur une autorisation
   qu'elle n'a pas le droit de se donner — c'est un comportement attendu, pas une
   panne. Interdits absolus pendant une session : `git push`, déploiement,
   publication, migration exécutée, secret affiché, politique RLS touchée, toute
   modification du module Documents.
10. **Une heure traite 3 à 5 tâches, pas sept.** Le CTO choisit, il ne coche
    pas. Si la file est épuisée avant l'échéance, la session se **clôt** : on
    n'invente pas de travail pour remplir le temps.

**Vérifié réellement :**

- écriture d'un agent dans `docs/autonomie/` — sonde `claude -p --agent cto` :
  fichier créé, réponse `ECRIT` ;
- plafond de dépense coupé par le CLI — `claude -p --max-budget-usd 0.01` →
  `Error: Exceeded USD budget (0.01)`, code de sortie 1 ;
- syntaxe `--allowedTools` — `Bash(npm run lint:*)` laisse passer `npm run lint`
  (`> eslint .`) et `Bash(node --version:*)` laisse passer `node --version`
  (`v24.18.0`) ;
- essai de 30 minutes : **2 tâches prouvées** (T-01, T-02), 4 min 07 s,
  **1,98 USD**, soit ~29 USD/h ;
- état du dépôt au 10 novembre : `npm test` **60/60** (dont les 9 tests de T-04),
  `typecheck` et `lint` sans diagnostic.

**Ce qui a échoué, et qu'il ne faut pas maquiller :**

- **La session d'une heure n'a rien prouvé.** Lancée sans `--allowedTools`, elle
  a reçu `This command requires approval` à chaque vérification et s'est close
  au bout de 2 min 50 s. Le défaut était dans la ligne de lancement, pas dans
  l'installation.
- **Un processus mal arrêté a travaillé en parallèle.** L'outil d'arrêt a tué
  l'enveloppe shell, pas `claude.exe` : l'orphelin (PID 10064) a continué huit
  minutes, écrit trois fichiers et délégué une tâche, en concurrence avec un
  second lancement, et les deux ont écrit dans **le même fichier de trace**. Le
  CTO avait raison de signaler un écrivain concurrent ; il s'agissait de moi.
  Coût réel de la phase : **≈ 4,65 USD** (1,51 + 3,14) pour une exposition
  théorique de 20 USD.
- **Le modèle annoncé n'est pas celui qui sert** (décision 8).

**Pièges à ne pas répéter :** écrire une fiche de suivi sous `.claude/` ;
lancer `-p` sans `--allowedTools` ; arrêter une session en tuant le wrapper ;
lancer deux sessions à la fois sur le même dépôt ; passer le prompt après
`--allowedTools` sans here-string.

---

## 25. Sonde `/api/sante` — divulgation de la configuration IA

**Statut : DÉCISION VALIDÉE le 2026-11-10 par le propriétaire — option 2.**

**La règle retenue.** La route publique `/api/sante` n'expose **que** `status`
et `supabaseConfigured`. Les métadonnées du fournisseur d'IA (identifiant,
libellé, caractère local, présence d'une clé, indicateur de repli) **restent
internes** : elles demeurent disponibles dans l'application via
`getProviderInfo()` (`src/lib/ai/registry.ts:54-61`), que la route n'importe
plus. Le registre et son fonctionnement n'ont pas été touchés.

**Le fait qui a motivé la décision.** `GET /api/sante`
(`src/app/api/sante/route.ts`) est **publique et non authentifiée** — c'est
délibéré, pour qu'un moniteur externe puisse l'appeler sans session. Jusqu'au
2026-11-10, sa réponse portait un objet `ai` construit par `getProviderInfo()`,
plus un champ `aiProvider` conservé pour les moniteurs existants.

**Ce que la route exposait avant la décision, et ce que cela apprenait à un tiers :**

| Champ | Valeur réelle transmise | Ce que cela révèle |
| --- | --- | --- |
| `id`, `aiProvider` | `"mock"` ou `"openai-compatible"` | la famille de fournisseur |
| `label` | `Service externe (${model})` ou `Modèle local (${model})` (`providers/openai-compatible.ts:56-58`) | **le nom exact du modèle configuré** |
| `isLocal` | booléen | si le point d'accès est local ou distant |
| `isConfigured` | `Boolean(baseUrl && model && (apiKey \|\| local))` (`openai-compatible.ts:51`) | **si une clé d'API est présente** |
| `fallback` | booléen | si `AI_PROVIDER` porte une valeur inconnue |

**Ce qui ne sortait pas non plus à l'époque — vérifié par lecture.** Ni la clé
d'API, ni l'URL de base, ni un jeton, ni un en-tête. `getProviderInfo()` ne
transmet que `id`, `label`, `isLocal`, `isConfigured`, `fallback`, et la route
n'en recopiait que ces cinq champs plus `provider.id` (ancienne version de
`sante/route.ts`). Le champ `configurationHint` — celui qui nomme `AI_BASE_URL`,
`AI_MODEL`, `AI_API_KEY` (`openai-compatible.ts:63`) — **n'était pas transmis**.

**Ce que les tests prouvaient alors, et ce qu'ils prouvent maintenant.** Avant
la décision, `tests/sante.test.mjs` (3 tests) exécutait la route avec
`getProviderInfo` **bouchonné** : il prouvait que la route ne recopiait que les
cinq champs prévus et n'ajoutait ni clé ni URL (clé factice `sk-TEST-SECRET`,
hôte RFC 2606 `secret.example`). Il ne prouvait **pas** ce que contenait la
vraie `label` — cela avait été établi par lecture de
`providers/openai-compatible.ts:56-58`, où `label` n'interpole que `model`.

Depuis la décision, ce bouchon a disparu du test, et c'est un gain de preuve :
la route n'importe plus le registre, donc le contrôle porte sur les
**spécificateurs d'importation** (`['@/lib/config', 'next/server']`). La partie
« aucune métadonnée IA » ne dépend plus d'aucun bouchon — elle est structurelle.
**Aucun test n'exerce toujours le registre réel** ; il n'en a plus besoin depuis
cette route, mais cela reste vrai pour l'écran `/assistant`, qui l'appelle
directement.

**Le risque, nommé sans l'exagérer.** Ce n'est pas une fuite de secret, c'est
une **divulgation d'information de configuration** à un appelant non
authentifié : un tiers apprend quel modèle sert et si le service est armé. Cela
permet de viser des techniques d'injection ou de contournement connues pour ce
modèle précis, et de savoir qu'une organisation expose publiquement un point
d'entrée IA. La portée reste bornée : la sonde n'exécute aucune génération, ne
lit aucune donnée et ne permet aucune écriture.

**Ce qui a été appliqué (option 2, 2026-11-10).**

- `src/app/api/sante/route.ts` : la réponse ne contient plus que `status` et
  `supabaseConfigured`. `timestamp` a été retiré au même titre — la consigne
  était « uniquement ». Les codes HTTP ne changent pas : `200` si Supabase est
  configuré, `503` sinon.
- L'import de `@/lib/ai/registry` a été retiré de la route. Ce n'est pas un
  détail de propreté : tant que la route n'importe pas le registre, elle **ne
  peut pas** en recopier un champ, quel que soit l'état du fournisseur.
- `tests/sante.test.mjs` : réécrit autour de six tests, dont un contrôle des
  spécificateurs d'importation (`['@/lib/config', 'next/server']`) et un
  contrôle que le registre exporte toujours `getProviderInfo` et `getProvider`.

**Conséquence à assumer.** Les moniteurs externes qui lisaient `ai`, `label`,
`isConfigured`, `id`, `aiProvider`, `isLocal` ou `fallback` ne reçoivent plus
ces champs. Aucun client de ce dépôt ne les consomme (recherche `api/sante` et
`getProviderInfo` : la seule autre lecture de `getProviderInfo` est
`src/app/(app)/assistant/page.tsx:40`, un appel direct, hors de cette route).
Un moniteur qui veut superviser l'IA devra passer par une sonde authentifiée,
qui n'existe pas encore.

**Audit des consommateurs — 2026-11-10.** Recherche menée sur tout le dépôt,
champs `ai`, `aiProvider`, `timestamp`, `label`, `isConfigured` :

- **Aucun workflow GitHub** (`.github/` absent), **aucune configuration de
  déploiement** (ni `Dockerfile`, ni `vercel.json`, ni `netlify.toml`, ni
  `fly.toml`, ni `render.yaml`, ni `Procfile`), **aucune configuration de
  supervision**. Les seuls `.toml` du dépôt sont les définitions d'agents sous
  `.codex/`.
- **Aucun `fetch(` vers `/api/sante`** dans `src/` : le seul `fetch(` de `src/`
  est l'appel du fournisseur (`providers/openai-compatible.ts:88`).
- **Aucun script de `scripts/`** ne cite `/api/sante`. Les quatre
  (`verifier-admin`, `verifier-assistant`, `verifier-documents`,
  `verifier-navigateur`) pilotent l'application, pas la sonde. `README.md`
  décrit la route (`:176`, `:408`) et se limite à ses codes HTTP.
- Les lectures de `label`, `isConfigured` et `isLocal` viennent d'appels
  **directs** à `getProviderInfo()` (`assistant/page.tsx:40`,
  `parametres/page.tsx:94`) ou de props qui en dérivent — jamais de la réponse de
  la route.
- `timestamp` n'apparaît plus que dans les colonnes SQL `timestamptz` et dans la
  documentation de cette décision.

**Conclusion, bornée à ce qui a été observé.** Aucun consommateur des champs
supprimés n'est **identifié dans ce dépôt**, et aucune supervision externe n'y
est **configurée ni documentée**. Cela n'établit pas qu'aucun consommateur
externe ne puisse exister : un moniteur peut vivre hors du dépôt, et le code
supprimé revendiquait explicitement des « moniteurs existants » sans en nommer
aucun. La vérification qui manquerait — interroger l'hébergeur, le service de
supervision et les journaux d'accès — n'est pas accessible depuis ce dépôt.

**Options rejetées, conservées pour la mémoire de l'arbitrage :**

- **Option 1 d'origine — publier en l'état.** Écartée : le nom exact du modèle
  devenait public.
- **Option 3 d'origine — variante médiane** (`id`, `isLocal`, `fallback`
  conservés ; `label` et `isConfigured` retirés). Écartée : `id` et `isLocal`
  suffisent déjà à décrire la posture de déploiement à un anonyme.
- **Option 4 d'origine — jeton de supervision.** Écartée : elle règle le
  contrôle d'accès mais laisse fuiter le contenu, et ajoute un secret de plus à
  administrer.

Une sonde authentifiée pour la supervision IA reste **à construire** si le
besoin apparaît ; c'est un travail distinct, non engagé ici.
