import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/*
 * T-04 — les textes visibles de l'assistant.
 *
 * Deux contrôles, tous les deux statiques : le fichier source est lu, jamais
 * exécuté, et rien ne touche à la base.
 *
 * 1. Aucun libellé visible ne contient une valeur qui trahirait un défaut de
 *    rendu : `Error:`, `undefined`, `null`, `NaN`, `[object Object]`, `TypeError`.
 *    On n'inspecte que ce qui peut s'afficher : les chaînes de caractères et les
 *    nœuds de texte JSX. Les identifiants du code (`: null`, `undefined` dans une
 *    expression) ne sont pas des libellés et ne sont donc pas lus.
 * 2. Les deux pages déclarent un état vide et un état d'erreur, et ces deux
 *    états ne sont pas des coquilles vides.
 *
 * Ce que ces tests NE prouvent PAS : ce que React affiche réellement. Un libellé
 * construit à partir d'une donnée (`{draft.title}`) n'est pas inspecté — seul le
 * texte écrit dans le composant l'est. La preuve du rendu réel reste
 * `npm run verify:navigateur`.
 */

const PAGES = [
  'src/app/(app)/assistant/page.tsx',
  'src/app/(app)/assistant/[id]/page.tsx',
];

const COMPONENTS_DIR = 'src/components/assistant';

const TOKENS_INTERDITS = [
  { jeton: 'Error:', motif: /Error:/ },
  { jeton: 'TypeError', motif: /\bTypeError\b/ },
  { jeton: '[object Object]', motif: /\[object Object\]/ },
  { jeton: 'undefined', motif: /\bundefined\b/ },
  { jeton: 'NaN', motif: /\bNaN\b/ },
  { jeton: 'null', motif: /\bnull\b/ },
];

function lireFichier(relatif) {
  return fs.readFileSync(path.resolve(relatif), 'utf8');
}

function fichiersDuDossier(relatif) {
  return fs
    .readdirSync(path.resolve(relatif))
    .filter((nom) => nom.endsWith('.tsx'))
    .sort()
    .map((nom) => `${relatif}/${nom}`);
}

/** Retire les commentaires sans toucher au contenu des chaînes. */
function sansCommentaires(source) {
  let sortie = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const fin = sauterChaine(source, i);
      sortie += source.slice(i, fin);
      i = fin;
      continue;
    }
    sortie += c;
    i += 1;
  }
  return sortie;
}

/** Rend l'index juste après la chaîne ouverte en `i`. */
function sauterChaine(source, i) {
  const q = source[i];
  i += 1;
  while (i < source.length && source[i] !== q) {
    i += source[i] === '\\' ? 2 : 1;
  }
  return i + 1;
}

/** Toutes les chaînes de caractères, interpolations de gabarit retirées. */
function chaines(source) {
  const trouvees = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      const fin = sauterChaine(source, i);
      const contenu = source.slice(i + 1, fin - 1).replace(/\$\{[^}]*\}/g, '');
      trouvees.push(contenu);
      i = fin;
      continue;
    }
    i += 1;
  }
  return trouvees;
}

/**
 * Nœuds de texte JSX : ce qui se trouve entre une balise ou une expression
 * fermée (`>` ou `}`) et la suivante (`<` ou `{`). Une expression `{…}` est du
 * code, pas un libellé ; son contenu est couvert par `chaines()`.
 *
 * Le texte compris entre la fin d'un bloc `}` et le JSX qui suit est du code :
 * on l'écarte sur des marques qu'un libellé n'emploie pas (`;`, `=`, mots-clés).
 */
function noeudsTexte(source) {
  return [...source.matchAll(/(?<=[>}])[^<>{}]+(?=[<{])/g)]
    .map((m) => m[0].replace(/\s+/g, ' ').trim())
    .filter((texte) => texte && !ressembleAuCode(texte));
}

function ressembleAuCode(texte) {
  return /[;=]|\b(const|let|var|return|function|import|export|typeof|await|async)\b/.test(texte);
}

function textesVisibles(source) {
  const propre = sansCommentaires(source);
  return [...chaines(propre), ...noeudsTexte(propre)];
}

/** Rend l'index juste après l'accolade fermant l'expression ouverte en `i`. */
function sauterAccolades(source, i) {
  let profondeur = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      i = sauterChaine(source, i);
      continue;
    }
    if (c === '{') profondeur += 1;
    else if (c === '}') {
      profondeur -= 1;
      if (profondeur === 0) return i + 1;
    }
    i += 1;
  }
  return i;
}

/** Rend l'index du `>` qui ferme la balise ouverte en `debut`. */
function finDeBalise(source, debut) {
  let i = debut + 1;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      i = sauterChaine(source, i);
      continue;
    }
    // Une expression dans un attribut (`icon={<X />}`) peut contenir un `>`.
    if (c === '{') {
      i = sauterAccolades(source, i);
      continue;
    }
    if (c === '>') return i;
    i += 1;
  }
  return -1;
}

/** Texte complet d'une balise auto-fermante (`<EmptyState … />`). */
function baliseAutoFermante(source, ouverture) {
  const debut = source.indexOf(ouverture);
  assert.notEqual(debut, -1, `balise absente du fichier : ${ouverture}`);
  const fin = finDeBalise(source, debut);
  assert.notEqual(fin, -1, `balise non fermée : ${ouverture}`);
  return source.slice(debut, fin + 1);
}

/** Texte complet d'une balise avec corps (`<Alert …>…</Alert>`). */
function baliseAvecCorps(source, ouverture, fermeture) {
  const debut = source.indexOf(ouverture);
  assert.notEqual(debut, -1, `balise absente du fichier : ${ouverture}`);
  const finOuverture = finDeBalise(source, debut);
  assert.notEqual(finOuverture, -1, `balise non fermée : ${ouverture}`);
  const fin = source.indexOf(fermeture, finOuverture);
  assert.notEqual(fin, -1, `balise sans corps fermé : ${ouverture}`);
  return source.slice(debut, fin + fermeture.length);
}

function textesDe(fragmentSource) {
  return textesVisibles(fragmentSource).join(' ').replace(/\s+/g, ' ').trim();
}

// --- 1. Aucune valeur technique dans un libellé visible ---------------------

for (const fichier of [...PAGES, ...fichiersDuDossier(COMPONENTS_DIR)]) {
  test(`aucun libellé visible de ${path.basename(fichier)} ne trahit un défaut de rendu`, () => {
    const source = lireFichier(fichier);
    const textes = textesVisibles(source);
    assert.ok(textes.length > 10, 'trop peu de textes extraits : l analyseur ne lit plus ce fichier');

    for (const { jeton, motif } of TOKENS_INTERDITS) {
      const coupable = textes.find((texte) => motif.test(texte));
      assert.equal(
        coupable,
        undefined,
        `${fichier} afficherait « ${jeton} » dans un libellé visible : ${JSON.stringify(coupable)}`,
      );
    }
  });
}

test('l analyseur de textes visibles voit les libellés et ignore le code', () => {
  // Sans ce garde-fou, un analyseur qui ne trouve jamais rien ferait passer
  // tous les tests ci-dessus sans rien contrôler.
  const visible = textesVisibles(
    '<p className="mt-1">Le libellé {x ? "Aucun résultat" : "Aucun brouillon"} est visible</p>',
  ).join(' | ');
  assert.match(visible, /Aucun résultat/);
  assert.match(visible, /Aucun brouillon/);
  assert.match(visible, /est visible/);
  assert.match(visible, /mt-1/);

  const code = textesVisibles(
    '// Error: dans un commentaire\nconst y = null;\n<Alert>{y ? null : undefined}</Alert>',
  ).join(' | ');
  assert.doesNotMatch(code, /Error:/);
  assert.doesNotMatch(code, /\bnull\b/);
  assert.doesNotMatch(code, /undefined/);
});

// --- 2. États vide et d'erreur des deux pages ------------------------------

test('la liste des brouillons déclare un état vide et un état d erreur non vides', () => {
  const source = lireFichier(PAGES[0]);

  const vide = baliseAutoFermante(source, '<EmptyState');
  assert.match(vide, /title=/, "l'état vide doit porter un titre");
  assert.match(vide, /description=/, "l'état vide doit porter une explication");
  const texteVide = textesDe(vide);
  assert.ok(texteVide.length > 40, `état vide trop pauvre : ${JSON.stringify(texteVide)}`);
  assert.match(texteVide, /Aucun/, "l'état vide doit se nommer");

  // La liste a plusieurs états d'erreur ; le premier est celui de lecture.
  const erreur = baliseAvecCorps(source, '<Alert tone="danger"', '</Alert>');
  assert.match(erreur, /title="[^"]+"/, "l'état d'erreur doit porter un titre");
  const texteErreur = textesDe(erreur);
  assert.ok(texteErreur.length > 40, `état d'erreur trop pauvre : ${JSON.stringify(texteErreur)}`);
  assert.match(texteErreur, /migration/, "l'état d'erreur doit dire quoi faire");
});

test('la fiche d un brouillon déclare un état vide et un état d erreur non vides', () => {
  const source = lireFichier(PAGES[1]);

  // État vide : la fiche existe, mais son historique peut être vide.
  const branche = source.indexOf('detail.revisions.length === 0');
  assert.notEqual(branche, -1, "la branche d'historique vide a disparu");
  const finBranche = source.indexOf('</p>', branche);
  assert.notEqual(finBranche, -1, "l'historique vide n'a plus de paragraphe");
  const texteVide = textesDe(source.slice(branche, finBranche + 4));
  assert.ok(texteVide.length > 20, `historique vide sans explication : ${JSON.stringify(texteVide)}`);
  assert.match(texteVide, /Aucun/, "l'historique vide doit se nommer");

  // États d'erreur : lecture impossible (migration absente) et action refusée.
  const illisible = baliseAvecCorps(source, '<Alert tone="danger" title="Brouillon illisible"', '</Alert>');
  const texteIllisible = textesDe(illisible);
  assert.ok(texteIllisible.length > 40, `erreur de lecture trop pauvre : ${JSON.stringify(texteIllisible)}`);
  assert.match(texteIllisible, /migration/, "l'erreur de lecture doit dire quoi faire");

  const action = baliseAvecCorps(source, '<Alert tone="danger" title="Action impossible"', '</Alert>');
  assert.ok(textesDe(action).length > 10, "l'erreur d'action doit rester explicite");

  // Le message affiché pour une erreur inconnue ne doit pas être une chaîne vide.
  const inconnue = /ERRORS\[error\] \?\? "([^"]+)"/.exec(source);
  assert.notEqual(inconnue, null, "le repli du message d'erreur a disparu");
  assert.ok(inconnue[1].trim().length > 5, `repli d'erreur trop court : ${JSON.stringify(inconnue[1])}`);
});
