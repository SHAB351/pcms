/**
 * Vérification du module Assistant IA dans un vrai navigateur.
 *
 * Comme pour les documents, un appel forgé à une Server Action ne prouve rien :
 * seul le runtime React du navigateur exécute réellement `genererBrouillon`.
 * Le script pilote donc Chrome par le protocole DevTools et exerce le parcours
 * complet, y compris les règles qui vivent en base :
 *
 *   1. génération par le formulaire -> fiche du brouillon
 *   2. enregistrement en base (opération, statut, absence d'envoi externe)
 *   3. historique : une première version est écrite par le déclencheur
 *   4. soumission à relecture
 *   5. approbation par l'administrateur
 *   6. retouche du texte approuvé -> retour en brouillon (déclencheur SQL)
 *   7. suppression
 *
 * Prérequis : la migration 0003_assistant_ia.sql doit avoir été exécutée dans
 * le SQL Editor. Le script le dit clairement si ce n'est pas le cas.
 *
 * Usage :
 *   node scripts/verifier-assistant.mjs          # serveur attendu sur :3100
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

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
  console.error("ERREUR : ni Chrome ni Edge trouvé.");
  process.exit(1);
}

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
        if (message.error) reject(new Error(message.error.message));
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
      /* démarrage en cours */
    }
    await sleep(200);
  }
  throw new Error("Le navigateur n'a pas ouvert son port de débogage.");
}

// --- Prérequis : la migration doit être appliquée --------------------------

const admin = createClient(baseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await admin.auth.signInWithPassword({ email, password });

const probe = await admin.from("ai_drafts").select("operation, external_sent, warnings").limit(1);
if (probe.error) {
  console.error(
    "\nMIGRATION MANQUANTE : la table ai_drafts n'a pas encore les colonnes de l'assistant.\n" +
      "Exécutez supabase/migrations/0003_assistant_ia.sql dans le SQL Editor du projet,\n" +
      "puis relancez ce script.\n\nDétail : " +
      probe.error.message,
  );
  process.exit(2);
}

// --- Parcours ---------------------------------------------------------------

const port = 9333;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "pcms-chrome-"));
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
    "about:blank",
  ],
  { stdio: "ignore" },
);

let cdp;
let sessionId;
let draftId = null;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

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
  await sleep(600);
}

async function typeInto(selector, text) {
  await evaluate(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('champ introuvable : ' + ${JSON.stringify(selector)});
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    })()
  `);
}

async function setSelect(selector, value) {
  await evaluate(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('liste introuvable : ' + ${JSON.stringify(selector)});
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
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

async function clickButtonContaining(text) {
  return evaluate(`
    (() => {
      const button = Array.from(document.querySelectorAll('form button'))
        .find((candidate) => (candidate.textContent || '').includes(${JSON.stringify(text)}));
      if (!button) return false;
      button.closest('form').requestSubmit();
      return true;
    })()
  `);
}

async function pageText() {
  return evaluate("document.body.innerText");
}

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

  console.log(`\nApplication : ${appUrl}\n`);

  console.log("1. Connexion");
  await goto(`${appUrl}/connexion`);
  await typeInto("#email", email);
  await typeInto("#password", password);
  await submitFormContaining("#password");
  await waitForPath((p) => p.startsWith("/tableau-de-bord"), 30_000, "connexion");
  check("connexion administrateur", true);

  console.log("\n2. Page Assistant");
  await goto(`${appUrl}/assistant`);
  const page = await pageText();
  check("/assistant s'affiche", !/Page introuvable/.test(page));
  check(
    "la règle de confidentialité est affichée",
    /confidentialité/i.test(page),
    page.slice(0, 120),
  );
  check("le formulaire est proposé à l'administrateur", /Générer un brouillon/.test(page));

  console.log("\n3. Génération d'une correction");
  const title = `Correction assistant ${stamp}`;
  const source = "le conseil a approuvé le budget 2027, les travaux commencerons en janvier";
  await setSelect("#operation", "correction");
  await sleep(300);
  await typeInto("#title", title);
  await typeInto("#brief", "Corrige sans changer le sens.");
  await typeInto("#sourceText", source);
  await submitFormContaining("#title");
  const afterGenerate = await waitForPath(
    (p) => /^\/assistant\/[0-9a-f-]{36}/.test(p),
    60_000,
    "génération",
  );
  draftId = /^\/assistant\/([0-9a-f-]{36})/.exec(afterGenerate)?.[1] ?? null;
  check("la génération ouvre la fiche du brouillon", Boolean(draftId), afterGenerate);

  if (draftId) {
    console.log("\n4. Enregistrement et historique");
    const { data: row } = await admin
      .from("ai_drafts")
      .select("title, operation, status, external_sent, warnings, content, created_by, provider")
      .eq("id", draftId)
      .maybeSingle();
    check("le brouillon existe en base", Boolean(row));
    check("l'opération est enregistrée", row?.operation === "correction", row?.operation ?? "absent");
    check("le statut initial est « brouillon »", row?.status === "brouillon", row?.status ?? "absent");
    check("aucun envoi externe n'est consigné", row?.external_sent === false);
    check("le texte produit n'est pas vide", (row?.content ?? "").length > 0);
    check("des avertissements sont conservés", Array.isArray(row?.warnings) && row.warnings.length > 0);

    const { data: revisions } = await admin
      .from("ai_draft_revisions")
      .select("id, status, content")
      .eq("draft_id", draftId);
    check("l'historique contient la version initiale", (revisions ?? []).length === 1, `${(revisions ?? []).length} version(s)`);

    console.log("\n5. Soumission puis approbation");
    const submitted = await clickButtonContaining("Soumettre à relecture");
    check("le bouton de soumission existe", submitted === true);
    const afterSubmit = await waitForPath((p) => p.includes("soumis=1"), 30_000, "soumission");
    check("la soumission renvoie vers la fiche", afterSubmit.includes("soumis=1"), afterSubmit);
    const { data: pending } = await admin.from("ai_drafts").select("status").eq("id", draftId).maybeSingle();
    check("le statut passe en relecture", pending?.status === "en_revue", pending?.status ?? "absent");

    const approved = await clickButtonContaining("Approuver");
    check("le bouton d'approbation existe", approved === true);
    const afterApprove = await waitForPath((p) => p.includes("approuve=1"), 30_000, "approbation");
    check("l'approbation est enregistrée", afterApprove.includes("approuve=1"), afterApprove);
    const { data: decided } = await admin
      .from("ai_drafts")
      .select("status, reviewed_by, reviewed_at")
      .eq("id", draftId)
      .maybeSingle();
    check("le statut devient approuvé", decided?.status === "approuve", decided?.status ?? "absent");
    check("le relecteur est consigné", Boolean(decided?.reviewed_by) && Boolean(decided?.reviewed_at));

    console.log("\n6. Retouche d'un texte approuvé");
    await sleep(400);
    await typeInto("#draft-content", `${row?.content ?? ""}\n\nAjout manuel de relecture.`);
    await submitFormContaining("#draft-content");
    await sleep(2000);
    const { data: edited } = await admin
      .from("ai_drafts")
      .select("status, reviewed_by")
      .eq("id", draftId)
      .maybeSingle();
    check(
      "une retouche annule l'approbation (déclencheur SQL)",
      edited?.status === "brouillon" && edited?.reviewed_by === null,
      `statut ${edited?.status}, relecteur ${edited?.reviewed_by ?? "nul"}`,
    );
    const { data: after } = await admin
      .from("ai_draft_revisions")
      .select("id")
      .eq("draft_id", draftId);
    check("l'historique s'est enrichi", (after ?? []).length > (revisions ?? []).length, `${(after ?? []).length} versions`);

    console.log("\n7. Suppression");
    await evaluate("window.confirm = () => true");
    const removed = await clickButtonContaining("Supprimer");
    check("le bouton de suppression existe", removed === true);
    const afterDelete = await waitForPath(
      (p) => p === "/assistant" || p.startsWith("/assistant?"),
      30_000,
      "suppression",
    );
    check("la suppression ramène à la liste", afterDelete.startsWith("/assistant"), afterDelete);
    const { data: gone } = await admin.from("ai_drafts").select("id").eq("id", draftId).maybeSingle();
    check("la fiche a disparu", gone === null);
    const { data: orphans } = await admin
      .from("ai_draft_revisions")
      .select("id")
      .eq("draft_id", draftId);
    check("l'historique a disparu avec elle", (orphans ?? []).length === 0);
    draftId = null;
  }
} catch (error) {
  failures.push(`exception : ${error.message}`);
  console.log(`\nECHEC inattendu : ${error.message}`);
} finally {
  try {
    if (draftId) await admin.from("ai_drafts").delete().eq("id", draftId);
  } catch {
    /* le nettoyage ne doit pas masquer le résultat */
  }
  try {
    if (cdp) await cdp.send("Browser.close").catch(() => {});
  } catch {
    /* déjà fermé */
  }
  browser.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    /* profil verrouillé quelques secondes */
  }
}

console.log(`\n${passed} vérification(s) réussie(s), ${failures.length} échec(s).`);
if (failures.length > 0) {
  console.log("Échecs :");
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
