import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Garde-fou : le scanner natif de Tailwind (crate Rust `oxide`) doit réellement
 * se charger.
 *
 * Contexte mesuré le 10 novembre 2026 sur ce poste (voir DECISIONS.md §19) :
 * Smart App Control bloque le binaire natif de `@tailwindcss/oxide@4.3.5`
 * (`ERR_DLOPEN_FAILED: An Application Control policy has blocked this file`).
 * Oxide ne signale pas l'échec : il bascule silencieusement sur son implémentation
 * WASI, qui n'a aucun accès au système de fichiers. Résultat : la compilation
 * réussit, mais `@source` ne trouve aucun fichier et AUCUNE classe utilitaire
 * n'est émise, sans une seule ligne d'erreur.
 *
 * La parade retenue est d'épingler la version dont le binaire est déjà validé sur
 * la machine (4.3.3), jamais de désactiver la politique de sécurité.
 *
 * Ce test échoue si la version installée dérive (un `npm install` qui remonte à
 * une version bloquée) : c'est le seul symptôme observable côté Node.
 */

const OXIDE_BINDINGS = {
  'win32-x64': 'oxide-win32-x64-msvc',
  'win32-arm64': 'oxide-win32-arm64-msvc',
  'linux-x64': 'oxide-linux-x64-gnu',
  'darwin-arm64': 'oxide-darwin-arm64',
  'darwin-x64': 'oxide-darwin-x64',
};

function findOxideDir() {
  // npm dédoublonne quand les versions coïncident : le paquet peut être hoisté à
  // la racine de node_modules ou rester imbriqué sous le plugin PostCSS.
  const candidates = [
    'node_modules/@tailwindcss/oxide',
    'node_modules/@tailwindcss/postcss/node_modules/@tailwindcss/oxide',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  return null;
}

const oxideDir = findOxideDir();

test('le paquet @tailwindcss/oxide est installé', () => {
  assert.ok(oxideDir, '@tailwindcss/oxide introuvable : la compilation CSS ne peut pas fonctionner');
});

test("la version d'oxide est celle épinglée dans package.json", () => {
  const installed = JSON.parse(fs.readFileSync(path.join(oxideDir, 'package.json'), 'utf8')).version;
  const declared = JSON.parse(fs.readFileSync('package.json', 'utf8')).devDependencies.tailwindcss;
  assert.equal(
    installed,
    declared,
    `oxide ${installed} installé mais tailwindcss ${declared} déclaré. ` +
      "Une version plus récente peut être bloquée par Smart App Control : voir DECISIONS.md §19.",
  );
  assert.match(declared, /^\d+\.\d+\.\d+$/, 'tailwindcss doit être épinglé en version exacte, sans ^ ni ~');
});

test('le binaire natif du scanner se charge (et non le repli WASI)', () => {
  const key = `${process.platform}-${process.arch}`;
  const bindingName = OXIDE_BINDINGS[key];
  // Plateforme sans binaire publié : oxide utilise WASI sans perte fonctionnelle
  // connue, il n'y a rien à vérifier ici.
  if (!bindingName) return;

  const bindingDir = path.join(path.dirname(oxideDir), bindingName);
  assert.ok(
    fs.existsSync(bindingDir),
    `${bindingName} absent : oxide tombera sur le repli WASI, qui ne lit pas le disque`,
  );

  const bindingFile = fs
    .readdirSync(bindingDir)
    .find((name) => name.endsWith('.node'));
  assert.ok(bindingFile, `aucun binaire .node dans ${bindingDir}`);

  try {
    const binding = { exports: {} };
    // Chargement direct du fichier : c'est exactement ce que fait le chargeur de
    // Oxide, mais l'erreur remonte ici au lieu d'être avalée par le repli.
    process.dlopen(binding, path.join(bindingDir, bindingFile));
    assert.ok(binding.exports.Scanner, 'le binaire n expose pas Scanner');
  } catch (error) {
    assert.fail(
      `Le binaire natif a été refusé (${error.code ?? error.name}) : ${String(error.message).split('\n')[0]}\n` +
        "Cause observée sur ce poste : politique Smart App Control (voir DECISIONS.md §19). " +
        'Épingler une version de tailwindcss dont le binaire est déjà validé, ne pas désactiver la politique.',
    );
  }
});
