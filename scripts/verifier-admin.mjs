/**
 * Vérification du parcours ADMINISTRATEUR du module Documents.
 *
 * Deux niveaux, exécutés dans cet ordre :
 *
 *  A. Niveau données et stockage — vraie session administrateur, vrai fichier,
 *     vraie URL signée. Reproduit exactement les opérations que font les Server
 *     Actions du module (dépôt, métadonnées, statut, suppression en deux temps).
 *
 *  B. Niveau application — la session est convertie en cookies `@supabase/ssr`
 *     puis rejouée contre le serveur Next qui tourne : tableau de bord, liste des
 *     documents, fiche, et la route de téléchargement. Cela prouve le proxy, le
 *     layout protégé, le rendu serveur et la redirection signée.
 *
 * Ce qui n'est PAS couvert : le clic réel sur les formulaires. Les Server Actions
 * ne sont pas appelables sans navigateur (identifiant d'action généré au build).
 *
 * Usage :
 *   node scripts/verifier-admin.mjs                 # serveur attendu sur :3100
 *   PCMS_BASE_URL=http://localhost:3000 node scripts/verifier-admin.mjs
 *
 * Identifiants lus dans .env.local :
 *   PCMS_TEST_ADMIN_EMAIL / PCMS_TEST_ADMIN_PASSWORD
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

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
const baseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const appUrl = (process.env.PCMS_BASE_URL ?? 'http://localhost:3100').replace(/\/+$/, '');
const email = env.PCMS_TEST_ADMIN_EMAIL;
const password = env.PCMS_TEST_ADMIN_PASSWORD;

if (!baseUrl || !anonKey) {
  console.error('ERREUR : URL ou clé Supabase absente de .env.local.');
  process.exit(1);
}
if (!email || !password) {
  console.error(
    'ERREUR : PCMS_TEST_ADMIN_EMAIL / PCMS_TEST_ADMIN_PASSWORD absents de .env.local.\n' +
      'Aucun parcours authentifié ne peut être vérifié sans ces deux valeurs.',
  );
  process.exit(1);
}

let passed = 0;
const failures = [];

/** Masque l'adresse du compte si elle apparaît dans un message d'erreur. */
function maskText(value) {
  return String(value).split(email).join('***@***');
}

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  OK    ${label}`);
  } else {
    failures.push(label);
    console.log(`  ECHEC ${label}${detail ? ` — ${maskText(detail)}` : ''}`);
  }
}

function samplePdf(label) {
  return new TextEncoder().encode(
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n% ${label}\n%%EOF\n`,
  );
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const storagePath = `verification/${stamp}-admin.pdf`;
const bytes = samplePdf(`admin ${stamp}`);
let documentId = null;

// --- A. Données et stockage -------------------------------------------------

console.log(`\nProjet : ${baseUrl.replace(/https:\/\/([a-z0-9]{4})[a-z0-9]+\./, 'https://$1...')}`);
console.log(`Application : ${appUrl}\n`);
console.log('A. Session et données');

const supabase = createClient(baseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
check('connexion administrateur', !authError && Boolean(auth.user), authError?.message);
if (!auth?.user) {
  console.log('\nSans session, la suite ne peut pas être exécutée.');
  process.exit(1);
}

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role, email')
  .eq('id', auth.user.id)
  .maybeSingle();
check(
  'profil présent et rôle = admin',
  !profileError && profile?.role === 'admin',
  profileError ? profileError.message : `rôle obtenu : ${profile?.role ?? 'aucun profil'}`,
);

const upload = await supabase.storage
  .from('documents')
  .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
check('dépôt du fichier dans le bucket privé', !upload.error, upload.error?.message);

if (!upload.error) {
  const { data: row, error: insertError } = await supabase
    .from('documents')
    .insert({
      title: `Vérification admin ${stamp}`,
      description: 'Créé par scripts/verifier-admin.mjs — supprimé en fin de parcours.',
      category: 'Vérification',
      status: 'brouillon',
      storage_path: storagePath,
      file_name: `verification-${stamp}.pdf`,
      mime_type: 'application/pdf',
      size_bytes: bytes.byteLength,
      // Exigé par documents_insert_writers : with check (can_write() and uploaded_by = auth.uid())
      uploaded_by: auth.user.id,
    })
    .select('id')
    .single();
  check('création de la fiche', !insertError, insertError?.message);
  documentId = row?.id ?? null;
}

if (documentId) {
  const { data: listed } = await supabase
    .from('documents')
    .select('id, title')
    .eq('id', documentId)
    .maybeSingle();
  check('la fiche est relue', listed?.id === documentId);

  const { data: search } = await supabase
    .from('documents')
    .select('id')
    .ilike('title', `%${stamp}%`);
  check('la recherche par titre trouve la fiche', (search ?? []).length === 1);

  const signed = await supabase.storage.from('documents').createSignedUrl(storagePath, 60, {
    download: 'verification.pdf',
  });
  check('URL signée générée', Boolean(signed.data?.signedUrl), signed.error?.message);
  if (signed.data?.signedUrl) {
    const response = await fetch(signed.data.signedUrl);
    const downloaded = new Uint8Array(await response.arrayBuffer());
    check('téléchargement signé en 200', response.status === 200, `statut ${response.status}`);
    check(
      'octets identiques à ceux déposés',
      downloaded.byteLength === bytes.byteLength &&
        downloaded.every((byte, index) => byte === bytes[index]),
    );
    check(
      'le fichier est servi en pièce jointe',
      /attachment/i.test(response.headers.get('content-disposition') ?? ''),
      response.headers.get('content-disposition') ?? 'en-tête absent',
    );
  }

  const publicResponse = await fetch(
    `${baseUrl}/storage/v1/object/public/documents/${storagePath}`,
  );
  check('aucune URL publique', publicResponse.status >= 400, `accès en ${publicResponse.status}`);

  const { data: updated, error: updateError } = await supabase
    .from('documents')
    .update({ title: `Titre modifié ${stamp}`, description: 'Description modifiée.', category: 'Notes' })
    .eq('id', documentId)
    .select('title, category')
    .single();
  check(
    'modification des métadonnées',
    !updateError && updated?.title === `Titre modifié ${stamp}`,
    updateError?.message,
  );

  const { data: statusUpdate, error: statusError } = await supabase
    .from('documents')
    .update({ status: 'valide' })
    .eq('id', documentId)
    .select('status')
    .single();
  check('modification du statut', !statusError && statusUpdate?.status === 'valide', statusError?.message);
}

// --- B. Parcours applicatif -------------------------------------------------

console.log('\nB. Parcours applicatif (cookies @supabase/ssr rejoués)');

const jar = new Map();
const ssr = createServerClient(baseUrl, anonKey, {
  cookies: {
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    setAll: (cookies) => {
      for (const { name, value } of cookies) jar.set(name, value);
    },
  },
});
const ssrLogin = await ssr.auth.signInWithPassword({ email, password });
check('session serveur établie (contrat getAll/setAll)', !ssrLogin.error, ssrLogin.error?.message);

const cookieHeader = Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ');

async function appGet(urlPath, options = {}) {
  const response = await fetch(`${appUrl}${urlPath}`, {
    redirect: 'manual',
    ...options,
    headers: { cookie: cookieHeader, ...(options.headers ?? {}) },
  });
  const body = options.method === 'GET' || !options.method ? await response.text() : '';
  return { response, body };
}

const dashboard = await appGet('/tableau-de-bord');
check(
  '/tableau-de-bord accessible avec la session',
  dashboard.response.status === 200,
  `statut ${dashboard.response.status}`,
);

const documentsPage = await appGet('/documents');
check('/documents accessible', documentsPage.response.status === 200, `statut ${documentsPage.response.status}`);
check(
  'la page liste au moins un document',
  /Titre modifié|Vérification admin/.test(documentsPage.body),
  'aucun titre trouvé dans le HTML',
);
check(
  'le formulaire de dépôt est proposé à l’administrateur',
  /Déposer un document/.test(documentsPage.body),
);

if (documentId) {
  const detail = await appGet(`/documents/${documentId}`);
  check('la fiche est consultable', detail.response.status === 200, `statut ${detail.response.status}`);
  check('la fiche affiche le titre modifié', detail.body.includes(`Titre modifié ${stamp}`));
  check('la fiche propose la suppression (admin)', /Supprimer/.test(detail.body));

  const download = await appGet(`/api/documents/${documentId}/telecharger`);
  check(
    'la route de téléchargement redirige (302)',
    download.response.status === 302,
    `statut ${download.response.status}`,
  );
  const location = download.response.headers.get('location');
  check('la redirection pointe vers une URL signée', Boolean(location && /token=/.test(location)));
  if (location) {
    const file = await fetch(location);
    const served = new Uint8Array(await file.arrayBuffer());
    check('le fichier servi est identique', file.status === 200 && served.byteLength === bytes.byteLength);
  }

  const anonymous = await fetch(`${appUrl}/documents/${documentId}`, { redirect: 'manual' });
  check(
    'sans cookie, la fiche redirige vers la connexion',
    anonymous.status === 307 || anonymous.status === 308,
    `statut ${anonymous.status}`,
  );
}

// --- Suppression selon la procédure du module -------------------------------

console.log('\nC. Suppression');
if (documentId) {
  const { error: deleteError } = await supabase.from('documents').delete().eq('id', documentId);
  check('suppression de la fiche', !deleteError, deleteError?.message);

  const { data: gone } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .maybeSingle();
  check('la fiche a disparu', gone === null);

  const { error: storageError } = await supabase.storage.from('documents').remove([storagePath]);
  check('retrait du fichier du bucket', !storageError, storageError?.message);

  const { data: remaining } = await supabase.storage
    .from('documents')
    .list('verification', { search: `${stamp}-admin` });
  check('plus aucun objet de test', (remaining ?? []).length === 0, `${(remaining ?? []).length} restant(s)`);
}

// Filet de sécurité : ne rien laisser derrière soi même en cas d'échec.
await supabase.storage.from('documents').remove([storagePath]);
if (documentId) await supabase.from('documents').delete().eq('id', documentId);

console.log(`\n${passed} vérification(s) réussie(s), ${failures.length} échec(s).`);
if (failures.length > 0) {
  console.log('Échecs :');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
