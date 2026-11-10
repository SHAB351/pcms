---
name: pcms-conventions
description: Règles de maison du dépôt PCMS — structure des couches, discipline SQL/RLS, secret défendu, module Documents gelé, pièges propres à cette machine (Smart App Control, Tailwind épinglé, Server Actions non reproductibles depuis Node). À lire avant d'écrire ou de modifier du code dans ce dépôt.
---

# Conventions PCMS

Ce dépôt a payé cher certains de ces points. Les ignorer coûte un après-midi.

## 1. Avant tout : lire les arbitrages

`DECISIONS.md` à la racine est la mémoire du projet. **Relis-le avant de toucher
au code.** Une décision qui y figure ne se renverse pas parce qu'elle gêne : elle
se discute, puis elle se consigne.

## 2. Les couches, et ce qui va où

```
src/lib/data/        lectures agrégées (listes, filtres, pagination)
src/lib/actions/     écritures : 'use server', session, rôle, Zod, puis base
src/lib/validation/  schémas Zod partagés
src/lib/<domaine>/   constantes et logique pure du domaine
src/components/ui/   primitives visuelles
src/app/(app)/       pages privées, rendu serveur
```

- Une **page** lit, elle n'écrit pas. Une **Server Action** écrit, elle ne rend rien.
- Les actions construisent leurs liens sans le chemin : `buildDocumentsQuery`
  rend `?page=2`, pas `/documents?page=2`. La page préfixe. Respecte ce contrat.
- Les constantes de domaine vivent dans `src/lib/<domaine>/constants.ts`, **sans
  import Supabase** : c'est ce qui permet de les tester hors serveur.
- Une Server Action commence toujours par : session → `can_write()` → Zod →
  base. Dans cet ordre.

## 3. SQL et sécurité — lignes rouges

- Une migration s'**écrit** dans `supabase/migrations/`, elle ne s'**exécute** pas
  depuis un agent. Elle est passée à la main dans le SQL Editor.
- **Jamais** de modification de politique RLS pour faire passer un test. Si un test
  échoue à cause d'une politique, c'est le test qui a raison.
- Toute protection qui compte vit en base ou côté serveur, jamais dans l'interface.
  Une case cochée par l'utilisateur ne protège rien ; elle s'ajoute à une décision
  serveur, elle ne la remplace pas.
- Un déclencheur `security definer` fixe `set search_path = public`.
- Ce qui est vérifié par un déclencheur se documente comme tel : c'est plus fort
  qu'une vérification applicative, et ça se prouve en appelant l'API directement.

## 4. Secrets

- Aucune clé, aucun mot de passe, aucun jeton dans le code, les commentaires, les
  journaux, les rapports, les messages de commit.
- La configuration se lit dans `src/lib/config.ts`. Pas de `process.env` éparpillé.
- `.env.local` n'est jamais lu par un agent, jamais commité, jamais recopié.
- `NEXT_PUBLIC_` = visible dans le navigateur. Une clé secrète n'en porte jamais le
  préfixe.

## 5. Interface

Français, accents compris, y compris dans les messages d'erreur. Pas de « Error »,
pas d'« Invalid input » : une phrase qui dit quoi faire. Une page d'un module non
commencé annonce son état, elle n'imite pas une fonctionnalité absente.

## 6. Pièges propres à cette machine

- **Smart App Control** bloque les binaires natifs récents. C'est pourquoi
  `tailwindcss` et `@tailwindcss/*` sont épinglés en version exacte avec
  `overrides` dans `package.json`. **Ne relève pas ces versions**, et n'ajoute pas
  de dépendance à binaire natif sans nécessité démontrée. 8 Go de RAM seulement.
- **Une Server Action n'est pas reproductible depuis Node.** Un POST forgé échoue
  en 500 « Connection closed » ou perd la session. Seul un vrai navigateur prouve
  le chemin de clic. Voir `scripts/verifier-navigateur.mjs` et `DECISIONS.md` §22.
- **Next 16** : `params`, `searchParams` et `cookies()` sont asynchrones ;
  `middleware` s'appelle `proxy.ts` ; `next lint` n'existe plus (`npm run lint`).
  La doc de la version installée est dans `node_modules/next/dist/docs/`.
- **`next dev` après un `build`** peut renvoyer 404 sur des routes imbriquées :
  supprimer `.next` avant.

## 7. Module Documents — gelé

`src/lib/actions/documents.ts`, `src/lib/documents/`, `src/app/(app)/documents/`,
`src/components/documents/` et `supabase/migrations/0002_documents_storage.sql`
sont **validés et vérifiés** (29 + 23 contrôles). On n'y touche que sur nécessité
technique démontrée, et la raison s'écrit dans le JOURNAL **avant** la modification.

## 8. Tests

`npm test` lance `node --test tests/*.test.mjs`. Ces tests chargent du TypeScript
par `ts.transpileModule` avec un `require` neutralisé : ils éprouvent la **logique
pure**, jamais la base. Un test ne doit ni ouvrir de connexion ni dépendre de
`.env.local`.
