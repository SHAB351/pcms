# Audit T-07 — « aucun secret dans les sorties »

**Date** : 2026-11-10 · **Agent prévu** : `securite` · **Réalisé par** : l'opérateur,
hors session autonome (option 3c validée par Enock).
**Périmètre** : `src/` et `scripts/`, comme défini par le critère de T-07.

## Méthode et décompte

```
$ grep -rn "console\." src/ scripts/ | wc -l
64
```

**64 lignes**, dont **64 classées** ci-dessous — une ligne de code, un verdict.

| Verdict | Nombre |
| --- | --- |
| **BLOQUANT** | **0** |
| **AVERTISSEMENT** | **5** |
| **RAS** | **59** |
| Total | **64** |

Les deux lignes 3 et 19 sont des `console.error(` multilignes : la première ligne
est citée, le contenu complet est examiné dans la section « Avertissements ».

## Ce que cet audit a cherché, et ce qu'il a trouvé

Recherché : toute interpolation d'un mot de passe, d'une clé, d'un jeton ou d'un
en-tête d'autorisation dans une sortie console —

```
$ grep -rn "console\..*\(password\|anonKey\|env\.\|cookie\|token\|Authorization\)" src/ scripts/
```

Les cinq occurrences trouvées sont des **mots** dans des messages statiques
(« …absente de .env.local », « cookies @supabase/ssr rejoués »), **aucune n'interpole
de valeur**. Aucun script n'utilise de clé `service_role` (`grep -rn
"SERVICE_ROLE\|service_role" src/ scripts/` → aucune occurrence) : tout passe par
la clé anonyme, qui est publique par construction.

Conséquence : **aucun BLOQUANT**. Ce qui reste est de la donnée personnelle ou un
message d'erreur interne recopié tel quel dans un terminal.

## Les 64 sorties, une par une

| # | Emplacement | Appel | Verdict |
| --- | --- | --- | --- |
| 1 | `src/app/error.tsx:16` | `console.error(error);` | **AVERTISSEMENT** |
| 2 | `scripts/verifier-admin.mjs:49` | `console.error('ERREUR : URL ou clé Supabase absente de .env.local.');` | **RAS** |
| 3 | `scripts/verifier-admin.mjs:53` | `console.error(` | **RAS** |
| 4 | `scripts/verifier-admin.mjs:71` | `console.log(`  OK    ${label}`);` | **RAS** |
| 5 | `scripts/verifier-admin.mjs:74` | `console.log(`  ECHEC ${label}${detail ? ` — ${maskText(detail)}` : ''}`);` | **RAS** |
| 6 | `scripts/verifier-admin.mjs:91` | `console.log(`\nProjet : ${baseUrl.replace(/https:\/\/([a-z0-9]{4})[a-z0-9]+\./, 'https://$1...')}`);` | **RAS** |
| 7 | `scripts/verifier-admin.mjs:92` | `console.log(`Application : ${appUrl}\n`);` | **RAS** |
| 8 | `scripts/verifier-admin.mjs:93` | `console.log('A. Session et données');` | **RAS** |
| 9 | `scripts/verifier-admin.mjs:102` | `console.log('\nSans session, la suite ne peut pas être exécutée.');` | **RAS** |
| 10 | `scripts/verifier-admin.mjs:205` | `console.log('\nB. Parcours applicatif (cookies @supabase/ssr rejoués)');` | **RAS** |
| 11 | `scripts/verifier-admin.mjs:280` | `console.log('\nC. Suppression');` | **RAS** |
| 12 | `scripts/verifier-admin.mjs:305` | `console.log(`\n${passed} vérification(s) réussie(s), ${failures.length} échec(s).`);` | **RAS** |
| 13 | `scripts/verifier-admin.mjs:307` | `console.log('Échecs :');` | **RAS** |
| 14 | `scripts/verifier-admin.mjs:308` | `for (const failure of failures) console.log(`  - ${failure}`);` | **RAS** |
| 15 | `scripts/verifier-assistant.mjs:48` | `console.error("ERREUR : variables Supabase et PCMS_TEST_ADMIN_* requises dans .env.local.");` | **RAS** |
| 16 | `scripts/verifier-assistant.mjs:60` | `console.error("ERREUR : ni Chrome ni Edge trouvé.");` | **RAS** |
| 17 | `scripts/verifier-assistant.mjs:70` | `console.log(`  OK    ${label}`);` | **RAS** |
| 18 | `scripts/verifier-assistant.mjs:73` | `console.log(`  ECHEC ${label}${detail ? ` — ${detail}` : ""}`);` | **AVERTISSEMENT** |
| 19 | `scripts/verifier-assistant.mjs:132` | `console.error(` | **RAS** |
| 20 | `scripts/verifier-assistant.mjs:276` | `console.log(`\nApplication : ${appUrl}\n`);` | **RAS** |
| 21 | `scripts/verifier-assistant.mjs:278` | `console.log("1. Connexion");` | **RAS** |
| 22 | `scripts/verifier-assistant.mjs:286` | `console.log("\n2. Page Assistant");` | **RAS** |
| 23 | `scripts/verifier-assistant.mjs:297` | `console.log("\n3. Génération d'une correction");` | **RAS** |
| 24 | `scripts/verifier-assistant.mjs:315` | `console.log("\n4. Enregistrement et historique");` | **RAS** |
| 25 | `scripts/verifier-assistant.mjs:334` | `console.log("\n5. Soumission puis approbation");` | **RAS** |
| 26 | `scripts/verifier-assistant.mjs:354` | `console.log("\n6. Retouche d'un texte approuvé");` | **RAS** |
| 27 | `scripts/verifier-assistant.mjs:375` | `console.log("\n7. Suppression");` | **RAS** |
| 28 | `scripts/verifier-assistant.mjs:396` | `console.log(`\nECHEC inattendu : ${error.message}`);` | **RAS** |
| 29 | `scripts/verifier-assistant.mjs:416` | `console.log(`\n${passed} vérification(s) réussie(s), ${failures.length} échec(s).`);` | **RAS** |
| 30 | `scripts/verifier-assistant.mjs:418` | `console.log("Échecs :");` | **RAS** |
| 31 | `scripts/verifier-assistant.mjs:419` | `for (const failure of failures) console.log(`  - ${failure}`);` | **RAS** |
| 32 | `scripts/verifier-documents.mjs:46` | `console.error('ERREUR : NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY absentes de .env.local');` | **RAS** |
| 33 | `scripts/verifier-documents.mjs:60` | `console.error('ERREUR : comptes de test non renseignés :', missing.join(', '));` | **RAS** |
| 34 | `scripts/verifier-documents.mjs:72` | `console.log(`  OK   ${label}`);` | **RAS** |
| 35 | `scripts/verifier-documents.mjs:75` | `console.log(`  ÉCHEC ${label}${detail ? ` — ${detail}` : ''}`);` | **AVERTISSEMENT** |
| 36 | `scripts/verifier-documents.mjs:88` | `console.error(`Connexion impossible pour ${account.email} : ${error?.message ?? 'utilisateur absent'}`);` | **AVERTISSEMENT** |
| 37 | `scripts/verifier-documents.mjs:107` | `console.log(`\nProjet ciblé : ${baseUrl.replace(/https:\/\/([a-z0-9]{4})[a-z0-9]+\./, 'https://$1…')}\n`);` | **RAS** |
| 38 | `scripts/verifier-documents.mjs:109` | `console.log('1. Sessions et profils');` | **RAS** |
| 39 | `scripts/verifier-documents.mjs:126` | `console.log('\n2. Lecture (RLS documents_select_authenticated)');` | **RAS** |
| 40 | `scripts/verifier-documents.mjs:143` | `console.log('\n3. Écriture refusée au lecteur');` | **RAS** |
| 41 | `scripts/verifier-documents.mjs:163` | `console.log('\n4. Dépôt réel par un rédacteur');` | **RAS** |
| 42 | `scripts/verifier-documents.mjs:195` | `console.log('\n5. Téléchargement par URL signée');` | **RAS** |
| 43 | `scripts/verifier-documents.mjs:218` | `console.log('\n6. Modification');` | **RAS** |
| 44 | `scripts/verifier-documents.mjs:243` | `console.log('\n7. Suppression réservée à l’administrateur');` | **RAS** |
| 45 | `scripts/verifier-documents.mjs:288` | `console.log(`\n${passed} vérification(s) réussie(s), ${failures.length} échec(s).`);` | **RAS** |
| 46 | `scripts/verifier-documents.mjs:290` | `console.log('Échecs :');` | **RAS** |
| 47 | `scripts/verifier-documents.mjs:291` | `for (const failure of failures) console.log(`  - ${failure}`);` | **RAS** |
| 48 | `scripts/verifier-navigateur.mjs:53` | `console.error("ERREUR : variables Supabase et PCMS_TEST_ADMIN_* requises dans .env.local.");` | **RAS** |
| 49 | `scripts/verifier-navigateur.mjs:65` | `console.error("ERREUR : ni Chrome ni Edge trouvé. Ouvrez les formulaires à la main.");` | **RAS** |
| 50 | `scripts/verifier-navigateur.mjs:77` | `console.log(`  OK    ${label}`);` | **RAS** |
| 51 | `scripts/verifier-navigateur.mjs:80` | `console.log(`  ECHEC ${label}${detail ? ` — ${detail}` : ""}`);` | **AVERTISSEMENT** |
| 52 | `scripts/verifier-navigateur.mjs:279` | `console.log(`\nNavigateur : ${path.basename(chromePath)}`);` | **RAS** |
| 53 | `scripts/verifier-navigateur.mjs:280` | `console.log(`Application : ${appUrl}\n`);` | **RAS** |
| 54 | `scripts/verifier-navigateur.mjs:283` | `console.log("1. Connexion par le formulaire");` | **RAS** |
| 55 | `scripts/verifier-navigateur.mjs:294` | `console.log("\n2. Page Documents");` | **RAS** |
| 56 | `scripts/verifier-navigateur.mjs:301` | `console.log("\n3. Dépôt (3 Mo)");` | **RAS** |
| 57 | `scripts/verifier-navigateur.mjs:318` | `console.log("\n4. Fiche et enregistrement");` | **RAS** |
| 58 | `scripts/verifier-navigateur.mjs:342` | `console.log("\n5. Modification");` | **RAS** |
| 59 | `scripts/verifier-navigateur.mjs:377` | `console.log("\n6. Téléchargement");` | **RAS** |
| 60 | `scripts/verifier-navigateur.mjs:400` | `console.log("\n7. Suppression");` | **RAS** |
| 61 | `scripts/verifier-navigateur.mjs:435` | `console.log(`\nECHEC inattendu : ${error.message}`);` | **RAS** |
| 62 | `scripts/verifier-navigateur.mjs:465` | `console.log(`\n${passed} vérification(s) réussie(s), ${failures.length} échec(s).`);` | **RAS** |
| 63 | `scripts/verifier-navigateur.mjs:467` | `console.log("Échecs :");` | **RAS** |
| 64 | `scripts/verifier-navigateur.mjs:468` | `for (const failure of failures) console.log(`  - ${failure}`);` | **RAS** |

## Avertissements — détail et portée

### 1. `src/app/error.tsx:16` — `console.error(error)`

Le composant d'erreur de Next écrit l'objet `Error` complet dans la console du
**navigateur**. Aucun texte de cet objet n'est affiché à l'utilisateur : la page
montre une phrase générique et, au besoin, la seule `digest` (l. 28-32). La
console reste donc le bon endroit.

**Portée réelle** : un message d'erreur serveur peut contenir un détail
d'implémentation (nom de table, contrainte SQL). Il n'atteint que le navigateur de
la personne connectée, pas un journal centralisé. Risque : faible, mais réel si un
écran est partagé ou une capture diffusée. **Recommandation** : ne pas « corriger »
en supprimant le log — il sert au diagnostic ; le laisser tel quel et ne jamais
afficher `error.message` dans l'interface.

### 2 à 4. `verifier-assistant.mjs:73`, `verifier-documents.mjs:75`, `verifier-navigateur.mjs:80`

Ces trois `check()` impriment le troisième argument `detail` **sans masquage**,
alors que `verifier-admin.mjs:74` le masque (`maskText`, qui remplace l'adresse du
compte par `***@***`). Or `detail` reçoit couramment un `error.message` de
Supabase (`readerReadError?.message`, `insertError?.message`, `signed.error?.message`…).

**Portée réelle** : un message d'erreur d'authentification peut répéter l'adresse
du compte de test ; un message d'insertion peut citer une valeur soumise. Cela
n'atteint qu'un terminal local, mais un copier-coller de sortie dans un ticket ou
un dépôt rendrait cette donnée publique.

**Recommandation** : aligner ces trois scripts sur `verifier-admin.mjs` (un
`maskText` local par script). Ce n'est pas fait ici : le critère de T-07 est un
audit, pas une modification, et toucher trois scripts de vérification sans les
relancer élargirait le périmètre.

### 5. `verifier-documents.mjs:88` — `Connexion impossible pour ${account.email}`

Imprime en clair l'adresse du compte de test sur la sortie d'erreur. C'est la
seule sortie de tout le périmètre qui nomme une identité volontairement.

**Recommandation** : même traitement que ci-dessus, ou n'afficher que le rôle
(`lecteur`, `rédacteur`, `administrateur`).

## Ce que cet audit ne prouve pas

- **Il ne lit pas les dépendances** (`node_modules/`), ni `.next/`, ni les
  journaux du serveur Next ou de Supabase.
- **Il ne couvre pas les sorties hors console** : il n'existe aucune occurrence de
  `process.stdout.write` / `process.stderr.write` dans le périmètre
  (`grep` → 0), mais un `throw`, un message Zod ou une page d'erreur peuvent
  porter un détail interne sans passer par `console.`.
- **Il ne prouve pas l'absence de secret dans les données elles-mêmes** : si un
  utilisateur colle une clé dans le formulaire de l'assistant, elle finira en base
  — ce n'est pas une fuite de *sortie*.
- **Il ne garantit pas la stabilité du décompte** : la même commande demain peut
  rendre 65. Le chiffre 64 vaut pour l'arbre du 2026-11-10, non commité, branche
  `feature/assistant-ia`.
