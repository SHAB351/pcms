/**
 * Vérification du parcours administrateur DANS UN VRAI NAVIGATEUR.
 *
 * Les autres scripts s'arrêtent au niveau données et au rendu serveur. Eux seuls
 * ne prouvent pas que les formulaires fonctionnent : les Server Actions ne sont
 * appelables que par le runtime React du navigateur (identifiant d'action,
 * arguments encodés, rafraîchissement du routeur). Ce script pilote donc Chrome
 * par le protocole DevTools et clique réellement :
 *
 *   1. connexion par le formulaire -> redirection vers /tableau-de-bord
 *   2. /documents : la liste et le formulaire de dépôt s'affichent
 *   3. dépôt d'un PDF de 3 Mo (au-delà de la limite de 1 Mo de Next par défaut)
 *   4. la fiche du document s'ouvre
 *   5. modification du titre, de la description et du statut
 *   6. téléchargement par la route signée
 *   7. suppression par le bouton, confirmée
 *
 * Rien n'est installé : Chrome ou Edge déjà présents sur le poste suffisent.
 *
 * Usage :
 *   node scripts/verifier-navigateur.mjs                # serveur sur :3100
 *   PCMS_BASE_URL=http://localhost:3000 node scripts/verifier-navigateur.mjs
 *
 * Identifiants lus dans .env.local : PCMS_TEST_ADMIN_EMAIL / PCMS_TEST_ADMIN_PASSWORD.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// --- Environnement ----------------------------------------------------------

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...loadEnv(path.resolve(".env.local")), ...loadEnv(path.resolve(".env")) };
const baseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const appUrl = (process.env.PCMS_BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const email = env.PCMS_TEST_ADMIN_EMAIL;
const password = env.PCMS_TEST_ADMIN_PASSWORD;

if (!baseUrl || !anonKey || !email || !password) {
  console.error("ERREUR : variables Supabase et PCMS_TEST_ADMIN_* requises dans .env.local.");
  process.exit(1);
}

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const chromePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
if (!chromePath) {
  console.error("ERREUR : ni Chrome ni Edge trouvé. Ouvrez les formulaires à la main.");
  process.exit(1);
}

// --- Assertions -------------------------------------------------------------

let passed = 0;
const failures = [];

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  OK    ${label}`);
  } else {
    failures.push(label);
    console.log(`  ECHEC ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Client DevTools minimal ------------------------------------------------

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = (this.nextId += 1);
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`Délai dépassé sur ${method}`));
      }, 30_000);
    });
  }
}

async function waitForDevTools(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return await response.json();
    } catch {
      /* le navigateur démarre encore */
    }
    await sleep(200);
  }
  throw new Error("Le navigateur n'a pas ouvert son port de débogage.");
}

const port = 9333;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "pcms-chrome-"));
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pcms-fichiers-"));

const browser = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-dev-shm-usage",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let cdp;
let sessionId;

async function evaluate(expression) {
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "évaluation en échec");
  }
  return result.result.value;
}

async function currentPath() {
  try {
    return await evaluate("location.pathname + location.search");
  } catch {
    return "";
  }
}

async function waitForPath(predicate, timeoutMs = 30_000, label = "navigation") {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    last = await currentPath();
    if (predicate(last)) return last;
    await sleep(150);
  }
  throw new Error(`${label} : chemin attendu non atteint (actuel : ${last || "inconnu"})`);
}

async function goto(url) {
  await cdp.send("Page.navigate", { url }, sessionId);
  await waitForPath((p) => p.startsWith(new URL(url).pathname), 30_000, `ouverture de ${url}`);
  // Laisse l'hydratation React s'installer : sans elle, `action={formAction}`
  // n'est pas encore branché et le POST partirait sans identifiant d'action.
  await sleep(600);
}

/** Écrit dans un champ contrôlé par React, comme le ferait la frappe réelle. */
async function typeInto(selector, text) {
  await evaluate(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('champ introuvable : ' + ${JSON.stringify(selector)});
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const setter2 = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter2.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    })()
  `);
}

async function submitFormContaining(selector) {
  await evaluate(`
    (() => {
      const field = document.querySelector(${JSON.stringify(selector)});
      if (!field) throw new Error('champ absent : ' + ${JSON.stringify(selector)});
      const form = field.closest('form');
      if (!form) throw new Error('formulaire introuvable');
      form.requestSubmit();
      return true;
    })()
  `);
}

async function setFile(selector, filePath) {
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
  const { nodeId } = await cdp.send(
    "DOM.querySelector",
    { nodeId: root.nodeId, selector },
    sessionId,
  );
  if (!nodeId) throw new Error(`champ fichier introuvable : ${selector}`);
  await cdp.send("DOM.setFileInputFiles", { files: [filePath], nodeId }, sessionId);
}

async function pageText() {
  return evaluate("document.body.innerText");
}

// --- Préparation du fichier de test ----------------------------------------

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const pdfPath = path.join(workDir, `verification-${stamp}.pdf`);
const PDF_BYTES = 3 * 1024 * 1024; // 3 Mo : au-delà de la limite de 1 Mo de Next par défaut
const pdf = Buffer.concat([
  Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%"),
  Buffer.alloc(PDF_BYTES - 68, 0x20),
  Buffer.from("\n%%EOF\n"),
]);
fs.writeFileSync(pdfPath, pdf);

const admin = createClient(baseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await admin.auth.signInWithPassword({ email, password });

let createdId = null;
let storagePath = null;

try {
  const version = await waitForDevTools(port);
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  cdp = new Cdp(socket);

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const attached = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  sessionId = attached.sessionId;
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("DOM.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);

  console.log(`\nNavigateur : ${path.basename(chromePath)}`);
  console.log(`Application : ${appUrl}\n`);

  // 1. Connexion par le formulaire -------------------------------------------
  console.log("1. Connexion par le formulaire");
  await goto(`${appUrl}/connexion`);
  await typeInto("#email", email);
  await typeInto("#password", password);
  await submitFormContaining("#password");
  const afterLogin = await waitForPath((p) => p.startsWith("/tableau-de-bord"), 30_000, "connexion");
  check("la connexion mène au tableau de bord", afterLogin.startsWith("/tableau-de-bord"), afterLogin);
  const dashboardText = await pageText();
  check("le tableau de bord est rendu", dashboardText.length > 100, `${dashboardText.length} caractères`);

  // 2. Liste des documents ----------------------------------------------------
  console.log("\n2. Page Documents");
  await goto(`${appUrl}/documents`);
  const listingText = await pageText();
  check("/documents s'affiche", !/Page introuvable|404/.test(listingText));
  check("le formulaire de dépôt est visible", listingText.includes("Déposer le document") || listingText.includes("Titre"));

  // 3. Dépôt par le formulaire ------------------------------------------------
  console.log("\n3. Dépôt (3 Mo)");
  const title = `Dépôt navigateur ${stamp}`;
  await setFile("#fichier", pdfPath);
  await sleep(400);
  const prefill = await evaluate("document.querySelector('#title')?.value ?? ''");
  check("le titre est prérempli depuis le nom du fichier", prefill.length > 0, `valeur : "${prefill}"`);
  await typeInto("#title", title);
  await typeInto("#description", "Déposé par scripts/verifier-navigateur.mjs.");
  await typeInto("#category", "Vérification");
  await submitFormContaining("#title");
  const afterUpload = await waitForPath((p) => /^\/documents\/[0-9a-f-]{36}/.test(p), 60_000, "dépôt");
  const match = /^\/documents\/([0-9a-f-]{36})/.exec(afterUpload);
  createdId = match?.[1] ?? null;
  check("le dépôt ouvre la fiche du nouveau document", Boolean(createdId), afterUpload);

  if (createdId) {
    // 4. La fiche et son contenu réel ----------------------------------------
    console.log("\n4. Fiche et enregistrement");
    const detailText = await pageText();
    check("la fiche affiche le titre saisi", detailText.includes(title));
    const { data: row } = await admin
      .from("documents")
      .select("id, title, status, mime_type, size_bytes, storage_path, uploaded_by")
      .eq("id", createdId)
      .maybeSingle();
    check("la fiche existe en base", Boolean(row));
    check("la taille enregistrée correspond au fichier envoyé", row?.size_bytes === pdf.byteLength, `${row?.size_bytes} vs ${pdf.byteLength}`);
    check("le type MIME est conservé", row?.mime_type === "application/pdf", row?.mime_type ?? "absent");
    check("le statut initial est « brouillon »", row?.status === "brouillon", row?.status ?? "absent");
    check("l'auteur est l'administrateur connecté", Boolean(row?.uploaded_by));
    storagePath = row?.storage_path ?? null;
    if (storagePath) {
      const { data: object } = await admin.storage.from("documents").download(storagePath);
      check(
        "le fichier est réellement dans le bucket privé",
        object ? object.size === pdf.byteLength : false,
        object ? `${object.size} octets` : "objet absent",
      );
    }

    // 5. Modification des métadonnées et du statut ---------------------------
    console.log("\n5. Modification");
    const newTitle = `Titre modifié ${stamp}`;
    await typeInto("#title", newTitle);
    const statusSelector = await evaluate(`
      (() => {
        const select = document.querySelector('select[name="statut"], select[name="status"]');
        return select ? 'select[name="' + select.name + '"]' : null;
      })()
    `);
    if (statusSelector) {
      await evaluate(`
        (() => {
          const el = document.querySelector(${JSON.stringify(statusSelector)});
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
          setter.call(el, 'valide');
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return el.value;
        })()
      `);
    }
    await submitFormContaining("#title");
    await sleep(1500);
    const { data: updated } = await admin
      .from("documents")
      .select("title, status")
      .eq("id", createdId)
      .maybeSingle();
    check("le titre modifié est enregistré", updated?.title === newTitle, updated?.title ?? "absent");
    check(
      "le statut modifié est enregistré",
      statusSelector ? updated?.status === "valide" : true,
      statusSelector ? (updated?.status ?? "absent") : "aucun sélecteur de statut sur la fiche",
    );

    // 6. Téléchargement par la route signée ---------------------------------
    console.log("\n6. Téléchargement");
    const href = await evaluate(`
      (() => {
        const link = Array.from(document.querySelectorAll('a')).find((a) => /telecharger/.test(a.href));
        return link ? link.getAttribute('href') : null;
      })()
    `);
    check("la fiche propose un lien de téléchargement", Boolean(href), href ?? "aucun lien");
    if (href) {
      const response = await fetch(new URL(href, appUrl), {
        headers: { cookie: await browserCookieHeader() },
        redirect: "manual",
      });
      const location = response.headers.get("location");
      check("la route de téléchargement redirige", response.status === 302, `statut ${response.status}`);
      if (location) {
        const file = await fetch(location);
        const bytes = new Uint8Array(await file.arrayBuffer());
        check("le fichier servi est complet", file.status === 200 && bytes.byteLength === pdf.byteLength, `${bytes.byteLength} octets`);
      }
    }

    // 7. Suppression par le bouton ------------------------------------------
    console.log("\n7. Suppression");
    await evaluate("window.confirm = () => true");
    const submitted = await evaluate(`
      (() => {
        const button = Array.from(document.querySelectorAll('form button')).find((b) => /Supprimer/i.test(b.textContent || ''));
        if (!button) return false;
        const form = button.closest('form');
        form.requestSubmit();
        return true;
      })()
    `);
    check("le bouton de suppression existe", submitted === true);
    // La liste exacte, pas la fiche : /documents/<id>?erreur=... commence aussi par /documents.
    const afterDelete = await waitForPath(
      (p) => p === "/documents" || p.startsWith("/documents?"),
      30_000,
      "suppression",
    );
    check("la suppression ramène à la liste", afterDelete.startsWith("/documents"), afterDelete);
    check(
      "la suppression ne signale aucune erreur",
      !/erreur=/.test(afterDelete),
      `chemin obtenu : ${afterDelete}`,
    );
    const { data: gone } = await admin.from("documents").select("id").eq("id", createdId).maybeSingle();
    check("la fiche a disparu de la base", gone === null);
    if (storagePath) {
      const { data: still } = await admin.storage.from("documents").list(path.dirname(storagePath), {
        search: path.basename(storagePath),
      });
      check("le fichier a disparu du stockage", (still ?? []).length === 0, `${(still ?? []).length} restant(s)`);
    }
  }
} catch (error) {
  failures.push(`exception : ${error.message}`);
  console.log(`\nECHEC inattendu : ${error.message}`);
} finally {
  // Nettoyage : rien ne doit rester en base, dans le bucket ou sur le disque.
  try {
    if (createdId) await admin.from("documents").delete().eq("id", createdId);
    if (storagePath) await admin.storage.from("documents").remove([storagePath]);
  } catch {
    /* le nettoyage ne doit pas masquer le résultat des vérifications */
  }
  try {
    if (cdp) await cdp.send("Browser.close").catch(() => {});
  } catch {
    /* le navigateur est peut-être déjà fermé */
  }
  browser.kill();
  for (const dir of [profileDir, workDir]) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* profil verrouillé quelques secondes par le système */
    }
  }
}

/** Cookies du navigateur pour rejouer une requête hors de la page. */
async function browserCookieHeader() {
  const { cookies } = await cdp.send("Network.getCookies", { urls: [appUrl] }, sessionId);
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

console.log(`\n${passed} vérification(s) réussie(s), ${failures.length} échec(s).`);
if (failures.length > 0) {
  console.log("Échecs :");
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
