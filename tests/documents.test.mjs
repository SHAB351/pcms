import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

/*
 * Teste la logique pure du module Documents sans exécuter Next ni joindre
 * Supabase : chemins de stockage, signature des fichiers, analyse des filtres.
 *
 * Ce que ces tests NE prouvent PAS : le dépôt réel, les politiques RLS et le
 * bucket. Cela exige un projet Supabase configuré (voir tests/README).
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

// Les deux modules testés importent le client Supabase ; les fonctions exercées
// ici ne l'utilisent jamais.
const supabaseStub = {
  createSupabaseServerClient: () => {
    throw new Error('le client Supabase ne doit pas être instancié dans ces tests');
  },
};

const storage = loadModule('src/lib/documents/storage.ts', {
  '@/lib/config': { DOCUMENTS_BUCKET: 'documents' },
  '@/lib/supabase/server': supabaseStub,
});
const signature = loadModule('src/lib/documents/file-signature.ts');
// Les constantes sont chargées réellement : ce sont elles qui contraignent
// les statuts acceptés par l'analyse des filtres.
const constants = loadModule('src/lib/documents/constants.ts');
const data = loadModule('src/lib/data/documents.ts', {
  '@/lib/supabase/server': supabaseStub,
  '@/lib/documents/constants': constants,
});

// --- Noms et chemins de stockage -------------------------------------------

test('sanitizeFileName neutralise chemins, accents et caracteres de controle', () => {
  assert.equal(storage.sanitizeFileName('Rapport été 2026.PDF'), 'rapport-ete-2026.pdf');
  const traversing = storage.sanitizeFileName('../../etc/passwd');
  assert.doesNotMatch(traversing, /[/\\]/);
  assert.doesNotMatch(traversing, /\.\./);
  assert.equal(storage.sanitizeFileName('   '), 'fichier');
  assert.equal(storage.sanitizeFileName('.gitignore'), 'gitignore');
});

test('buildStoragePath isole chaque depot et reste dans le bucket', () => {
  const path = storage.buildStoragePath('Note interne.docx');
  assert.match(path, /^\d{4}\/[0-9a-f-]{36}-note-interne\.docx$/);
  assert.notEqual(path, storage.buildStoragePath('Note interne.docx'));
  assert.doesNotMatch(path, /\.\./);
});

// --- Signature réelle contre type déclaré ---------------------------------

test('la signature binaire doit correspondre au type annonce', () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

  assert.equal(signature.signatureMatchesMimeType('application/pdf', pdf), true);
  assert.equal(signature.signatureMatchesMimeType('application/pdf', png), false);
  assert.equal(
    signature.signatureMatchesMimeType(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      zip,
    ),
    true,
  );
  assert.equal(
    signature.signatureMatchesMimeType(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf,
    ),
    false,
  );
  assert.equal(signature.signatureMatchesMimeType('image/png', png), true);
  assert.equal(signature.signatureMatchesMimeType('image/jpeg', png), false);
  assert.equal(signature.signatureMatchesMimeType('application/pdf', new Uint8Array([])), false);
});

test('un binaire renomme en texte est refuse (octet nul) et un type inconnu aussi', () => {
  const binary = new Uint8Array([0x4d, 0x5a, 0x00, 0x01]);
  assert.equal(signature.signatureMatchesMimeType('text/plain', binary), false);
  assert.equal(signature.signatureMatchesMimeType('text/csv', new Uint8Array([0x61, 0x2c, 0x62])), true);
  assert.equal(signature.signatureMatchesMimeType('application/x-msdownload', binary), false);
});

// --- Filtres de recherche --------------------------------------------------

test('escapeSearchTerm retire la syntaxe PostgREST et les jokers ilike', () => {
  assert.equal(data.escapeSearchTerm('budget,2026'), 'budget 2026');
  assert.equal(data.escapeSearchTerm('a(b)c'), 'a b c');
  assert.equal(data.escapeSearchTerm('100%_sur'), '100 sur');
  assert.equal(data.escapeSearchTerm('  note   interne  '), 'note interne');
  assert.equal(data.escapeSearchTerm('x'.repeat(400)).length, 120);
});

test('parseDocumentListParams applique des bornes sures', () => {
  assert.deepEqual(data.parseDocumentListParams({}), {
    q: '',
    category: '',
    status: 'tous',
    page: 1,
  });
  assert.equal(data.parseDocumentListParams({ statut: 'inconnu' }).status, 'tous');
  assert.equal(data.parseDocumentListParams({ statut: 'archive' }).status, 'archive');
  assert.equal(data.parseDocumentListParams({ page: '-3' }).page, 1);
  assert.equal(data.parseDocumentListParams({ page: 'abc' }).page, 1);
  assert.equal(data.parseDocumentListParams({ page: '99999' }).page, 500);
});

test('buildDocumentsQuery omet les valeurs par defaut', () => {
  const base = { q: '', category: '', status: 'tous', page: 1 };
  assert.equal(data.buildDocumentsQuery(base), '');
  assert.equal(data.buildDocumentsQuery(base, { page: 2 }), '?page=2');
  assert.equal(
    data.buildDocumentsQuery(base, { q: 'note', status: 'valide', page: 3 }),
    '?q=note&statut=valide&page=3',
  );
});
