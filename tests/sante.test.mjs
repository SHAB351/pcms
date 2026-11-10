import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

/*
 * Teste la sonde `GET /api/sante`.
 *
 * Décision `DECISIONS.md` §25 (option 2, validée par le propriétaire) : la route
 * est publique et non authentifiée, donc sa réponse est réduite à `status` et
 * `supabaseConfigured`. Aucune métadonnée du fournisseur d'IA ne doit en sortir.
 *
 * Trois niveaux de preuve, volontairement séparés :
 *   1. la route est réellement exécutée, avec `next/server` et `@/lib/config`
 *      bouchonnés ; sa réponse sérialisée est inspectée ;
 *   2. le source de la route est relu pour vérifier qu'il n'importe **même
 *      pas** le registre d'IA. Cette preuve ne dépend d'aucun bouchon : si le
 *      registre n'est pas importé, aucune de ses valeurs ne peut être recopiée.
 *      Le bouchon du registre est volontairement **absent** de `loadModule` :
 *      toute réintroduction de cet import fait échouer le test au chargement ;
 *   3. le registre lui-même est relu pour vérifier qu'il n'a pas été amputé.
 *
 * Ce que ces tests NE prouvent PAS : un appel HTTP réel à Next (routes,
 * middlewares, cache), ni le comportement du vrai registre — qui n'est plus
 * atteignable depuis cette route. Ils prouvent la route et sa réponse.
 */

const ROUTE = 'src/app/api/sante/route.ts';
const REGISTRE = 'src/lib/ai/registry.ts';

// Valeurs volontairement secrètes : elles ne doivent jamais apparaître dans la
// réponse, même indirectement.
const CLE_FACTICE = 'sk-TEST-SECRET';
const HOTE_FACTICE = 'secret.example';
const JETON_FACTICE = 'Bearer-TEST-TOKEN';

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

// `NextResponse.json` renvoie un vrai `Response` : la réponse est ensuite
// sérialisée et relue comme le ferait un moniteur.
const nextServerStub = {
  NextResponse: {
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
  },
};

function chargerRoute({ supabaseConfigured = true } = {}) {
  return loadModule(ROUTE, {
    'next/server': nextServerStub,
    '@/lib/config': {
      aiConfig: {
        provider: 'openai-compatible',
        apiKey: CLE_FACTICE,
        accessToken: JETON_FACTICE,
        baseUrl: `https://${HOTE_FACTICE}/v1`,
        timeoutMs: 1234,
      },
      isSupabaseConfigured: () => supabaseConfigured,
    },
  });
}

const CHAMPS_PUBLICS = ['status', 'supabaseConfigured'];

test('la réponse publique ne contient que status et supabaseConfigured', async () => {
  const route = chargerRoute({ supabaseConfigured: true });
  const response = await route.GET();
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), CHAMPS_PUBLICS);
  assert.equal(body.status, 'ok');
  assert.equal(body.supabaseConfigured, true);
});

test("aucune métadonnée du fournisseur d'IA n'est exposée", async () => {
  const route = chargerRoute({ supabaseConfigured: true });
  const body = await (await route.GET()).json();

  for (const champ of ['ai', 'label', 'isConfigured', 'isLocal', 'fallback', 'aiProvider', 'id']) {
    assert.equal(Object.hasOwn(body, champ), false, `le champ « ${champ} » ne doit plus être exposé`);
  }

  const texte = JSON.stringify(body);
  assert.doesNotMatch(texte, /openai-compatible|mock/i, 'aucun identifiant de fournisseur');
  assert.doesNotMatch(texte, /modele|model/i, 'aucun nom de modèle');
});

test('ni clé, ni jeton, ni URL interne ne figurent dans la réponse', async () => {
  const route = chargerRoute({ supabaseConfigured: true });
  const texte = JSON.stringify(await (await route.GET()).json());

  assert.ok(!texte.includes(CLE_FACTICE), "la clé d'API ne doit jamais figurer dans la sonde");
  assert.ok(!texte.includes(JETON_FACTICE), 'le jeton ne doit jamais figurer dans la sonde');
  assert.ok(!texte.includes(HOTE_FACTICE), "l'hôte du fournisseur ne doit jamais figurer dans la sonde");
  assert.ok(!texte.includes('https://'), 'aucune URL complète ne doit figurer dans la sonde');
  assert.ok(!texte.includes('/v1'), 'aucun chemin interne ne doit figurer dans la sonde');
});

test('une configuration Supabase absente reste signalée, avec la même forme', async () => {
  const route = chargerRoute({ supabaseConfigured: false });
  const response = await route.GET();
  assert.equal(response.status, 503);

  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), CHAMPS_PUBLICS);
  assert.equal(body.status, 'configuration_incomplete');
  assert.equal(body.supabaseConfigured, false);
});

test("la route n'importe plus le registre d'IA — preuve structurelle", () => {
  const source = fs.readFileSync(ROUTE, 'utf8');

  // Le point central : sans cet import, la route ne peut pas lire le fournisseur,
  // donc aucun de ses champs ne peut être recopié — quel que soit le bouchon.
  //
  // L'assertion porte sur les spécificateurs d'importation réellement écrits,
  // pas sur le texte brut : un commentaire qui *parle* du registre (pour
  // expliquer la décision) ne doit pas faire échouer le test. Une première
  // version cherchait `ai/registry` dans le fichier entier et tombait sur sa
  // propre documentation.
  const specifiers = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(specifiers, ['@/lib/config', 'next/server']);

  assert.doesNotMatch(source, /\brequire\s*\(/, 'aucun require dynamique');
  assert.doesNotMatch(source, /\bimport\s*\(/, 'aucun import dynamique');

  // Contrôles sur le code seul, commentaires retirés.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /getProviderInfo/, 'le code ne doit pas appeler getProviderInfo');
  assert.doesNotMatch(code, /aiConfig/, 'le code ne doit pas lire la configuration IA');
  assert.doesNotMatch(code, /apiKey/, "le code ne doit pas citer la clé d'API");
  assert.doesNotMatch(code, /baseUrl/, "le code ne doit pas citer l'URL de base");
});

test("le registre d'IA reste intact — il n'a pas été amputé", () => {
  const source = fs.readFileSync(REGISTRE, 'utf8');
  assert.match(source, /export function getProviderInfo/);
  assert.match(source, /export function getProvider\(/);
});
