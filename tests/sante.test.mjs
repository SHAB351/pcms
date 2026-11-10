import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

/*
 * Teste la sonde `GET /api/sante` : elle doit indiquer le fournisseur d'IA
 * actif et son caractère local, sans jamais laisser filtrer la clé d'API ni
 * l'URL du fournisseur.
 *
 * La route est réellement exécutée, avec `next/server`, `@/lib/config` et
 * `@/lib/ai/registry` bouchonnés : la fausse clé et la fausse URL sont donc
 * présentes dans la configuration fournie. Si la route les recopiait, le test
 * échouerait en les retrouvant dans la réponse sérialisée.
 *
 * Ce que ces tests NE prouvent PAS : le comportement du vrai registre ni un
 * appel HTTP réel à Next. Ils prouvent la route et le contenu de sa réponse.
 */

const ROUTE = 'src/app/api/sante/route.ts';
const CLE_FACTICE = 'sk-TEST-SECRET';
const HOTE_FACTICE = 'secret.example';

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

function chargerRoute({ isLocal, supabaseConfigured = true }) {
  return loadModule(ROUTE, {
    'next/server': nextServerStub,
    '@/lib/config': {
      // Ces valeurs sont volontairement secrètes : elles ne doivent jamais
      // apparaître dans la réponse, même indirectement.
      aiConfig: {
        provider: 'openai-compatible',
        apiKey: CLE_FACTICE,
        baseUrl: `https://${HOTE_FACTICE}/v1`,
        timeoutMs: 1234,
      },
      isSupabaseConfigured: () => supabaseConfigured,
    },
    '@/lib/ai/registry': {
      getProviderInfo: () => ({
        id: 'openai-compatible',
        label: isLocal ? 'Modèle local (test)' : 'Service externe (test)',
        isConfigured: true,
        isLocal,
        fallback: false,
      }),
    },
  });
}

test('la sonde expose le fournisseur actif sans aucun secret ni URL', async () => {
  const route = chargerRoute({ isLocal: false });
  const response = await route.GET();
  assert.equal(response.status, 200);

  const body = await response.json();
  const texte = JSON.stringify(body);

  assert.ok(!texte.includes(CLE_FACTICE), 'la clé d\'API ne doit jamais figurer dans la sonde');
  assert.ok(!texte.includes(HOTE_FACTICE), 'l\'hôte du fournisseur ne doit jamais figurer dans la sonde');
  assert.ok(!texte.includes('https://'), 'aucune URL complète ne doit figurer dans la sonde');

  assert.deepEqual(body.ai, {
    id: 'openai-compatible',
    label: 'Service externe (test)',
    isLocal: false,
    isConfigured: true,
    fallback: false,
  });
  assert.equal(body.aiProvider, 'openai-compatible');
  assert.equal(Object.hasOwn(body, 'apiKey'), false);
  assert.equal(Object.hasOwn(body, 'baseUrl'), false);
  assert.equal(Object.hasOwn(body, 'timeoutMs'), false);
});

test('la sonde présente un booléen isLocal, y compris pour un fournisseur local', async () => {
  const route = chargerRoute({ isLocal: true });
  const body = await (await route.GET()).json();

  assert.equal(typeof body.ai.isLocal, 'boolean');
  assert.equal(body.ai.isLocal, true);
  assert.ok(!JSON.stringify(body).includes(HOTE_FACTICE));
});

test('le code de la route ne cite ni apiKey ni baseUrl', () => {
  const source = fs.readFileSync(ROUTE, 'utf8');
  assert.doesNotMatch(source, /apiKey/);
  assert.doesNotMatch(source, /baseUrl/);
});
