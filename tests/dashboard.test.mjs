import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function loadWithDatabase(calendarError = null) {
  const source = fs.readFileSync('src/lib/data/dashboard.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  const client = { from(table) {
    let options;
    const query = {
      select(_columns, config) { options = config; return query; },
      in() { return query; }, neq() { return query; }, gte() { return query; },
      order() { return query; }, limit() { return query; },
      then(resolve) {
        return Promise.resolve(table === 'calendar_entries'
          ? { data: calendarError ? null : Array.from({ length: 5 }, (_, id) => ({ id })), count: options?.count === 'exact' ? 17 : null, error: calendarError }
          : { data: [], count: 0, error: null }).then(resolve);
      },
    };
    return query;
  } };
  new Function('module', 'exports', 'require', compiled)(compiledModule, compiledModule.exports, () => ({ createSupabaseServerClient: async () => client }));
  return compiledModule.exports.loadDashboard;
}

test('dashboard displays the full calendar count separately from its five-item preview', async () => {
  const data = await loadWithDatabase()();
  assert.equal(data.upcomingCount, 17);
  assert.equal(data.upcoming.length, 5);
  assert.equal(data.degraded, false);
});

test('a failed calendar query marks the dashboard as degraded', async () => {
  const data = await loadWithDatabase({ message: 'permission denied' })();
  assert.equal(data.degraded, true);
  assert.deepEqual(data.upcoming, []);
});

