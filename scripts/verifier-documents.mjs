/**
 * Vérification réelle du module Documents contre le projet Supabase.
 *
 * Ce script n'est PAS un test unitaire : il ouvre de vraies sessions, écrit de
 * vrais fichiers dans le bucket privé et vérifie que les politiques RLS refusent
 * ce qu'elles doivent refuser. Il s'exécute donc uniquement avec trois comptes
 * de test créés à la main dans le tableau de bord Supabase.
 *
 * Usage :
 *   node scripts/verifier-documents.mjs
 *
 * Variables lues dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY   (déjà présentes)
 *   PCMS_TEST_ADMIN_EMAIL / PCMS_TEST_ADMIN_PASSWORD
 *   PCMS_TEST_EDITOR_EMAIL / PCMS_TEST_EDITOR_PASSWORD
 *   PCMS_TEST_READER_EMAIL / PCMS_TEST_READER_PASSWORD
 *
 * Aucune clé n'est affichée. Aucun compte n'est créé ni supprimé par ce script.
 * Les documents de test qu'il dépose sont supprimés en fin de parcours.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// --- Chargement de .env.local ----------------------------------------------

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = { ...loadEnv(path.resolve('.env.local')), ...loadEnv(path.resolve('.env')) };
const baseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!baseUrl || !anonKey) {
  console.error('ERREUR : NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY absentes de .env.local');
  process.exit(1);
}

const ACCOUNTS = {
  admin: { email: env.PCMS_TEST_ADMIN_EMAIL, password: env.PCMS_TEST_ADMIN_PASSWORD, role: 'admin' },
  editor: { email: env.PCMS_TEST_EDITOR_EMAIL, password: env.PCMS_TEST_EDITOR_PASSWORD, role: 'editor' },
  reader: { email: env.PCMS_TEST_READER_EMAIL, password: env.PCMS_TEST_READER_PASSWORD, role: 'reader' },
};

const missing = Object.entries(ACCOUNTS)
  .filter(([, account]) => !account.email || !account.password)
  .map(([name]) => `PCMS_TEST_${name.toUpperCase()}_EMAIL / _PASSWORD`);
if (missing.length > 0) {
  console.error('ERREUR : comptes de test non renseignés :', missing.join(', '));
  process.exit(1);
}

// --- Petite bibliothèque d'assertions ---------------------------------------

let passed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  OK   ${label}`);
  } else {
    failures.push(label);
    console.log(`  ÉCHEC ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function signIn(account) {
  const client = createClient(baseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error || !data.user) {
    console.error(`Connexion impossible pour ${account.email} : ${error?.message ?? 'utilisateur absent'}`);
    process.exit(1);
  }
  return { client, user: data.user };
}

/** Un PDF minimal : la signature %PDF- est ce qui compte pour nos contrôles. */
function samplePdf(label) {
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n% ${label}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const created = []; // { id, storagePath }

// --- Parcours ---------------------------------------------------------------

const sessions = {};
const users = {};
console.log(`\nProjet ciblé : ${baseUrl.replace(/https:\/\/([a-z0-9]{4})[a-z0-9]+\./, 'https://$1…')}\n`);

console.log('1. Sessions et profils');
for (const [name, account] of Object.entries(ACCOUNTS)) {
  const { client, user } = await signIn(account);
  sessions[name] = client;
  users[name] = user;
  const { data: profile, error } = await client
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle();
  check(
    `${name} : profil lisible et rôle = ${account.role}`,
    !error && profile?.role === account.role,
    error ? error.message : `rôle obtenu : ${profile?.role ?? 'aucun profil'}`,
  );
}

console.log('\n2. Lecture (RLS documents_select_authenticated)');
const { error: readerReadError } = await sessions.reader
  .from('documents')
  .select('id')
  .limit(5);
check('le lecteur peut lire la liste', !readerReadError, readerReadError?.message);

const anon = createClient(baseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: anonRows, error: anonError } = await anon.from('documents').select('id').limit(5);
check(
  'sans session, aucune ligne n’est lisible',
  Boolean(anonError) || (Array.isArray(anonRows) && anonRows.length === 0),
  anonError ? '' : `${anonRows?.length} ligne(s) lue(s) sans session`,
);

console.log('\n3. Écriture refusée au lecteur');
const readerPath = `verification/${stamp}-lecteur.pdf`;
const readerUpload = await sessions.reader.storage
  .from('documents')
  .upload(readerPath, samplePdf('lecteur'), { contentType: 'application/pdf', upsert: false });
check('envoi Storage refusé au lecteur', Boolean(readerUpload.error), 'le bucket a accepté le fichier');

const readerInsert = await sessions.reader
  .from('documents')
  .insert({
    title: `Test RLS lecteur ${stamp}`,
    storage_path: readerPath,
    file_name: 'lecteur.pdf',
    mime_type: 'application/pdf',
    size_bytes: 120,
    uploaded_by: '00000000-0000-0000-0000-000000000000',
  })
  .select('id');
check('insertion metadata refusée au lecteur', Boolean(readerInsert.error), 'ligne créée');

console.log('\n4. Dépôt réel par un rédacteur');
const editorPath = `verification/${stamp}-editeur.pdf`;
const editorBytes = samplePdf('editeur');
const editorUpload = await sessions.editor.storage
  .from('documents')
  .upload(editorPath, editorBytes, { contentType: 'application/pdf', upsert: false });
check('envoi Storage accepté au rédacteur', !editorUpload.error, editorUpload.error?.message);

let documentId = null;
if (!editorUpload.error) {
  const { data: row, error: insertError } = await sessions.editor
    .from('documents')
    .insert({
      title: `Vérification module Documents ${stamp}`,
      description: 'Créé par scripts/verifier-documents.mjs ; supprimé en fin de parcours.',
      category: 'Vérification',
      status: 'brouillon',
      storage_path: editorPath,
      file_name: 'verification.pdf',
      mime_type: 'application/pdf',
      size_bytes: editorBytes.byteLength,
      uploaded_by: users.editor.id,
    })
    .select('id')
    .single();
  check('insertion metadata acceptée au rédacteur', !insertError, insertError?.message);
  if (row) {
    documentId = row.id;
    created.push({ id: row.id, storagePath: editorPath });
  }
}

console.log('\n5. Téléchargement par URL signée');
if (documentId) {
  const signed = await sessions.editor.storage.from('documents').createSignedUrl(editorPath, 60);
  check('URL signée générée', Boolean(signed.data?.signedUrl), signed.error?.message);
  if (signed.data?.signedUrl) {
    const response = await fetch(signed.data.signedUrl);
    const bytes = new Uint8Array(await response.arrayBuffer());
    check('le fichier se télécharge (200)', response.status === 200, `statut ${response.status}`);
    check(
      'le contenu téléchargé est identique à l’envoyé',
      bytes.byteLength === editorBytes.byteLength &&
        bytes.every((byte, index) => byte === editorBytes[index]),
    );
  }
  const publicUrl = `${baseUrl}/storage/v1/object/public/documents/${editorPath}`;
  const publicResponse = await fetch(publicUrl);
  check(
    'aucune URL publique ne sert le fichier',
    publicResponse.status >= 400,
    `accès public en ${publicResponse.status}`,
  );
}

console.log('\n6. Modification');
if (documentId) {
  const { data: updated, error: updateError } = await sessions.editor
    .from('documents')
    .update({ title: `Titre modifié ${stamp}`, status: 'en_revue', category: 'Vérification' })
    .eq('id', documentId)
    .select('title, status');
  check(
    'le rédacteur modifie les métadonnées',
    !updateError && updated?.[0]?.status === 'en_revue',
    updateError?.message,
  );

  const { data: readerUpdate, error: readerUpdateError } = await sessions.reader
    .from('documents')
    .update({ title: 'Tentative du lecteur' })
    .eq('id', documentId)
    .select('id');
  check(
    'le lecteur ne modifie rien',
    Boolean(readerUpdateError) || (readerUpdate ?? []).length === 0,
    'modification acceptée',
  );
}

console.log('\n7. Suppression réservée à l’administrateur');
if (documentId) {
  const { data: editorDelete, error: editorDeleteError } = await sessions.editor
    .from('documents')
    .delete()
    .eq('id', documentId)
    .select('id');
  check(
    'le rédacteur ne supprime pas',
    Boolean(editorDeleteError) || (editorDelete ?? []).length === 0,
    'suppression acceptée',
  );

  const { error: adminDeleteError } = await sessions.admin
    .from('documents')
    .delete()
    .eq('id', documentId);
  const { data: gone } = await sessions.admin
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .maybeSingle();
  check('l’administrateur supprime la fiche', !adminDeleteError && gone === null, adminDeleteError?.message);

  const { error: storageDeleteError } = await sessions.admin.storage
    .from('documents')
    .remove([editorPath]);
  check('l’administrateur retire le fichier du bucket', !storageDeleteError, storageDeleteError?.message);

  const stillThere = await sessions.editor.storage
    .from('documents')
    .list('verification', { search: `${stamp}-editeur` });
  check(
    'le fichier a bien disparu du stockage',
    (stillThere.data ?? []).length === 0,
    `${(stillThere.data ?? []).length} objet(s) restant(s)`,
  );
}

// --- Nettoyage de sécurité --------------------------------------------------
for (const item of created) {
  await sessions.admin.from('documents').delete().eq('id', item.id);
  await sessions.admin.storage.from('documents').remove([item.storagePath]);
}

console.log(`\n${passed} vérification(s) réussie(s), ${failures.length} échec(s).`);
if (failures.length > 0) {
  console.log('Échecs :');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
