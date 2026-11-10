import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';

/*
 * Teste la logique pure de l'assistant : les six opérations, la construction
 * des consignes, la décision de confidentialité et la validation des demandes.
 *
 * Ce que ces tests NE prouvent PAS : l'appel réel au fournisseur, l'application
 * de la migration 0003 et les déclencheurs SQL. Cela exige le projet Supabase.
 */

const nodeRequire = createRequire(import.meta.url);

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

const operations = loadModule('src/lib/ai/operations.ts');
const confidentiality = loadModule('src/lib/ai/confidentiality.ts');
const constants = loadModule('src/lib/assistant/constants.ts');
const schemas = loadModule('src/lib/validation/schemas.ts', { zod: nodeRequire('zod') });

// --- Les six opérations -----------------------------------------------------

test('les six opérations demandées existent, une seule fois chacune', () => {
  const ids = operations.AI_OPERATIONS.map((operation) => operation.id);
  assert.deepEqual(ids, [
    'correction',
    'amelioration',
    'reformulation',
    'resume',
    'traduction',
    'redaction',
  ]);
  assert.equal(new Set(ids).size, 6);
});

test('seule la rédaction libre se passe de texte source', () => {
  const sansSource = operations.AI_OPERATIONS.filter((o) => !o.requiresSource).map((o) => o.id);
  assert.deepEqual(sansSource, ['redaction']);
  const traduction = operations.getOperation('traduction');
  assert.equal(traduction.needsTargetLanguage, true);
});

test('une opération inconnue est rejetée', () => {
  assert.equal(operations.isAiOperationId('resume'), true);
  assert.equal(operations.isAiOperationId('invention'), false);
  assert.throws(() => operations.getOperation('invention'), /Opération inconnue/);
});

// --- Construction de la consigne -------------------------------------------

test('la consigne interdit explicitement d\'inventer un fait', () => {
  const prompt = operations.buildPrompt({ operation: 'correction', brief: 'Corrige.', sourceText: 'Texte.' });
  assert.match(prompt.system, /n'inventes jamais un fait/);
  assert.match(prompt.user, /Corrige l'orthographe/);
});

test('le texte source est délimité et reste la seule source', () => {
  const prompt = operations.buildPrompt({
    operation: 'resume',
    brief: 'Résume en dix lignes.',
    sourceText: 'Le conseil a adopté le budget 2027.',
  });
  assert.match(prompt.user, /seule source autorisée/);
  assert.ok(prompt.user.includes('"""'));
  assert.ok(prompt.user.includes('Le conseil a adopté le budget 2027.'));
});

test('sans texte à traiter, la consigne refuse d\'inventer', () => {
  const prompt = operations.buildPrompt({ operation: 'correction', brief: 'Corrige.' });
  assert.match(prompt.user, /Aucun texte à traiter n'a été fourni/);
});

test('la langue cible et la longueur sont transmises', () => {
  const prompt = operations.buildPrompt({
    operation: 'traduction',
    brief: 'Traduis.',
    sourceText: 'Bonjour.',
    targetLanguage: 'anglais',
    maxWords: 120,
  });
  assert.match(prompt.user, /Langue cible : anglais/);
  assert.match(prompt.user, /environ 120 mots/);
});

test('la rédaction libre ne réclame pas de source', () => {
  const prompt = operations.buildPrompt({ operation: 'redaction', brief: 'Écris un communiqué.' });
  assert.doesNotMatch(prompt.user, /Aucun texte à traiter n'a été fourni/);
});

// --- Décision de confidentialité -------------------------------------------

const local = { id: 'mock', label: 'Local', isLocal: true, isConfigured: true };
const externe = { id: 'ext', label: 'Externe', isLocal: false, isConfigured: true };

test('un fournisseur local ne demande aucune autorisation', () => {
  const decision = confidentiality.decideSend({
    provider: local,
    allowExternal: false,
    userAuthorized: false,
  });
  assert.deepEqual(decision, { external: false, allowed: true });
});

test('un fournisseur externe est refusé sans autorisation de l\'opérateur', () => {
  const decision = confidentiality.decideSend({
    provider: externe,
    allowExternal: false,
    userAuthorized: true,
  });
  assert.equal(decision.external, true);
  assert.equal(decision.allowed, false);
  assert.match(decision.refusal, /AI_ALLOW_EXTERNAL/);
});

test('un fournisseur externe est refusé si l\'utilisateur n\'a pas coché', () => {
  const decision = confidentiality.decideSend({
    provider: externe,
    allowExternal: true,
    userAuthorized: false,
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.refusal, /cochez l'autorisation/);
});

test('les deux autorisations réunies sont nécessaires et suffisantes', () => {
  const decision = confidentiality.decideSend({
    provider: externe,
    allowExternal: true,
    userAuthorized: true,
  });
  assert.deepEqual(decision, { external: true, allowed: true });
});

test('un fournisseur non configuré est refusé', () => {
  const decision = confidentiality.decideSend({
    provider: { ...externe, isConfigured: false, configurationHint: 'Renseignez la clé.' },
    allowExternal: true,
    userAuthorized: true,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.refusal, 'Renseignez la clé.');
});

test('un envoi externe trop volumineux est refusé, jamais tronqué', () => {
  const decision = { external: true, allowed: true };
  assert.equal(confidentiality.checkExternalSize(decision, 1000).ok, true);
  const tooBig = confidentiality.checkExternalSize(
    decision,
    confidentiality.MAX_EXTERNAL_SOURCE_CHARS + 1,
  );
  assert.equal(tooBig.ok, false);
  assert.match(tooBig.refusal, /refusé au-delà/);
  // En local, aucune limite de transfert n'a de sens.
  assert.equal(confidentiality.checkExternalSize({ external: false, allowed: true }, 10_000_000).ok, true);
});

// --- Validation d'une demande ----------------------------------------------

function parse(overrides = {}) {
  return schemas.assistantRequestSchema.safeParse({
    operation: 'correction',
    title: 'Corriger un communiqué',
    brief: 'Corrige sans changer le sens.',
    sourceText: 'Un texte à corriger.',
    documentId: '',
    targetLanguage: '',
    maxWords: '',
    externalAuthorized: '',
    objective: '',
    ...overrides,
  });
}

test('une demande de correction valide est acceptée', () => {
  const result = parse();
  assert.equal(result.success, true);
  assert.equal(result.data.operation, 'correction');
  assert.equal(result.data.externalAuthorized, false);
});

test('une opération exigeant un texte est refusée sans source', () => {
  const result = parse({ sourceText: '' });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => /Fournissez le texte à traiter/.test(issue.message)));
});

test('la rédaction libre n\'exige aucune source', () => {
  const result = parse({ operation: 'redaction', sourceText: '' });
  assert.equal(result.success, true);
});

test('deux sources à la fois sont refusées', () => {
  const result = parse({ documentId: '3f1e6f4e-1c8f-4a1e-9d5e-1b2c3d4e5f60' });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => /une seule source/.test(issue.message)));
});

test('une traduction sans langue cible est refusée', () => {
  const result = parse({ operation: 'traduction' });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => /langue de traduction/.test(issue.message)));
});

test('la case d\'autorisation externe n\'est vraie que si elle est cochée', () => {
  assert.equal(parse({ externalAuthorized: 'on' }).data.externalAuthorized, true);
  assert.equal(parse({ externalAuthorized: '' }).data.externalAuthorized, false);
});

test('un texte source démesuré est refusé', () => {
  const result = parse({ sourceText: 'a'.repeat(schemas.AI_MAX_SOURCE_CHARS + 1) });
  assert.equal(result.success, false);
});

// --- Statuts ---------------------------------------------------------------

test('un brouillon approuvé ou rejeté n\'est plus librement modifiable', () => {
  assert.equal(constants.isEditableStatus('brouillon'), true);
  assert.equal(constants.isEditableStatus('en_revue'), true);
  assert.equal(constants.isEditableStatus('approuve'), false);
  assert.equal(constants.isEditableStatus('rejete'), false);
  assert.equal(constants.DRAFT_STATUS_LABELS.approuve, 'Approuvé');
});
