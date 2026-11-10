import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

/*
 * Teste la logique pure de la couche de lecture du module Assistant :
 * analyse des paramètres d'URL et construction des liens de pagination.
 *
 * Ce que ces tests NE prouvent PAS : les requêtes Supabase, les politiques RLS,
 * ni le rendu de la page. Seules `parseDraftListParams` et `buildDraftsQuery`
 * sont exercées ici.
 */

function loadModule(file, stubs = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const requireStub = (id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    throw new Error(`import non prévu dans ce test : ${id}`);
  };
  new Function('module', 'exports', 'require', compiled)(mod, mod.exports, requireStub);
  return mod.exports;
}

// Les fonctions exercées n'instancient jamais le client Supabase.
const supabaseStub = {
  createSupabaseServerClient: () => {
    throw new Error('le client Supabase ne doit pas être instancié dans ces tests');
  },
};

// `escapeSearchTerm` est chargée réellement depuis le module Documents : on ne
// recopie pas son implémentation, et on vérifie que l'assistant l'appelle bien.
const documentsConstants = loadModule('src/lib/documents/constants.ts');
const documentsData = loadModule('src/lib/data/documents.ts', {
  '@/lib/supabase/server': supabaseStub,
  '@/lib/documents/constants': documentsConstants,
});

// Les constantes de statuts sont chargées réellement : ce sont elles qui
// contraignent les valeurs acceptées par l'analyse des paramètres.
const assistantConstants = loadModule('src/lib/assistant/constants.ts');

// Ces deux fonctions n'utilisent pas les types MIME : un stub suffit.
const schemasStub = {
  AI_READABLE_DOCUMENT_MIME_TYPES: ['text/plain', 'text/csv', 'text/markdown'],
};

const data = loadModule('src/lib/data/assistant.ts', {
  '@/lib/supabase/server': supabaseStub,
  '@/lib/data/documents': documentsData,
  '@/lib/assistant/constants': assistantConstants,
  '@/lib/validation/schemas': schemasStub,
});

const base = { q: '', status: 'tous', page: 1 };

// --- Analyse des paramètres d'URL ------------------------------------------

test('parseDraftListParams ramene toute page invalide a 1', () => {
  assert.equal(data.parseDraftListParams({ page: 'abc' }).page, 1);
  assert.equal(data.parseDraftListParams({ page: '0' }).page, 1);
  assert.equal(data.parseDraftListParams({ page: '-3' }).page, 1);
  assert.equal(data.parseDraftListParams({}).page, 1);
  // Un paramètre en tableau : on retient le premier élément.
  assert.equal(data.parseDraftListParams({ page: ['2', '3'] }).page, 2);
});

test('parseDraftListParams borne une page trop grande a 500 et garde une page valide', () => {
  assert.equal(data.parseDraftListParams({ page: '99999' }).page, 500);
  assert.equal(data.parseDraftListParams({ page: '7' }).page, 7);
});

test('parseDraftListParams ramene un statut inconnu a "tous" et conserve un statut valide', () => {
  assert.equal(data.parseDraftListParams({ statut: 'archivé' }).status, 'tous');
  assert.equal(data.parseDraftListParams({ statut: 'nimportequoi' }).status, 'tous');
  assert.equal(data.parseDraftListParams({}).status, 'tous');

  for (const statut of assistantConstants.AI_DRAFT_STATUSES) {
    assert.equal(data.parseDraftListParams({ statut }).status, statut);
  }
  // Le premier élément d'un tableau est retenu, comme pour la page.
  assert.equal(data.parseDraftListParams({ statut: ['approuve', 'brouillon'] }).status, 'approuve');
});

test('parseDraftListParams nettoie la recherche avec la vraie escapeSearchTerm', () => {
  const terme = '  budget%_\\,()"   2026  ';

  // Preuve que la vraie fonction est appelée, pas une copie locale.
  assert.equal(
    data.parseDraftListParams({ q: terme }).q,
    documentsData.escapeSearchTerm(terme),
  );

  const nettoye = data.parseDraftListParams({ q: terme }).q;
  assert.equal(nettoye, 'budget 2026');
  assert.doesNotMatch(nettoye, /[%_\\,()"]/);
  assert.doesNotMatch(nettoye, /\s{2,}/);

  // Le terme est coupé à 120 caractères, après nettoyage.
  const long = data.parseDraftListParams({ q: 'x'.repeat(400) }).q;
  assert.equal(long.length, 120);
});

// --- Construction des liens de pagination ----------------------------------

test('buildDraftsQuery ne rend jamais "?" seul et omet les valeurs par defaut', () => {
  assert.equal(data.buildDraftsQuery(base), '');
  assert.notEqual(data.buildDraftsQuery(base), '?');
  assert.equal(data.buildDraftsQuery(base, { page: 2 }), '?page=2');
  assert.equal(data.buildDraftsQuery(base, { status: 'approuve' }), '?statut=approuve');
});

test('buildDraftsQuery encode la recherche pour ne pas casser la chaine', () => {
  const query = data.buildDraftsQuery(base, { q: 'a&b=c' });
  assert.equal(query, '?q=a%26b%3Dc');
  // Aucun `&` ni `=` brut dans le terme : la chaîne garde un seul paramètre.
  assert.equal(query.slice(1).split('&').length, 1);
  // Aucun chemin préfixé.
  assert.doesNotMatch(query, /^\/|\?\/|assistant/);
});

test('buildDraftsQuery respecte l ordre des parametres et les surcharges sans muter l objet', () => {
  const params = { q: 'note', status: 'brouillon', page: 1 };
  const frozen = { ...params };

  assert.equal(
    data.buildDraftsQuery(params, { status: 'approuve', page: 3 }),
    '?q=note&statut=approuve&page=3',
  );
  assert.deepEqual(params, frozen);
});
