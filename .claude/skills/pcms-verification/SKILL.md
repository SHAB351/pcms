---
name: pcms-verification
description: Comment prouver qu'une chose fonctionne dans PCMS — quelle commande exécuter, ce qu'elle prouve réellement, ce qu'elle ne prouve pas, ses prérequis et ses codes de sortie. À lire avant d'annoncer qu'une tâche est terminée.
---

# Prouver, dans PCMS

Le dépôt distingue trois niveaux de preuve. Ils ne sont pas interchangeables.

## Niveau 1 — logique pure

```bash
npm run typecheck   # types
npm run lint        # ESLint
npm test            # node --test tests/*.test.mjs
```

Prouve : la logique testée, le typage, le style.
**Ne prouve pas** : la base, le navigateur, le rendu, les droits.

Un test ajouté *après* le code et qui n'a jamais échoué ne prouve pas grand-chose.
Dis-le quand c'est le cas.

## Niveau 2 — données réelles contre Supabase

```bash
npm run verify:admin       # 29 contrôles : données, stockage, rendu
npm run verify:documents   # matrice RLS admin/editor/reader — JAMAIS EXÉCUTÉ
```

`verify:admin` exige `.env.local` complet et `PCMS_TEST_ADMIN_*`.
`verify:documents` exige trois comptes créés ; **il n'a jamais tourné sur ce
projet**, donc aucun de ses résultats n'est citable.

Prouve : ce que la base répond à un client donné.
**Ne prouve pas** : qu'un utilisateur peut faire le parcours en cliquant.

## Niveau 3 — navigateur réel

```bash
npm run start            # serveur de PRODUCTION sur :3100
npm run verify:navigateur   # 23 contrôles du parcours Documents
npm run verify:assistant    # parcours Assistant IA
```

Prérequis : Chrome ou Edge installé (le script le trouve), serveur sur `:3100`.
Surcharger l'adresse avec `PCMS_BASE_URL` si besoin. Aucune dépendance à installer :
le script pilote Chrome par le protocole DevTools, avec le `WebSocket` natif de Node.

`verify:navigateur` dépose un PDF de 3 Mo pour prouver `bodySizeLimit` — ce n'est
pas décoratif.

### Codes de sortie de `verify:assistant`

| Code | Sens |
| --- | --- |
| 0 | tous les contrôles passent |
| 1 | au moins un contrôle a échoué (la liste est imprimée) |
| 2 | `MIGRATION MANQUANTE` — `0003_assistant_ia.sql` n'a pas été appliquée |

Le code 2 est un **résultat**, pas une panne : la migration s'applique à la main
dans le SQL Editor. Tant qu'elle n'est pas passée, rien de ce que fait l'assistant
en base n'est prouvé.

## Les quatre pièges qui produisent un faux résultat

1. **Attendre le mauvais chemin.** `/documents/<id>?erreur=…` commence aussi par
   `/documents`. Une attente de navigation doit viser `p === "/documents"` ou
   `p.startsWith("/documents?")`, jamais un simple préfixe de module.
2. **Croire un POST forgé.** Une Server Action n'est pas reproductible depuis
   Node. Elle échoue en 500 digest `1003696864`, « Connection closed », ou perd la
   session, alors que le même cookie fonctionne en GET. Seul le navigateur prouve.
3. **Lire `textContent` d'un bouton désactivé.** Le clic n'a pas lieu : la preuve
   est vide, pas négative.
4. **Nettoyer avant de conclure.** Les scripts suppriment ce qu'ils créent et
   vérifient que la base est revenue à son état. Si le nettoyage échoue, dis-le :
   une ligne de test laissée en base est un défaut.

## La règle de rédaction

Toute affirmation de fin de tâche prend l'une de ces quatre formes :

- **VÉRIFIÉ** — commande + sortie citée ;
- **ÉCRIT, NON EXERCÉ** — le code existe, aucune preuve d'exécution ;
- **BLOQUÉ** — ce qui manque, et qui doit le faire (souvent : une action humaine) ;
- **SUPPOSÉ** — et alors on ne s'appuie pas dessus.

« Ça devrait marcher » n'est aucune des quatre.
