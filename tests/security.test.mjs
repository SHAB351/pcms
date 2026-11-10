import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
// Compile the actual pure helpers without a test-runner dependency or Next runtime.
const source = fs.readFileSync('src/lib/security.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const helpers = { exports: {} };
new Function('module', 'exports', compiled)(helpers, helpers.exports);
const { safeRedirectTarget, contentSecurityPolicy, preventPrivateCaching } = helpers.exports;

test('rejects external redirects, protocol-relative URLs, backslashes and parser control characters', () => {
  for (const url of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/\n/evil.test', '/\t/evil.test', '/\r/evil.test', '/ /evil.test']) {
    assert.equal(safeRedirectTarget(url), '/tableau-de-bord');
  }
});
test('preserves internal destinations and query strings', () => {
  assert.equal(safeRedirectTarget('/documents?q=rapport#titre'), '/documents?q=rapport#titre');
});
test('production CSP requires nonce, blocks framing and plugins, and uses exact Supabase origin', () => {
  const csp = contentSecurityPolicy('abc123', false, 'https://project.supabase.co/path');
  assert.match(csp, /nonce-abc123/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /connect-src 'self' https:\/\/project.supabase.co$/);
  assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline|\/path/);
});
test('development alone permits eval and development styles', () => {
  assert.match(contentSecurityPolicy('test', true), /unsafe-eval/);
  assert.doesNotMatch(contentSecurityPolicy('test', false, 'not a URL'), /not a URL/);
});
test('private cache policy overwrites public caching including redirects', () => {
  const headers = new Headers({ 'cache-control': 'public, max-age=3600' });
  preventPrivateCaching(headers);
  assert.match(headers.get('cache-control'), /private, no-store/);
  assert.equal(headers.get('pragma'), 'no-cache');
  assert.equal(headers.get('expires'), '0');
});


// --- Configuration Supabase -------------------------------------------------
const configSource = fs.readFileSync('src/lib/config.ts', 'utf8');
const configCompiled = ts.transpileModule(configSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const configModule = { exports: {} };
new Function('module', 'exports', 'require', configCompiled)(configModule, configModule.exports, () => ({}));
const { normalizeSupabaseUrl } = configModule.exports;

test("l'URL du projet est nettoyée du chemin REST collé par erreur", () => {
  assert.equal(normalizeSupabaseUrl('https://ref.supabase.co/rest/v1/'), 'https://ref.supabase.co');
  assert.equal(normalizeSupabaseUrl('https://ref.supabase.co/rest/v1'), 'https://ref.supabase.co');
  assert.equal(normalizeSupabaseUrl('  https://ref.supabase.co//  '), 'https://ref.supabase.co');
  assert.equal(normalizeSupabaseUrl('https://ref.supabase.co'), 'https://ref.supabase.co');
});
