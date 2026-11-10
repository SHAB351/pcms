# Avis du développeur — preuve de A-01, A-02, A-04 et T-08

Date : 2026-11-10. Branche : `feature/assistant-ia`.
Fichier créé : `tests/assistant-preuve.test.mjs` (19 tests).
Fichier modifié : `src/lib/ai/operations.ts` (T-08 : `sourceFence()`, +18/−1).
Aucun autre fichier de `src/` n'a été modifié.

## Ce que j'ai examiné

- `.claude/skills/pcms-conventions/SKILL.md` et
  `.claude/skills/pcms-verification/SKILL.md`.
- `src/lib/ai/registry.ts`, `src/lib/ai/operations.ts`, `src/lib/ai/types.ts`,
  `src/lib/ai/providers/mock.ts`, `src/lib/ai/providers/openai-compatible.ts`.
- `src/lib/data/assistant.ts` (`readDocumentSource`), `src/lib/config.ts`,
  `src/lib/assistant/constants.ts`, `src/lib/validation/schemas.ts`.
- `src/lib/actions/assistant.ts`, les pages et la route qui consomment le
  registre.
- Les tests existants `tests/assistant.test.mjs` et
  `tests/assistant-data.test.mjs`, pour reprendre exactement leur technique de
  chargement (`ts.transpileModule` + `require` neutralisé).

## Ce que les tests exercent réellement

### A-01 — fournisseur interchangeable (statique, sur le code réel)

1. Les importations de `src/lib/ai/registry.ts` sont analysées puis comparées à
   une liste **exacte** : `@/lib/config`, `@/lib/ai/types`,
   `@/lib/ai/providers/mock`, `@/lib/ai/providers/openai-compatible`. Ajouter
   toute autre dépendance fait échouer le test.
2. L'import de `@/lib/ai/types` doit être un `import type` et ne nommer que
   `AiProvider` et `AiProviderInfo` : le registre ne dépend que du contrat.
3. Tous les `.ts`/`.tsx` de `src/app/` et `src/lib/actions/` sont parcourus ;
   aucun ne doit importer `lib/ai/providers/…` (forme `@/` ou relative).
4. Une mutation en mémoire d'une vraie page (`assistant/page.tsx`) avec un import
   de `mockProvider` est détectée : le garde-fou n'est pas décoratif.

### A-02 — correction et amélioration (comportement)

`buildPrompt` est exécuté pour les six opérations avec le même brief et le même
texte source. Sont vérifiés : six phrases d'instruction deux à deux distinctes ;
correction et amélioration ne partagent aucune des deux phrases ; le prompt
système contient toujours « n'inventes jamais un fait » et « [à compléter] », et
le texte fourni reste « seule source autorisée ». Une mutation en mémoire qui
recopie la consigne de correction dans l'amélioration fait tomber le compte de 6
à 5, ce qui prouve la sensibilité de l'assertion.

### A-04 — résumé documentaire (comportement, Supabase simulé)

`readDocumentSource` est exécutée avec un faux client Supabase injecté par
`createSupabaseServerClient`. Aucune connexion réseau ni Supabase n'est ouverte.
Cas couverts : identifiant non UUID (refusé avant création du client), document
absent ou refusé par RLS, PDF (message mentionnant PDF/Word, sans
téléchargement), `text/plain` et `text/csv` (texte lu et restitué), échec de
téléchargement. Une mutation en mémoire qui neutralise la vérification du type
MIME fait passer le PDF en `ok: true`, ce qui prouve que le refus testé vient
bien de cette vérification.

## Commandes réellement exécutées

```text
> npm test
...
✔ A-01 — le registre ne dépend que du contrat, des fournisseurs et de la configuration
✔ A-01 — aucun écran ni aucune Server Action n'importe un fournisseur concret
✔ A-01 — le garde-fou détecte réellement un import de fournisseur concret
✔ A-02 — les six opérations produisent des consignes deux à deux distinctes
✔ A-02 — correction et amélioration ne partagent pas la même phrase d'instruction
✔ A-02 — le prompt système interdit toujours d'inventer un fait, pour les six opérations
✔ A-02 — la garde tombe si correction et amélioration partagent la même consigne
✔ A-04 — les formats lisibles sont exactement text/plain et text/csv
✔ A-04 — un identifiant non UUID est refusé avant même d'interroger Supabase
✔ A-04 — un document absent ou non autorisé est refusé explicitement
✔ A-04 — un PDF est refusé avec un message explicite mentionnant le format
✔ A-04 — un document text/plain sert de source et son texte est lu
✔ A-04 — un document text/csv sert de source et son texte est lu
✔ A-04 — un échec de téléchargement est signalé sans invention de contenu
✔ A-04 — le refus du PDF échouerait si la vérification du format était retirée
ℹ tests 75
ℹ pass 75
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

```text
> npm run typecheck
> tsc --noEmit --incremental false
```

```text
> npm run lint
> eslint
```

`typecheck` et `lint` n'ont produit **aucun diagnostic**. La commande `npm` n'a
signalé aucun échec (un échec aurait imprimé une erreur et un statut non nul) ;
le code de sortie est donc 0 pour les deux. La tentative de faire afficher
`%ERRORLEVEL%` par une commande composée a été refusée par l'environnement
d'exécution (autorisation), pas par le code.

## Conclusion

- **A-01, A-02, A-04 : VÉRIFIÉ** au niveau 1 de la vérification PCMS (logique
  pure, typage, style), avec en plus trois preuves de mutation qui montrent que
  les garde-fous échouent quand la condition est cassée.
- **Non prouvé par ces tests** : l'appel réel à un fournisseur d'IA, les
  politiques RLS et les déclencheurs de la migration `0003_assistant_ia.sql`
  (non appliquée), et le rendu réel des pages dans un navigateur. Ces tests ne
  remplacent donc pas `npm run verify:assistant`.

## T-08 — délimiteur du bloc « seule source autorisée »

Revue `securite` : dans `src/lib/ai/operations.ts`, le texte source était encadré
par un délimiteur fixe `"""`. Un document contenant lui-même `"""` refermait le
bloc et la suite était lue comme une instruction (injection de prompt).

### Modification

`sourceFence(text)` choisit une suite de guillemets **plus longue que toute
suite présente dans le texte** : `max(3, plusLongueSuite + 1)`. Sans suite de
trois guillemets ou plus, le délimiteur reste `"""` — le test existant
`le texte source est délimité et reste la seule source` de
`tests/assistant.test.mjs` passe inchangé. Le texte poussé dans le prompt reste
le texte source lui-même, non échappé, non tronqué ; la borne d'ouverture et la
borne de fermeture sont la même variable `fence`.

### Tests ajoutés (4)

1. Un texte contenant `"""` est encadré par `""""`, délimiteur absent du texte ;
   les bornes comptent 2 lignes, et la ligne `"""` du document reste à
   l'intérieur du bloc.
2. Une suite de six guillemets impose un délimiteur de sept.
3. Sans suite dangereuse, le délimiteur reste `"""` (rétrocompatibilité).
4. Mutation en mémoire : en remplaçant `const fence = sourceFence(source);` par
   `const fence = '"""';`, le compte des bornes `"""` passe de 2 à 3 — la garde
   échoue bien si le délimiteur redevient fixe.

### Commandes réellement exécutées

```text
> npm test
...
✔ T-08 — un texte contenant """ est encadré par un délimiteur absent du texte
✔ T-08 — le délimiteur dépasse toute suite de guillemets, quelle que soit sa longueur
✔ T-08 — sans suite de guillemets dangereuse, le délimiteur reste """
✔ T-08 — la garde tombe si le délimiteur redevient fixe
✔ le texte source est délimité et reste la seule source
ℹ tests 79
ℹ pass 79
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

```text
> npm run typecheck
> tsc --noEmit --incremental false
```

```text
> npm run lint
> eslint
```

`typecheck` et `lint` n'ont produit aucun diagnostic (code de sortie 0).

### Conclusion

**T-08 : VÉRIFIÉ** au niveau 1 (logique pure) : un texte contenant `"""` ne peut
plus refermer le bloc, le texte reste verbatim, et la rétrocompatibilité `"""`
est conservée. Non prouvé : le comportement d'un fournisseur réel face à un
document hostile (aucun appel réseau n'est exercé) et l'application en base, qui
ne dépend pas de ce changement.
