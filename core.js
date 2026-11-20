// F.R.I.D.A.Y. web — core: sign-in, the synced data, the app shell and the UI kit.
// Screens live in views/*.js and register with F.view(...). Everything mirrors the iPhone app (FridayApp/Friday).
// Data lives in the private GitHub repo friday-sync as one encrypted file shared with the app (see CONTRACT.md).
"use strict";

const F = (() => {
  const CONFIG = { owner: "josejlrdesigner-stack", syncRepo: "friday-sync", webRepo: "friday-web", dataPath: "friday-sync.json", mailPath: "friday-mail.json", authIter: 600000 };
  const REF_EPOCH = 978307200;
  const DEMO = new URLSearchParams(location.search).has("demo");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uuid = () => crypto.randomUUID().toUpperCase();
  const nowSec = () => Date.now() / 1000;

  const S = {
    creds: null, password: null, dataKey: null, salt: null,
    payload: null, sha: null, mail: null, mailSha: null,
    devices: null, status: null, loading: false, error: null, lastLoad: 0,
    tab: "brief",
  };

  // ------------------------------------------------------------ dates
  const pad = (n) => String(n).padStart(2, "0");
  const D = {
    key: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    parse: (k) => (k ? new Date(k + "T00:00") : null),
    start: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    add: (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n),
    same: (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(),
    fromEpoch: (s) => (s == null ? null : new Date(s * 1000)),
    fromRef: (s) => (s == null ? null : new Date((s + REF_EPOCH) * 1000)),
    toRef: (d) => d.getTime() / 1000 - REF_EPOCH,
    weekStart: (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return new Date(x.getFullYear(), x.getMonth(), x.getDate() - x.getDay()); },
    time: (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    hhmm: (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    wide: (d) => d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }),
    short: (d) => d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
    md: (d) => d.toLocaleDateString([], { month: "short", day: "numeric" }),
    wd: (d) => d.toLocaleDateString([], { weekday: "long" }),
    wdShort: (d) => d.toLocaleDateString([], { weekday: "short" }),
    daysBetween: (a, b) => Math.round((D.start(b) - D.start(a)) / 86400000),
    ago(d) {
      const m = Math.round((Date.now() - d.getTime()) / 60000);
      if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
      const h = Math.round(m / 60); if (h < 36) return `${h} hour${h === 1 ? "" : "s"} ago`;
      return `${Math.round(h / 24)} days ago`;
    },
  };

  // ------------------------------------------------------------ GitHub
  async function gh(path, opts = {}, auth = true) {
    return fetch("https://api.github.com/" + path, {
      cache: "no-store", ...opts,
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
                 ...(auth && S.creds?.token ? { Authorization: "Bearer " + S.creds.token } : {}), ...(opts.headers || {}) },
    });
  }
  async function getFile(repo, path, auth = true) {
    const r = await gh(`repos/${CONFIG.owner}/${repo}/contents/${path}?t=${Date.now()}`, {}, auth);
    if (r.status === 404) return null;
    if (r.status === 401) throw new Error("expired-key");
    if (!r.ok) throw new Error(`GitHub said ${r.status}`);
    const j = await r.json();
    let text;
    if (j.content && j.encoding === "base64") text = FCrypto.dec.decode(FCrypto.unb64(j.content));
    else {   // over 1 MB: fetch the raw bytes
      const raw = await gh(`repos/${CONFIG.owner}/${repo}/contents/${path}?t=${Date.now()}`, { headers: { Accept: "application/vnd.github.raw+json" } }, auth);
      text = await raw.text();
    }
    return { sha: j.sha, text };
  }
  async function putFile(repo, path, text, sha, message) {
    const body = { message, content: FCrypto.b64(FCrypto.enc.encode(text)) };
    if (sha) body.sha = sha;
    const r = await gh(`repos/${CONFIG.owner}/${repo}/contents/${path}`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    if (r.status === 409 || r.status === 422) throw new Error("conflict");
    if (r.status === 401 || r.status === 403) throw new Error("expired-key");
    if (!r.ok) throw new Error(`GitHub said ${r.status}`);
    return (await r.json()).content.sha;
  }

  // ------------------------------------------------------------ session + sign-in
  function saveSession(remember) {
    const s = JSON.stringify({ creds: S.creds, dataKey: S.dataKey && FCrypto.b64(S.dataKey), salt: S.salt && FCrypto.b64(S.salt) });
    try { (remember ? localStorage : sessionStorage).setItem("friday.session", s); } catch {}
  }
  function loadSession() {
    try {
      const s = sessionStorage.getItem("friday.session") || localStorage.getItem("friday.session");
      if (!s) return false;
      const j = JSON.parse(s);
      S.creds = j.creds; S.dataKey = j.dataKey ? FCrypto.unb64(j.dataKey) : null; S.salt = j.salt ? FCrypto.unb64(j.salt) : null;
      return !!S.creds;
    } catch { return false; }
  }
  function signOut() {
    try { sessionStorage.removeItem("friday.session"); localStorage.removeItem("friday.session"); } catch {}
    Object.assign(S, { creds: null, password: null, dataKey: null, salt: null, payload: null, sha: null, mail: null });
    location.hash = ""; boot();
  }
  async function fetchAuth() { const f = await getFile(CONFIG.webRepo, "auth.json", false); return f ? JSON.parse(f.text) : null; }
  async function signIn(username, password, remember) {
    const auth = await fetchAuth();
    if (!auth) throw new Error("not-set-up");
    const u = username.trim().toLowerCase();
    const entry = auth.users[await FCrypto.sha256hex(u)];
    if (!entry) throw new Error("wrong-password");
    const key = await FCrypto.deriveKey(u + "\n" + password, FCrypto.unb64(entry.salt), auth.iter || CONFIG.authIter);
    S.creds = JSON.parse(FCrypto.dec.decode(await FCrypto.open(JSON.stringify({ v: 1, salt: entry.salt, data: entry.data }), key)));
    S.password = password;
    await load();
    saveSession(remember);
  }
  async function setup(f) {
    if (f.p !== f.p2) throw new Error("The two passwords don't match.");
    if (f.p.length < 12) throw new Error("Use at least 12 characters.");
    S.creds = { token: f.token.trim(), owner: CONFIG.owner, repo: CONFIG.syncRepo };
    const r = await gh(`repos/${CONFIG.owner}/${CONFIG.syncRepo}`);
    if (r.status === 401) { S.creds = null; throw new Error("GitHub didn't accept that access key. Copy it again."); }
    if (!r.ok) { S.creds = null; throw new Error("That key can't see friday-sync. Check step 2."); }
    const u = f.u.trim().toLowerCase(), salt = FCrypto.random(16);
    const key = await FCrypto.deriveKey(u + "\n" + f.p, salt, CONFIG.authIter);
    const sealed = JSON.parse(await FCrypto.seal(FCrypto.enc.encode(JSON.stringify(S.creds)), key, salt));
    const cur = await getFile(CONFIG.webRepo, "auth.json").catch(() => null);
    const auth = cur ? JSON.parse(cur.text) : { v: 1, iter: CONFIG.authIter, users: {} };
    auth.users[await FCrypto.sha256hex(u)] = { salt: sealed.salt, data: sealed.data };
    try { await putFile(CONFIG.webRepo, "auth.json", JSON.stringify(auth, null, 1), cur?.sha, "Sign-in for F.R.I.D.A.Y."); }
    catch (e) { S.creds = null; throw new Error(e.message === "expired-key" ? "That key can't save to friday-web. Check steps 2 and 3." : e.message); }
    S.password = f.p;
    await load().catch(() => {});
    saveSession(false);
  }

  // ------------------------------------------------------------ load / write
  async function decryptFile(f) {
    const salt = FCrypto.saltOf(f.text);
    if (!S.dataKey || !S.salt || FCrypto.b64(salt) !== FCrypto.b64(S.salt)) {
      if (!S.password) throw new Error("need-password");
      S.dataKey = await FCrypto.deriveKey(S.password, salt); S.salt = salt;
    }
    return JSON.parse(FCrypto.dec.decode(await FCrypto.open(f.text, S.dataKey)));
  }
  async function load() {
    if (DEMO) { if (!S.payload) { S.payload = window.FDemo?.payload() || {}; S.mail = window.FDemo?.mail() || null; S.devices = window.FDemo?.devices() || null; } S.lastLoad = Date.now(); return; }
    S.loading = true;
    try {
      const f = await getFile(CONFIG.syncRepo, CONFIG.dataPath);
      if (!f) { S.payload = null; S.sha = null; }
      else { S.payload = await decryptFile(f); S.sha = f.sha; if (S.password) saveSession(!!localStorage.getItem("friday.session")); }
      const [m, d, st] = await Promise.all([
        getFile(CONFIG.syncRepo, CONFIG.mailPath).catch(() => null),
        getFile(CONFIG.syncRepo, "update/devices.json").catch(() => null),
        getFile(CONFIG.syncRepo, "update/status.json").catch(() => null)]);
      if (m && S.dataKey) { try { S.mail = await decryptFile(m); S.mailSha = m.sha; } catch { S.mail = null; } }
      S.devices = d ? JSON.parse(d.text) : null;
      S.status = st ? JSON.parse(st.text) : null;
      S.error = null; S.lastLoad = Date.now();
    } catch (e) { S.error = e.message; if (["wrong-password", "need-password", "expired-key"].includes(e.message)) throw e; }
    finally { S.loading = false; }
  }
  /** Change one section the website owns (queue, webchat, prefs), re-reading first so nothing from the phone is lost. */
  async function writeSection(name, mutate) {
    if (DEMO) { S.payload[name] = { stamp: nowSec(), value: mutate(structuredClone(S.payload[name]?.value)) }; return; }
    for (let i = 0; i < 4; i++) {
      const f = await getFile(CONFIG.syncRepo, CONFIG.dataPath);
      if (!f) throw new Error("Your iPhone hasn't connected yet. Sign in on the iPhone first.");
      const p = await decryptFile(f);
      p[name] = { stamp: nowSec(), value: mutate(structuredClone(p[name]?.value)) };
      p.device = "Website";
      try {
        S.sha = await putFile(CONFIG.syncRepo, CONFIG.dataPath, await FCrypto.seal(FCrypto.enc.encode(JSON.stringify(p)), S.dataKey, S.salt), f.sha, "F.R.I.D.A.Y. web");
        S.payload = p; return;
      } catch (e) { if (e.message !== "conflict") throw e; }
    }
    throw new Error("Another device kept saving at the same moment. Try again.");
  }

  // ------------------------------------------------------------ the data (read side)
  const snap = () => S.payload?.snapshot?.value || null;
  const applied = () => new Set(snap()?.applied || []);
  const queue = () => (S.payload?.queue?.value || []).filter((c) => !applied().has(c.id));
  const prefs = () => S.payload?.prefs?.value || {};
  /** A Task Engine rule (the app's @AppStorage bools, synced as prefs "1"/"0"). */
  const rule = (k, def) => { const v = prefs()[k]; return v == null ? def : v === "1" || v === "true"; };
  function planner() { try { return JSON.parse(prefs().franklinPlanner || "null"); } catch { return null; } }

  /** Open + done to-dos, with the website's not-yet-applied changes laid over them (marked pending). */
  function todos() {
    const s = snap(); if (!s) return [];
    const q = queue();
    const byId = new Map();
    const conv = (t, done) => ({ ...t, due: D.fromEpoch(t.due), done, fc: { letter: t.letter || null, number: t.number ?? null, quadrant: t.quadrant ?? null, role: t.role || null, bigRock: !!t.bigRock, inProgress: !!t.inProgress, delegate: t.delegate || null, goal: t.goal || null } });
    for (const t of s.todos || []) byId.set(t.id, conv(t, false));
    for (const t of s.done || []) byId.set(t.id, conv(t, true));
    for (const c of q) {
      const t = c.todoID && byId.get(c.todoID);
      switch (c.kind) {
        case "add_todo": byId.set(c.id, { id: c.id, title: c.title, list: c.list || defaultList(), due: c.due ? new Date(c.due + "T" + (c.time || "00:00")) : null, dueHasTime: !!c.time,
          notes: c.notes || "", done: false, pending: true, repeats: !!(c.repeat && c.repeat !== "never"), important: !!c.important,
          fc: { letter: c.letter || null, number: c.letter ? (c.number || 1) : null, quadrant: c.quadrant ?? null, role: c.role || null, bigRock: !!c.bigRock, inProgress: false, delegate: null, goal: c.goal || null } }); break;
        case "complete_todo": if (t) { t.done = true; t.pending = true; } break;
        case "uncomplete_todo": if (t) { t.done = false; t.pending = true; } break;
        case "delete_todo": if (t) byId.delete(c.todoID); break;
        case "move_todo": if (t) { t.due = c.due ? new Date(c.due + "T00:00") : null; t.dueHasTime = false; t.pending = true;
          // Store.moveTodo: moved to another day it is re-prioritized there, unless the Task Engine rule keeps letters
          if (!rule("forwardKeepsLetter", false) && (!t.due || !D.same(t.due, new Date()))) t.fc = { ...t.fc, letter: null, number: null }; } break;
        case "set_franklin": if (t) { t.fc = { ...t.fc, ...c.meta }; t.pending = true; } break;
        case "update_todo": if (t) { Object.assign(t, { title: c.title ?? t.title, list: c.list ?? t.list, notes: c.notes ?? t.notes, important: c.important ?? t.important,
          due: c.hasDue === false ? null : c.due ? new Date(c.due + "T" + (c.time || "00:00")) : t.due, dueHasTime: c.hasDue === false ? false : (c.time ? true : (c.due ? false : t.dueHasTime)) });
          if (c.fc) t.fc = { ...t.fc, ...c.fc }; if (c.repeat) t.repeats = c.repeat !== "never"; t.pending = true; } break;
        case "forward_todos": for (const id of c.ids || []) { const x = byId.get(id); if (x) { x.due = c.due ? new Date(c.due + "T00:00") : null; x.dueHasTime = false; if (!c.keepLetter && !rule("forwardKeepsLetter", false)) { x.fc = { ...x.fc, letter: null, number: null }; } if (c.inProgress) x.fc.inProgress = true; x.pending = true; } } break;
        case "renumber": (c.ids || []).forEach((id, i) => { const x = byId.get(id); if (x) { x.fc = { ...x.fc, letter: c.letter, number: i + 1 }; x.pending = true; } }); break;
      }
    }
    return [...byId.values()];
  }
  function events() {
    const s = snap(); if (!s) return [];
    let list = (s.events || []).map((e) => ({ ...e, start: D.fromEpoch(e.start), end: D.fromEpoch(e.end) }));
    for (const c of queue()) {
      if (c.kind === "add_event") list.push({ id: c.id, itemID: c.id, title: c.title, start: D.fromEpoch(c.start), end: D.fromEpoch(c.end), allDay: !!c.allDay, location: c.location || "", calendar: c.calendar || "", notes: c.notes || "", pending: true });
      if (c.kind === "delete_event") list = list.filter((e) => !(e.itemID === c.itemID && (c.allFuture ? e.start.getTime() / 1000 >= c.occurrenceStart - 1 : Math.abs(e.start.getTime() / 1000 - c.occurrenceStart) < 2)));
      if (c.kind === "update_event") list = list.map((e) => (e.itemID === c.itemID && Math.abs(e.start.getTime() / 1000 - c.occurrenceStart) < 2)
        ? { ...e, title: c.title ?? e.title, start: c.start ? D.fromEpoch(c.start) : e.start, end: c.end ? D.fromEpoch(c.end) : e.end, allDay: c.allDay ?? e.allDay, location: c.location ?? e.location, notes: c.notes ?? e.notes, pending: true } : e);
    }
    const hidden = new Set(prefsHiddenCalendars());
    return list.filter((e) => !e.calendarID || !hidden.has(e.calendarID)).sort((a, b) => a.start - b.start);
  }
  const prefsHiddenCalendars = () => (prefs().hiddenCalendars || "").split("\n").filter(Boolean);
  const defaultList = () => (snap()?.lists || []).map((l) => (typeof l === "string" ? l : l.title)).includes("Task Dump") ? "Task Dump" : ((snap()?.lists?.[0]?.title || snap()?.lists?.[0]) || "Task Dump");
  const lists = () => (snap()?.lists || []).map((l) => (typeof l === "string" ? { title: l, color: "#767E8A" } : l));
  const calendars = () => snap()?.calendars || [];
  const sortKey = (t) => [{ A: 0, B: 1, C: 2 }[t.fc?.letter] ?? 3, t.fc?.number ?? 999];
  const byPriority = (a, b) => { const x = sortKey(a), y = sortKey(b); return x[0] - y[0] || x[1] - y[1] || (a.due ?? 0) - (b.due ?? 0); };

  // ------------------------------------------------------------ the data (write side)
  /** Queue a change for the iPhone/iPad app to apply (see CONTRACT.md for every kind). */
  async function cmd(kind, payload = {}, toastText) {
    const c = { id: uuid(), at: nowSec(), kind, ...payload };
    await writeSection("queue", (v) => [...(v || []).filter((x) => !applied().has(x.id)), c]);
    if (toastText) toast(toastText);
    render();
    return c;
  }
  async function savePlanner(mutate) {
    await writeSection("prefs", (v) => { v = v || {}; const p = JSON.parse(v.franklinPlanner || "{}"); mutate(p); v.franklinPlanner = JSON.stringify(p); return v; });
    render();
  }
  async function setPref(key, value) {
    await writeSection("prefs", (v) => { v = v || {}; if (value == null) delete v[key]; else v[key] = String(value); return v; });
    render();
  }

  // ------------------------------------------------------------ icons (SF Symbols look-alikes, 24-grid strokes)
  const ICONS = {
    "square.grid.2x2": '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13h1M11.5 13h1M15.5 13h1M7.5 16.5h1M11.5 16.5h1" stroke-width="2"/>',
    checklist: '<path d="M3.5 6.5l1.6 1.6L8 5.2M3.5 16.5l1.6 1.6L8 15.2"/><path d="M11 7h9.5M11 17h9.5"/>',
    envelope: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    gearshape: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.4 2.4 2.7-.7.7 2.7 2.4 1.4-1.2 2.4 1.2 2.4-2.4 1.4-.7 2.7-2.7-.7L12 21.2l-1.4-2.4-2.7.7-.7-2.7-2.4-1.4L6 12 4.8 9.6l2.4-1.4.7-2.7 2.7.7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    "chevron.left": '<path d="M15 5l-7 7 7 7"/>', "chevron.right": '<path d="M9 5l7 7-7 7"/>', "chevron.down": '<path d="M5 9l7 7 7-7"/>', "chevron.up": '<path d="M5 15l7-7 7 7"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    magnifyingglass: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
    "flag.fill": '<path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="currentColor"/>', flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
    archivebox: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10.5h14V9M10 13h4"/>',
    "arrowshape.turn.up.left": '<path d="M10 5L4 11l6 6M4 11h10a6 6 0 0 1 6 6v2"/>',
    "arrowshape.turn.up.left.2": '<path d="M12 5L6 11l6 6M6 11h8a6 6 0 0 1 6 6v2M8 5L2 11l6 6"/>',
    "arrowshape.turn.up.right": '<path d="M14 5l6 6-6 6M20 11H10a6 6 0 0 0-6 6v2"/>',
    "ellipsis.circle": '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="16" cy="12" r="1" fill="currentColor"/>',
    ellipsis: '<circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/>',
    "square.and.pencil": '<path d="M11 4H5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 5 20h13a1.5 1.5 0 0 0 1.5-1.5V13"/><path d="M17.5 3.5l3 3L12 15l-4 1 1-4z"/>',
    pencil: '<path d="M16.5 3.5l4 4L8 20H4v-4z"/>',
    xmark: '<path d="M6 6l12 12M18 6L6 18"/>', "xmark.circle.fill": '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="M9 9l6 6M15 9l-6 6" stroke="#fff"/>',
    checkmark: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    "exclamationmark.triangle.fill": '<path d="M12 3.5l9.5 16.5h-19z" fill="currentColor" stroke="none"/><path d="M12 9.5v5" stroke="#fff" stroke-width="2"/><circle cx="12" cy="17.3" r="1.1" fill="#fff" stroke="none"/>',
    "arrow.right": '<path d="M5 12h14M13 6l6 6-6 6"/>', "arrow.left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    "arrow.triangle.2.circlepath": '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
    "checklist.checked": '<path d="M3.5 6.5l1.6 1.6L8 5.2M3.5 16.5l1.6 1.6L8 15.2"/><path d="M11 7h9.5M11 17h9.5"/>',
    "person.2": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14a6.5 6.5 0 0 1 4 6"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    "square.grid.2x2.matrix": '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/>',
    "bolt.shield": '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M13 7l-3.5 5.5h3L11 17l3.5-5.5h-3z"/>',
    sunrise: '<path d="M3 18h18M6.5 14.5a5.5 5.5 0 0 1 11 0M12 3.5V8M9.5 6L12 3.5 14.5 6M4.2 10.2l1.4 1.4M18.4 11.6l1.4-1.4M7 21h10"/>',
    "sun.max": '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    "sunset": '<path d="M3 18h18M6.5 14.5a5.5 5.5 0 0 1 11 0M12 8V3.5M9.5 6L12 8.5 14.5 6M7 21h10"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    paperclip: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h5l2 2.5h8A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    tray: '<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1.5 2.5h5L16 13h5"/>',
    "envelope.badge": '<rect x="3" y="5.5" width="15" height="13" rx="2"/><path d="M3.5 6.5l7 5.5 7-5.5"/><circle cx="19.5" cy="5.5" r="3" fill="currentColor"/>',
    "text.alignleft": '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    "pencil.and.outline": '<path d="M15 4l4 4-9 9H6v-4zM4 21h16"/>',
    "doc.plaintext": '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h4"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.8"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
    "arrow.uturn.backward": '<path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    "list.bullet": '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>',
    "person.crop.rectangle.stack": '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M7 3.5h10"/><circle cx="12" cy="11.5" r="2.5"/><path d="M8 17.5a4 4 0 0 1 8 0"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    "arrow.up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "mountain.2": '<path d="M2.5 19l6-10 4 6 2.5-3.5 6.5 7.5z"/>',
    "circle.grid.cross": '<circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="12" r="2"/>',
    "icloud": '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9a4.8 4.8 0 0 1-.5 9.5z"/>',
    "lock": '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    "cpu": '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    "waveform": '<path d="M3 12h1.5M6.5 8v8M10 5v14M13.5 9v6M17 7v10M20.5 11v2"/>',
    "dot": '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
    "arrow.counterclockwise": '<path d="M4 4v5h5"/><path d="M4.6 9A8 8 0 1 1 4 13"/>',
    "figure.and.child.holdinghands": '<circle cx="8" cy="4.5" r="2"/><circle cx="17" cy="8" r="1.6"/><path d="M8 7v7M8 14l-2 6M8 14l2 6M5 10l3-2 4 3 3-1.5M17 10v5M17 15l-1.5 5M17 15l1.5 5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 12.5h18"/>',
    lightbulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    graduationcap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6"/>',
  };
  // Custom section icons (Design-Spec-Glow): stroke 1.8, round caps; the accent ("spark") carries .spk-f / .spk-s and follows --spark.
  Object.assign(ICONS, {
    brief: '<path d="M3 17.5h18"/><path class="spk-f" d="M7 17.5a5 5 0 0 1 10 0z"/><path d="M12 5v2.5M5.6 9.1l1.6 1.6M18.4 9.1l-1.6 1.6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle class="spk-f" cx="15.5" cy="15" r="2"/>',
    checklist: '<rect x="3.5" y="5.5" width="14" height="14" rx="3.5"/><path class="spk-s" d="M7.5 12.2l3 3 10-10.7"/>',
    envelope: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/><circle class="spk-f" cx="19.5" cy="6" r="2.6"/>',
    friday: '<circle cx="12" cy="12" r="10" stroke="url(#fg-fri)"/><path d="M15.5 12l-1.75 3.03h-3.5L8.5 12l1.75-3.03h3.5z" fill="#00D4FF" stroke="none"/>',
    "mountain.2": '<path d="M3 19.5l5.5-9 3.5 5 3-4 6 8z"/><circle class="spk-f" cx="18.5" cy="5.5" r="2"/>',
    flame: '<path class="spk-fs" d="M12 3c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.8-4.6 2.8-5.6 0 1.8.9 2.8 1.9 2.8 0-2.8-1-5.6.8-8.2z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/><circle class="spk-f" cx="12" cy="12" r="1.3"/>',
    "arrow.triangle.2.circlepath": '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path class="spk-s" d="M17.8 3.5v3.6h-3.6M6.2 20.5v-3.6h3.6"/>',
    gearshape: '<path d="M4 7.5h9M18 7.5h2M4 16.5h3M11 16.5h9"/><circle cx="15.5" cy="7.5" r="2.3"/><circle class="spk-f" cx="9" cy="16.5" r="2.3"/>',
  });
  /** The section a screen belongs to → its custom icon. */
  const SEC_ICON = { brief: "brief", calendar: "calendar", tasks: "checklist", mail: "envelope", settings: "gearshape", friday: "friday", health: "mountain.2" };
  /** One shared gradient for the Friday ring (inline SVGs point at it by id). */
  function ensureDefs() {
    if (document.getElementById("fg-defs") || !document.body) return;
    document.body.insertAdjacentHTML("afterbegin", '<svg id="fg-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs><linearGradient id="fg-fri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00D4FF"/><stop offset="1" stop-color="#9D00FF"/></linearGradient><linearGradient id="fg-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00D4FF"/><stop offset=".55" stop-color="#9D00FF"/><stop offset="1" stop-color="#FF0080"/></linearGradient><linearGradient id="fg-sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD700"/><stop offset="1" stop-color="#FF6B00"/></linearGradient></defs></svg>');
  }
  const icon = (name, attrs = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${ICONS[name] || ICONS.dot}</svg>`;
  const addIcons = (o) => Object.assign(ICONS, o);

  // ------------------------------------------------------------ colour tokens for SVG/canvas drawing
  // Read the :root custom properties once (style.css is the single source); the hex is only a fallback.
  let TOK = null;
  const tok = () => {
    if (TOK) return TOK;
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fb) => { const x = cs.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fb; };
    const t = { friday: v("--core", "#00B8D9"), fridayLight: v("--friday-light", "#00D4FF"), gold: v("--core2", "#9D00FF"), hairline: v("--line", "#DDD0F0"), panel: v("--panel", "#FFFFFF") };
    if (cs.getPropertyValue("--core").trim()) TOK = t;   // cache only once style.css has loaded
    return t;
  };
  /** MailAccount.palette — the one shared account palette. Used only for the 8px account dot. */
  const ACCOUNT_PALETTE = ["#6D28D9", "#57534E", "#9D174D", "#3F3F46", "#86198F", "#475569"];
  const accountColor = (colorIndex) => { const n = ACCOUNT_PALETTE.length, i = Number(colorIndex) || 0; return ACCOUNT_PALETTE[((i % n) + n) % n]; };

  // ------------------------------------------------------------ role colors (Color spec 2026-11-18)
  /** A role's place in the planner's roles list (case-insensitive name match), or -1. Same order on every device. */
  function roleIndex(name) {
    const n = String(name || "").trim().toLowerCase(); if (!n) return -1;
    return (planner()?.roles || []).findIndex((r) => String(r?.name || "").trim().toLowerCase() === n);
  }
  /** Glow spec role palette: [fill, text, soft] — same order as --role0…7 in style.css */
  const ROLE_HUES = [["#FF0080", "#A0145F", "#FFE0EF"], ["#00B8D9", "#0A6573", "#D6F5FA"], ["#9D00FF", "#6A00B0", "#EFDDFF"], ["#0063FF", "#0055C4", "#DCE8FF"],
    ["#FF6B00", "#B35400", "#FFE6D3"], ["#8AA600", "#4F6400", "#EAF2C2"], ["#A2845E", "#694F2E", "#EDE1CF"], ["#4A2D8A", "#4A2D8A", "#E8E0F5"]];
  /** "rcN" for a role name (wraps after 8), "" when it isn't one of the roles. */
  const roleClass = (name) => { const i = roleIndex(name); return i < 0 ? "" : "rc" + (i % ROLE_HUES.length); };
  /** {fill, dark, tint} hex colors for a role name, or null. */
  const roleColor = (name) => { const i = roleIndex(name); if (i < 0) return null; const [fill, dark, tint] = ROLE_HUES[i % ROLE_HUES.length]; return { fill, dark, tint, next: ROLE_HUES[(i + 1) % ROLE_HUES.length][0], index: i }; };

  // ------------------------------------------------------------ UI kit (HTML strings; every piece mirrors a SwiftUI component)
  const attrs = (o = {}) => Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(" ");
  const data = (o = {}) => Object.entries(o).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ");
  const ui = {
    esc, icon, attrs,
    /** btn({label, icon, kind: primary|secondary|small|destructive|icon|link, act, data, disabled, title, wide, type}) */
    btn(o) {
      const cls = ["btn", o.kind === "small" ? "small" : o.kind || "", o.filled ? "filled" : "", o.wide ? "wide" : "", o.cls || ""].join(" ").trim();
      return `<button type="${o.type || "button"}" class="${cls}" ${o.act ? `data-act="${esc(o.act)}"` : ""} ${data(o.data)} ${attrs({ disabled: o.disabled, "aria-label": o.aria || (o.kind === "icon" ? o.title || o.label : null), title: o.title })}>${o.icon ? icon(o.icon) : ""}${o.kind === "icon" ? "" : (o.labelHTML ?? (o.icon && o.label ? `<span class="btn-l">${esc(o.label)}</span>` : esc(o.label ?? "")))}</button>`;
    },
    label2: (text, cls = "") => `<span class="label2 ${cls}">${esc(text)}</span>`,
    /** The Compass line (mockup band): COMPASS · "Today I act as " · the phrase in bold. Same on every screen. */
    compass: (text, { band = false, label = "Compass", placeholder = "" } = {}) => {
      const rest = String(text || "").trim().replace(/^(today i act as|i act as|act as)\s+/i, "");
      return `<p class="compass${band ? " on-band" : ""}"><span class="cp-tag">${esc(label)}</span>${rest
        ? `<span class="cp-lead">Today I act as </span><b>${esc(rest)}</b>` : `<span class="cp-empty">${esc(placeholder)}</span>`}</p>`;
    },
    tag: (text, kind = "") => `<span class="tag ${kind}">${esc(text)}</span>`,
    /** Card header lockup (v2 §5): tile 28 + 8 + EYEBROW, optional trailing meta/action. sec = section key for the tile (or "" for none). */
    cardHead: (sec, title, trailing = "", ic = "") => `<div class="lockup">${sec ? ui.secTile(sec, ic) : ""}${ui.label2(title)}${trailing ? `<span class="lk-trail">${trailing}</span>` : ""}</div>`,
    /** Action bar (v2 §6): related CTAs in one row; primary sits last. end = right-aligned (sheets/toolbars). */
    actbar: (btns, end = false, cls = "") => `<div class="actbar ${end ? "end" : ""} ${cls}">${btns.filter(Boolean).join("")}</div>`,
    /** Panel: white card with a card-header lockup. lead = a secTile string (legacy) — its section is read from it. */
    panel: (title, trailing, content, cls = "", lead = "") => {
      const m = /sec-([a-z]+)/.exec(lead || ""), ic = /data-ic="([^"]+)"/.exec(lead || "");
      return `<section class="panel ${cls}">${ui.cardHead(m ? m[1] : "", title, trailing || "", ic ? ic[1] : "")}${content}</section>`;
    },
    /** SectionTile: a rounded tile in the section's gradient with its custom glyph. sec = brief|calendar|tasks|mail|settings|friday|health */
    secTile: (sec, ic) => `<span class="stile sec-${esc(sec)}" ${ic ? `data-ic="${esc(ic)}"` : ""} aria-hidden="true">${icon(ic || SEC_ICON[sec] || "dot")}</span>`,
    /** Role chip: the role's tint with its dark text (neutral when the name isn't one of the planner's roles). */
    roleTag: (name) => `<span class="tag role ${roleClass(name)}">${esc(name)}</span>`,
    seg: (act, options, selected, extra = {}) => `<div class="seg" role="group">${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<button type="button" data-act="${esc(act)}" data-value="${esc(v)}" ${data(extra)} aria-pressed="${v === selected}">${esc(l)}</button>`; }).join("")}</div>`,
    search: (id, placeholder, value = "", act = "") => `<label class="search">${icon("magnifyingglass")}<span class="sr">${esc(placeholder)}</span><input id="${esc(id)}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" ${act ? `data-input="${esc(act)}"` : ""} autocomplete="off" spellcheck="false"></label>`,
    /** A task that left this day's page, with its Franklin mark in the circle: → forwarded (and where) or ✗ deleted. */
    markRow: (m) => {
      const fwd = m.kind === "forward";
      let where = "Deleted · no longer needed";
      if (fwd) {
        if (!m.to) where = "Forwarded to the master list";
        else {
          const d = new Date(m.to + "T00:00"), t0 = new Date(); t0.setHours(0, 0, 0, 0);
          const diff = Math.round((d - t0) / 86400000);
          where = "Forwarded to " + (diff === 1 ? "tomorrow" : diff === 0 ? "today" : d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }));
        }
      }
      return `<div class="markrow ${fwd ? "fwd" : "del"}" role="group" aria-label="${esc(m.title + ". " + where)}">
        <span class="mk" aria-hidden="true">${fwd ? "→" : "✕"}</span>
        ${m.code ? `<span class="mkcode" aria-hidden="true">${esc(m.code)}</span>` : ""}
        <span class="v g2 grow"><span class="t15 mkt">${esc(m.title)}</span><span class="t13 muted">${esc(where)}</span></span></div>`;
    },
    /** The to-do circle. fc (optional) shows Franklin status in it, like the app: • in progress, D delegated, ✓ done. */
    check: (on, act, d = {}, label = "", fc = null) => {
      const st = on ? "on" : fc?.inProgress ? "prog" : fc?.delegate ? "dlg" : "";
      const say = on ? "Mark not done: " : (st === "prog" ? "In progress. " : st === "dlg" ? "Delegated. " : "") + "Check off: ";
      return `<button type="button" class="check ${st}" data-act="${esc(act)}" ${data(d)} aria-label="${esc(say + label)}"><i>${st === "dlg" ? "D" : ""}</i></button>`;
    },
    /** ScreenHeader: the one header every tab uses, so every title starts at the same edge.
     *  Section label (dark shade) + large ink title with the section's icon tile beside it. lead = custom HTML instead of the tile; sec = false for none. */
    /** tools = icon-only buttons (they sit beside the title, like iOS nav-bar items); actions = labelled buttons (a full-width grid row on phones) */
    header: ({ eyebrow = "", title, actions = "", tools = "", lead = null, sec = null }) => {
      const s = sec === false ? null : (sec || (SEC_ICON[S.tab] ? S.tab : null));
      const l = lead ?? (s ? ui.secTile(s) : "");
      return `<div class="screen-head"><div class="tb">${l}<div class="tx">${eyebrow}<h1>${esc(title)}</h1></div></div>${tools ? `<div class="tools">${tools}</div>` : ""}${actions ? `<div class="acts">${actions}</div>` : ""}</div>`;
    },
    /** FridayMark: the Friday icon — cyan→violet ring with a cyan hexagon at the center */
    fmark(size = 26) {
      ensureDefs();
      return `<svg class="fmark" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="url(#fg-fri)" stroke-width="2.2"/><path d="M15.5 12l-1.75 3.03h-3.5L8.5 12l1.75-3.03h3.5z" fill="#00D4FF"/></svg>`;
    },
    switch: (name, on, act = "") => `<span class="switch"><input type="checkbox" role="switch" ${name ? `name="${esc(name)}"` : ""} ${on ? "checked" : ""} ${act ? `data-change="${esc(act)}"` : ""}></span>`,
    errorText: (t) => `<p class="err h g4 top">${icon("exclamationmark.triangle.fill", 'style="width:14px;height:14px;flex:none;margin-top:1px"')}<span>${esc(t)}</span></p>`,
    countBadge: (n, urgent) => (n > 0 ? `<span class="badge ${urgent ? "urgent" : ""}">${n > 99 ? "99+" : n}</span>` : ""),
    spinner: () => '<span class="spin" aria-hidden="true"></span>',
    /** Progress bar (spec "Charts and graphs"): real numbers only; label = the plain-words text a screen reader hears. cls: "done-fill" when the fill is a done portion. */
    pbar: (done, total, label, cls = "", fill = "") => {
      const f = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
      return `<div class="pbar ${cls}" role="img" aria-label="${esc(label)}"><i class="${f ? "" : "zero"}" style="width:${(f * 100).toFixed(1)}%${fill ? ";--fill:" + fill : ""}"></i></div>`;
    },
  };

  // ------------------------------------------------------------ toast, sheets, alerts
  let toastTimer;
  /** AppToast: text, plus an Undo button like the app when {undo} is given. */
  function toast(t, opts = {}) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
    // over an open sheet the toast must ride in the sheet (the top layer), or its Undo sits hidden behind it
    const host = [...document.querySelectorAll("dialog.sheet[open]")].pop() || document.body;
    if (el.parentElement !== host) host.appendChild(el);
    el.innerHTML = `<span>${esc(t)}</span>${opts.undo ? '<button type="button" class="btn link" id="toast-undo">Undo</button>' : ""}`;
    el.classList.toggle("has-undo", !!opts.undo);
    if (opts.undo) $("#toast-undo").onclick = async () => { el.classList.remove("show"); try { await opts.undo(); } catch (e) { toast("Couldn't undo: " + friendly(e.message)); } };
    el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), opts.undo ? 5000 : 3200);
  }

  /** A sheet with the app's SheetBar: leading = secondary (Cancel/Back/Later), trailing = primary (Save/Done/Add).
   *  body is HTML or a function returning HTML (called again on update()). Returns {el, close, update}. */
  function sheet({ title, leading, trailing, body, foot, size = "", onClose, id }) {
    const d = document.createElement("dialog");
    d.className = "sheet " + size;
    if (id) d.dataset.sheet = id;
    const draw = () => {
      const t = typeof title === "function" ? title() : title;
      const l = typeof leading === "function" ? leading() : leading;
      const r = typeof trailing === "function" ? trailing() : trailing;
      const f = typeof foot === "function" ? foot() : foot;
      const keepToast = d.querySelector("#toast"), keepAsk = d.querySelector(".leave-scrim");   // a redraw must not wipe the toast (its Undo) or an open question
      d.innerHTML = `<div class="sheetbar"><div class="sb-l">${l ? ui.btn({ label: l.label, act: l.act || "sheet-close", data: l.data }) : ""}</div>
          <h2 class="title">${esc(t)}</h2><div class="sb-r">${r ? ui.btn({ label: r.label, labelHTML: r.busy ? ui.spinner() : null, kind: "primary", act: r.act, data: r.data, disabled: r.disabled || r.busy }) : ""}</div></div>
        <div class="sheetbody">${typeof body === "function" ? body() : body}</div>${f ? `<div class="sheetfoot">${f}</div>` : ""}`;
      if (keepToast) d.appendChild(keepToast);
      if (keepAsk) d.appendChild(keepAsk);
    };
    draw();
    document.body.appendChild(d);
    const api = {
      el: d,
      /** guard = {dirty(): bool, title, message, leave, stay}: Esc (or any close the page didn't ask for) asks Keep/Leave first, like Compose. */
      guard: null,
      close() { api._ok = true; if (d.open) d.close(); else finish(); },
      update() { const sb = d.querySelector(".sheetbody"), top = sb?.scrollTop || 0; const focusId = document.activeElement?.id; draw(); const nb = d.querySelector(".sheetbody"); if (nb) nb.scrollTop = top; if (focusId) d.querySelector("#" + CSS.escape(focusId))?.focus(); },
    };
    let done = false;
    const finish = () => { if (done) return; done = true; const t = d.querySelector("#toast"); if (t) ([...document.querySelectorAll("dialog.sheet[open]")].filter((x) => x !== d).pop() || document.body).appendChild(t); d.remove(); sheets.delete(api); onClose?.(); };
    // The Keep/Discard question sits inside the sheet (not a second dialog), so Chrome never closes the two together on Esc.
    // Esc again, or Keep editing, puts him back where he was typing.
    const focusField = () => (api._lastField?.isConnected ? api._lastField : d.querySelector(".sheetbody textarea, .sheetbody input:not([type=checkbox])"))?.focus();
    const askLeave = () => {
      const open = d.querySelector(".leave-scrim");
      if (open) { open.remove(); focusField(); return; }
      const g = api.guard || {};
      if (d.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) api._lastField = document.activeElement;
      const o = document.createElement("div");
      o.className = "leave-scrim";
      o.innerHTML = `<div class="leave-card" role="alertdialog" aria-modal="true" aria-labelledby="leave-t"><div class="ab"><h3 id="leave-t">${esc(g.title || "Discard this?")}</h3>${g.message ? `<p>${esc(g.message)}</p>` : ""}</div>
        <div class="aa"><button type="button" class="destructive" data-leave="1">${esc(g.leave || "Discard")}</button><button type="button" class="cancel" data-leave="0">${esc(g.stay || "Keep editing")}</button></div></div>`;
      o.addEventListener("click", (e) => {
        const b = e.target.closest("[data-leave]"); if (!b && e.target !== o) return;
        e.stopPropagation(); o.remove();
        if (b?.dataset.leave === "1") api.close(); else focusField();
      });
      d.appendChild(o);
      o.querySelector("button.cancel").focus();
    };
    const guarded = () => { try { return !!(api.guard && api.guard.dirty()); } catch { return false; } };
    d.addEventListener("close", () => {
      // Chrome lets a second quick Esc close a dialog even when cancel is prevented: put it back and ask
      if (!api._ok && guarded() && d.isConnected && !d.querySelector(".leave-scrim")) { setTimeout(() => { if (api._ok) return finish(); try { if (!d.open) d.showModal(); } catch {} askLeave(); }, 0); return; }
      finish();
    });
    // Esc is caught as a key first: stopping its default keeps Chrome from closing the sheet at all (a dialog's own
    // cancel can't always be stopped), so there's one prompt and nothing to put back
    d.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || e.isComposing || !(guarded() || d.querySelector(".leave-scrim"))) return;
      e.preventDefault(); e.stopPropagation(); askLeave();
    });
    d.addEventListener("cancel", (e) => {
      if (d.dataset.noEscape) { e.preventDefault(); return; }
      // when Chrome won't let Esc be stopped (no tap since the last one), the close handler puts the sheet back and asks
      if (guarded() && e.cancelable) { e.preventDefault(); askLeave(); }
    });
    d._api = api;
    sheets.add(api);
    d.showModal();
    return api;
  }
  const sheets = new Set();

  /** confirmationDialog / alert. buttons: [{label, kind: 'destructive'|'cancel'|'', value}]; resolves with the value (or input text). */
  function alert({ title, message = "", buttons = [{ label: "OK", value: true }], input }) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog");
      d.className = "alert";
      d.innerHTML = `<div class="ab"><h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ""}${input ? `<textarea class="input" rows="3" placeholder="${esc(input.placeholder || "")}">${esc(input.value || "")}</textarea>` : ""}</div>
        <div class="aa">${buttons.map((b, i) => `<button type="button" class="${b.kind || ""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div>`;
      document.body.appendChild(d);
      let result = null;
      d.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const btn = buttons[+b.dataset.i]; result = btn.kind === "cancel" ? null : (input ? { value: btn.value, text: d.querySelector("textarea").value } : btn.value ?? true); d.close(); });
      d.addEventListener("close", () => { d.remove(); resolve(result); });
      d.showModal();
      (d.querySelector("textarea") || d.querySelector("button.cancel") || d.querySelector("button"))?.focus();
    });
  }

  // ------------------------------------------------------------ Friday's core (port of FridayCore.swift, idle/thinking)
  const cores = new Set();
  /** Draws Friday's core on a canvas. Calling it again for the same canvas updates it (never a second loop). Returns {setMode}. */
  function core(canvas, { compact = true, mode = "idle" } = {}) {
    if (!canvas) return { setMode() {} };
    let entry = [...cores].find((c) => c.canvas === canvas);
    if (entry) Object.assign(entry, { compact, mode }); else { entry = { canvas, compact, mode }; cores.add(entry); }
    startCores();
    return { setMode: (m) => { entry.mode = m; } };
  }
  let coreRAF;
  function startCores() {
    if (coreRAF) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (ts) => {
      const t = ts / 1000;
      for (const c of [...cores]) {
        if (!c.canvas.isConnected) { cores.delete(c); continue; }
        drawCore(c, reduce ? 0 : t);
      }
      coreRAF = cores.size ? requestAnimationFrame(tick) : null;
    };
    coreRAF = requestAnimationFrame(tick);
  }
  function drawCore({ canvas, compact, mode }, t) {
    const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w) return;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const c = { x: w / 2, y: h / 2 }, R = Math.min(w, h) / 2;
    const e = mode === "thinking" ? 0.35 + 0.1 * Math.sin(t * 6) : 0.12 + 0.06 * Math.sin(t * 1.4);
    const k = tok(), tint = mode === "thinking" ? k.fridayLight : k.friday;
    const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
    // glow
    const gR = R * (0.55 + 0.25 * e), g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, gR);
    g.addColorStop(0, rgba(tint, 0.28 * (0.5 + e))); g.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, gR, 0, Math.PI * 2); ctx.fill();
    // outer segmented ring
    const spin = t * 0.25, segs = 36;
    ctx.strokeStyle = rgba(k.gold, 0.8); ctx.lineWidth = compact ? 1.5 : 2.5;
    for (let i = 0; i < segs; i++) { if (i % 6 === 5) continue; const a0 = spin + i / segs * 2 * Math.PI; ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.95, a0, a0 + 2 * Math.PI / segs * 0.7); ctx.stroke(); }
    ctx.strokeStyle = k.hairline; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.88, 0, Math.PI * 2); ctx.stroke();
    // radial bars
    const bars = compact ? 36 : 72, inner = R * 0.52, maxLen = R * 0.3;
    ctx.lineWidth = compact ? 1.5 : 2.2;
    for (let i = 0; i < bars; i++) {
      const a = i / bars * 2 * Math.PI - Math.PI / 2;
      const n1 = Math.sin(i * 0.9 + t * 7.1), n2 = Math.sin(i * 0.37 - t * 4.3), n3 = Math.sin(i * 2.1 + t * 11);
      let amp = (0.5 + 0.5 * (0.5 * n1 + 0.3 * n2 + 0.2 * n3)) * e;
      if (mode === "idle") amp = 0.12 + 0.05 * (0.5 + 0.5 * n2);
      const len = 3 + maxLen * amp;
      ctx.strokeStyle = rgba(tint, 0.35 + 0.65 * amp);
      ctx.beginPath(); ctx.moveTo(c.x + inner * Math.cos(a), c.y + inner * Math.sin(a)); ctx.lineTo(c.x + (inner + len) * Math.cos(a), c.y + (inner + len) * Math.sin(a)); ctx.stroke();
    }
    if (mode === "thinking") {
      const a0 = t * 3.2; ctx.lineCap = "round";
      ctx.strokeStyle = k.fridayLight; ctx.lineWidth = compact ? 2 : 3; ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.8, a0, a0 + 1.1); ctx.stroke();
      ctx.strokeStyle = rgba(k.fridayLight, 0.6); ctx.lineWidth = compact ? 1.5 : 2; ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.8, a0 + Math.PI, a0 + Math.PI + 0.5); ctx.stroke(); ctx.lineCap = "butt";
    }
    // inner ring + dashed counter-rotating ring
    const breathe = 1 + 0.06 * e;
    ctx.strokeStyle = rgba(tint, 0.9); ctx.lineWidth = compact ? 1.5 : 2; ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.46 * breathe, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-t * 0.6); ctx.setLineDash([3, 7, 14, 7]); ctx.strokeStyle = rgba(k.fridayLight, 0.8); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.38, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
    // hexagons
    const hex = (r) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, x = c.x + r * Math.cos(a), y = c.y + r * Math.sin(a); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); };
    const hr = R * 0.2 * (1 + 0.18 * e);
    ctx.save(); ctx.shadowColor = tint; ctx.shadowBlur = compact ? 4 : 10; hex(hr); ctx.fillStyle = k.panel; ctx.fill(); ctx.restore();
    hex(hr); ctx.strokeStyle = tint; ctx.lineWidth = compact ? 1.5 : 2.5; ctx.stroke();
    hex(hr * 0.45); ctx.fillStyle = rgba(tint, 0.4 + 0.6 * e); ctx.fill();
  }

  // ------------------------------------------------------------ views, actions, routing
  const views = {};       // tab → {render(): html, after?(root)}
  const actions = {};     // data-act → handler(el, event)
  const inputs = {};      // data-input → handler(el, event)
  const changes = {};     // data-change → handler(el, event)
  const forms = {};       // data-form → handler(formData, form, event)
  const view = (name, def) => { views[name] = def; };
  const on = (name, fn) => { actions[name] = fn; };
  // the pick-a-day pop-up (pickDate)
  const pk = (el) => el.closest("dialog")?._pick;
  on("pk-day", (el) => { const p = pk(el); if (!p) return; const d = D.parse(el.dataset.day); p.st.pick = d;
    if (d.getMonth() !== p.st.month.getMonth() || d.getFullYear() !== p.st.month.getFullYear()) p.st.month = new Date(d.getFullYear(), d.getMonth(), 1);
    p.api.update(); });
  on("pk-step", (el) => { const p = pk(el); if (!p) return; const m = p.st.month; p.st.month = new Date(m.getFullYear(), m.getMonth() + Number(el.dataset.n), 1); p.api.update(); });
  on("pk-go", async (el) => { const p = pk(el); if (!p) return; p.api.close(); await p.onPick(p.st.pick); });
  const onInput = (name, fn) => { inputs[name] = fn; };
  const onChange = (name, fn) => { changes[name] = fn; };
  const onSubmit = (name, fn) => { forms[name] = fn; };

  const TABS = [["brief", "Brief", "brief"], ["calendar", "Calendar", "calendar"], ["tasks", "Tasks", "checklist"], ["mail", "Mail", "envelope"]];   // Friday chat: iPhone and iPad only

  function tabBadge(tab) {
    const today = D.start(new Date());
    if (tab === "tasks") { const od = todos().filter((t) => !t.done && t.due && D.start(t.due) < today); return ui.countBadge(od.length, od.some((t) => t.fc?.letter === "A")); }
    if (tab === "mail") {   // unread inbox mail, with read/archive/delete done here counted right away
      const q = queue(), seenNow = new Map(), gone = new Set();
      for (const c of q) {
        const ids = c.mailIDs || (c.mailID ? [c.mailID] : []);
        if (c.kind === "mail_seen") ids.forEach((x) => seenNow.set(x, c.on !== false));
        if (["mail_archive", "mail_trash", "mail_delete", "mail_move", "mail_junk"].includes(c.kind)) ids.forEach((x) => gone.add(x));
        if (c.kind === "mail_mark_all_read") (S.mail?.messages || []).filter((m) => m.folder === (c.folder || "INBOX") && (!c.accountID || m.accountID === c.accountID)).forEach((m) => seenNow.set(m.id, true));
      }
      const n = (S.mail?.messages || []).filter((m) => m.folder === "INBOX" && !gone.has(m.id) && !(seenNow.has(m.id) ? seenNow.get(m.id) : m.seen)).length;
      return ui.countBadge(n, false);
    }
    return "";
  }

  function render() {
    const root = $("#root");
    if (!S.creds && !DEMO) return;
    ensureDefs();
    const h = location.hash.slice(1).split("/")[0];
    S.tab = ["brief", "calendar", "tasks", "mail"].includes(h) ? h : "brief";
    let scr = $("#screen");
    if (!scr) {
      root.innerHTML = `<div class="app">
        <nav class="sidebar" aria-label="Sections"><div class="side-brand">${ui.fmark(26)}<b>F.R.I.D.A.Y.</b></div>
          <div class="side-rows" id="siderows"></div><div class="side-foot" id="sidefoot"></div></nav>
        <main class="screen" id="screen"></main>
        <nav class="tabbar" aria-label="Tabs"><div class="tabs" role="tablist" id="tabs"></div></nav></div>`;
      scr = $("#screen");
    }
    const v = views[S.tab];
    const top = scr.scrollTop, prevTab = scr.dataset.tab;
    scr.dataset.tab = S.tab;
    const ae = document.activeElement, focusId = ae?.id, selStart = ae?.selectionStart, selEnd = ae?.selectionEnd;
    scr.innerHTML = `<div class="screen-inner">${v ? v.render() : '<p class="muted">Loading…</p>'}</div>`;
    if (prevTab === S.tab) scr.scrollTop = top; else scr.scrollTop = 0;
    if (focusId && !ae.closest("dialog")) { const el = document.getElementById(focusId); if (el) { el.focus(); try { el.setSelectionRange(selStart, selEnd); } catch {} } }
    $("#tabs").innerHTML = TABS.map(([k, label, ic]) => `<button type="button" class="tab sec-${k}" role="tab" data-act="tab" data-tab="${k}" aria-selected="${S.tab === k}"><span class="ic">${icon(ic, S.tab === k ? 'stroke-width="2"' : "")}${tabBadge(k)}</span>${label}</button>`).join("");
    const mac = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
    $("#siderows").innerHTML = TABS.map(([k, label, ic], i) => `<button type="button" class="side-row sec-${k}" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ""}
        aria-keyshortcuts="${mac === "⌘" ? "Meta" : "Control"}+${i + 1}" title="${label} (${mac}${i + 1})">${icon(ic)}<span class="sl">${label}</span>${tabBadge(k)}</button>`).join("")
      // the Organizer from anywhere (values, goals, roles, Compass, time matrix, rules, energy)
      + `<button type="button" class="side-row sec-settings" data-act="open-organizer">${icon("target")}<span class="sl">Organizer</span></button>`;
    const synced = S.lastLoad ? D.time(new Date(S.lastLoad)) : "";
    $("#sidefoot").innerHTML = `<button type="button" class="side-row sec-settings ${S.syncingNow ? "is-syncing" : ""}" data-act="sync-now" ${S.syncingNow ? "disabled" : ""}>${icon("arrow.triangle.2.circlepath")}
        <span class="sl">${S.syncingNow ? "Syncing…" : "Sync now"}${synced && !S.syncingNow ? `<span class="sub">Updated ${esc(synced)}</span>` : ""}</span></button>
      <button type="button" class="side-row sec-settings" data-act="open-settings">${icon("gearshape")}<span class="sl">Settings</span></button>`;
    v?.after?.(scr);
    for (const s of sheets) s.refresh?.();
    for (const fn of renderHooks) { try { fn(); } catch (e) { console.error(e); } }
  }
  const renderHooks = [];
  /** Run something after every render (e.g. the morning ritual checks whether it's due). */
  const onRender = (fn) => renderHooks.push(fn);

  /** Habit feedback: a spring on the check that was just tapped; big = an A1 or Big Rock, which also gets a quiet green ring.
   *  Resolves once the spring has played, so callers can save (and redraw) right after without cutting it off. */
  function celebrate(el, big = false) {
    if (!el || !el.isConnected) return Promise.resolve();
    const wait = new Promise((r) => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 360));
    const target = el.querySelector("i, .smark") || el;
    target.classList.remove("celebrate"); void target.offsetWidth; target.classList.add("celebrate");
    setTimeout(() => target.classList.remove("celebrate"), 500);
    if (!big) return wait;
    const r = target.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    for (const cls of ["cel-ring", "cel-ring r2"]) {
      const ring = document.createElement("span");
      ring.className = cls; ring.setAttribute("aria-hidden", "true");
      const z = window.F?.zoomScale ? F.zoomScale() : 1;
      ring.style.left = x / z + "px"; ring.style.top = y / z + "px";
      (el.closest("dialog[open]") || document.body).appendChild(ring);
      setTimeout(() => ring.remove(), 900);
    }
    return wait;
  }
  /** A1 or Big Rock: the to-dos that earn the ring. */
  const isBig = (t) => !!(t && (t.fc?.bigRock || (t.fc?.letter === "A" && t.fc?.number === 1)));
  /** Redraw only the sheets that asked to follow data changes (call after data loads). */
  function refreshSheets() { for (const s of sheets) s.refresh?.(); }

  /** The one "pick a day" pop-up, 1:1 with the app's DatePickSheet (Go to date, Forward to): quick picks
   *  (Today · Tomorrow · Next week), then a month card you tap through — chosen day a filled blue circle, today ringed,
   *  always six weeks tall so it never changes size. pickDate({title, confirm, value: Date, onPick(Date)}). */
  function pickDate({ title, confirm = "Go", value, onPick }) {
    const today = D.start(new Date());
    const nextMonday = (() => { let d = D.add(today, 1); while (d.getDay() !== 1) d = D.add(d, 1); return d; })();
    const quick = [["Today", today], ["Tomorrow", D.add(today, 1)], ["Next week", nextMonday]];
    const st = { pick: D.start(value || today), month: new Date((value || today).getFullYear(), (value || today).getMonth(), 1) };
    const body = () => {
      const m = st.month, lead = m.getDay(), days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const n = i - lead + 1;
        if (n < 1 || n > days) { cells.push('<span class="pk-cell" aria-hidden="true"></span>'); continue; }
        const d = new Date(m.getFullYear(), m.getMonth(), n), on = D.same(d, st.pick), isToday = D.same(d, today);
        cells.push(`<button type="button" class="pk-cell pk-day${on ? " on" : ""}${isToday ? " today" : ""}" data-act="pk-day" data-day="${D.key(d)}"
          aria-pressed="${on}" aria-label="${esc(d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + (isToday ? ", today" : ""))}"><span>${n}</span></button>`);
      }
      return `<div class="pk v g16">
        <div class="pk-quick">${quick.map(([l, d]) => ui.btn({ label: l, kind: D.same(d, st.pick) ? "primary" : "", act: "pk-day", data: { day: D.key(d) } })).join("")}</div>
        <div class="card pk-month">
          <div class="pk-head"><h3>${esc(m.toLocaleDateString(undefined, { month: "long", year: "numeric" }))}</h3>
            ${ui.btn({ kind: "icon", filled: true, icon: "chevron.left", act: "pk-step", data: { n: -1 }, aria: "Previous month" })}${ui.btn({ kind: "icon", filled: true, icon: "chevron.right", act: "pk-step", data: { n: 1 }, aria: "Next month" })}</div>
          <div class="pk-grid" role="grid">${["S", "M", "T", "W", "T", "F", "S"].map((w) => `<span class="pk-wd" aria-hidden="true">${w}</span>`).join("")}${cells.join("")}</div>
        </div></div>`;
    };
    const api = sheet({ title, size: "pick", leading: { label: "Cancel" }, trailing: { label: confirm, act: "pk-go" }, body });
    api.el._pick = { st, onPick, api };
    return api;
  }


  // delegated events
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const a = el.dataset.act;
    if (a === "tab") { location.hash = el.dataset.tab; return; }
    if (a === "sheet-close") { el.closest("dialog")?._api?.close(); return; }
    const fn = actions[a];
    if (!fn) return;
    e.preventDefault();
    try { await fn(el, e); }
    catch (ex) { console.error(ex); toast("Couldn't do that: " + friendly(ex.message)); render(); }
  });
  document.addEventListener("input", (e) => { const n = e.target.dataset?.input; if (n && inputs[n]) inputs[n](e.target, e); });
  document.addEventListener("change", (e) => { const n = e.target.dataset?.change; if (n && changes[n]) changes[n](e.target, e); });
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-form]"); if (!form) return;
    e.preventDefault();
    const fn = forms[form.dataset.form]; if (!fn) return;
    const btn = form.querySelector("button.primary[type=submit], button.primary:not([type=button])");
    const label = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = ui.spinner() + (btn.textContent || ""); }
    try { await fn(Object.fromEntries(new FormData(form)), form, e); }
    catch (ex) { const err = form.querySelector(".err"); if (err) err.textContent = friendly(ex.message); else toast(friendly(ex.message)); }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
  });
  window.addEventListener("hashchange", () => render());
  // ⌘1…⌘4 / Ctrl+1…4: Brief, Calendar, Tasks, Mail (registered before Mail's own keys, which skip handled events)
  document.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || !/^[1-4]$/.test(e.key) || !$("#screen")) return;
    if (document.querySelector("dialog[open]")) return;
    e.preventDefault();
    location.hash = TABS[+e.key - 1][0];
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.creds && Date.now() - S.lastLoad > 60000) refresh(); });
  // automatic: every 20 seconds while Mail is showing (new email), every 90 seconds elsewhere
  let lastAuto = Date.now();
  setInterval(() => {
    if (document.visibilityState !== "visible" || !S.creds || document.querySelector("dialog[open]")) return;
    if (Date.now() - lastAuto >= (S.tab === "mail" ? 20000 : 90000)) { lastAuto = Date.now(); refresh(); }
  }, 5000);

  /** The Sync now button: reloads at once and asks the iPhone to check mail now; watches up to 2 minutes for its answer. */
  async function syncNow() {
    if (S.syncingNow) return;
    S.syncingNow = true; render();
    const before = S.mail?.at || 0, snapBefore = snap()?.at || 0;
    try {
      await load();
      if (!DEMO && !queue().some((c) => c.kind === "mail_refresh")) await cmd("mail_refresh");
      toast("Asked your iPhone for new mail…");
      const started = Date.now();
      while (Date.now() - started < 120000) {
        await new Promise((r) => setTimeout(r, DEMO ? 800 : 8000));
        await load().catch(() => {});
        if ((S.mail?.at || 0) > before || (snap()?.at || 0) > snapBefore || DEMO) { toast("Up to date"); return; }
        render();
      }
      toast("Your iPhone hasn't answered yet. It catches up the next time F.R.I.D.A.Y. is open or checks in.");
    } finally { S.syncingNow = false; render(); }
  }
  on("sync-now", () => syncNow());
  /** The button, for any screen header. */
  const syncButton = () => ui.btn({ kind: "icon", filled: true, act: "sync-now", aria: "Sync now", title: "Sync now",
    labelHTML: null, icon: "arrow.triangle.2.circlepath", cls: S.syncingNow ? "is-syncing" : "", disabled: S.syncingNow });

  async function refresh() {
    try { await load(); } catch (e) { if (e.message === "need-password" || e.message === "wrong-password") return signOut(); }
    render();
  }
  function friendly(e) {
    return ({ "expired-key": "the GitHub access key expired or was removed. Run setup again on the website.", conflict: "another device saved at the same moment. Try again.",
              "wrong-password": "That username or password isn't right.", "not-set-up": "Sign-in isn't set up yet. Reload the page." })[e] || e;
  }

  // ------------------------------------------------------------ auth screens
  function authShell(inner) {
    $("#root").innerHTML = `<div class="auth"><div class="panel">
      <div class="auth-band h g8" style="justify-content:center">${ui.fmark(28)}<span class="t17 w7" style="letter-spacing:2.4px">F.R.I.D.A.Y.</span></div>${inner}</div></div>`;
  }
  function renderSignIn(error = "") {
    authShell(`<h1 class="t20 w6" style="text-align:center">Sign in</h1>
      <form class="v g16" data-form="signin">
        <label class="field"><span>Username</span><input class="input" name="u" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        <label class="field"><span>Password</span><input class="input" name="p" type="password" autocomplete="current-password" required></label>
        <label class="h g12" style="min-height:44px">${ui.switch("remember", false)}<span class="t15">Keep me signed in on this computer</span></label>
        <p class="err" role="alert">${esc(error)}</p>
        <button class="btn primary wide" type="submit">Sign in</button>
      </form>
      <p class="t13 muted" style="text-align:center">The same username and password as F.R.I.D.A.Y. on your iPhone and iPad.</p>`);
    $("[name=u]")?.focus();
  }
  function renderSetup() {
    authShell(`<h1 class="t20 w6">Set up your sign-in (once)</h1>
      <ol class="steps">
        <li>Open <a href="https://github.com/settings/personal-access-tokens/new?name=F.R.I.D.A.Y.+sync&description=Website+and+app+sync&expires_in=366&contents=write" target="_blank" rel="noopener">GitHub's new access key page</a>.</li>
        <li>Under <b>Repository access</b>, choose <b>Only select repositories</b> and pick <b>friday-sync</b> and <b>friday-web</b>.</li>
        <li>Under <b>Permissions › Repository › Contents</b>, choose <b>Read and write</b>. Tap <b>Generate token</b> and copy it.</li>
        <li>Paste it below and pick your username and password.</li>
      </ol>
      <form class="v g16" data-form="setup">
        <label class="field"><span>GitHub access key</span><input class="input" name="token" type="password" autocomplete="off" required></label>
        <label class="field"><span>Username</span><input class="input" name="u" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3"></label>
        <label class="field"><span>Password (at least 12 characters)</span><input class="input" name="p" type="password" autocomplete="new-password" required minlength="12"></label>
        <label class="field"><span>Password again</span><input class="input" name="p2" type="password" autocomplete="new-password" required minlength="12"></label>
        <p class="err" role="alert"></p>
        <button class="btn primary wide" type="submit">Save my sign-in</button>
      </form>
      <p class="t13 muted">Your password never leaves this computer. It scrambles the access key; only your username and password can unscramble it.</p>`);
  }
  onSubmit("signin", async (f) => {
    try { await signIn(f.u, f.p, f.remember === "on"); render(); }
    catch (e) { S.creds = null; S.password = null; throw new Error(friendly(e.message)); }
  });
  onSubmit("setup", async (f) => { await setup(f); render(); });

  async function boot() {
    $("#root").innerHTML = "";
    if (DEMO) { S.creds = { demo: true }; await load(); render(); return; }
    if (loadSession()) {
      try { await load(); } catch (e) { if (e.message === "need-password" || e.message === "wrong-password") { signOut(); return; } }
      render(); return;
    }
    authShell('<p class="muted" style="text-align:center">Checking…</p>');
    fetchAuth().then((a) => (a ? renderSignIn() : renderSetup())).catch(() => renderSignIn("Can't reach GitHub right now. Check your internet and reload."));
  }

  return {
    CONFIG, DEMO, S, D, ui, $, $$, esc, uuid, nowSec,
    // data
    snap, queue, prefs, rule, planner, roleIndex, roleClass, roleColor, todos, events, lists, calendars, defaultList, byPriority, prefsHiddenCalendars,
    mail: () => S.mail, devices: () => S.devices, status: () => S.status,
    cmd, savePlanner, setPref, writeSection, load, refresh, getFile, putFile, friendly,
    // ui
    toast, sheet, pickDate, alert, core, addIcons, icon, SEC_ICON, accountColor, render, refreshSheets, syncNow, syncButton, onRender, celebrate, isBig,
    view, on, onInput, onChange, onSubmit, signOut, boot,
  };
})();
// Text size dial for this computer only (kept in this browser). Wide screens start one step up.
F.zoomSteps = [[0.9, "Smaller"], [1, "Normal"], [1.15, "Larger"], [1.3, "Large"], [1.5, "Largest"]];
F.zoom = () => { let v = NaN; try { v = Number(localStorage.getItem("friday.zoom")); } catch {} return v > 0 ? v : (window.innerWidth >= 1200 ? 1.15 : 1); };
/** How many screen pixels one CSS pixel takes under the text-size zoom (measured, so it holds in every browser).
 *  Fixed-position things placed from getBoundingClientRect divide by it. */
F.zoomScale = () => { const p = document.createElement("div"); p.style.cssText = "position:fixed;left:0;top:0;width:100px;height:1px;visibility:hidden;pointer-events:none"; document.body.appendChild(p); const z = p.getBoundingClientRect().width / 100; p.remove(); return z > 0 ? z : 1; };
/** The layout picks phone / tablet / sidebar / wide from the window's width, which the dial's zoom doesn't change; so the dial
 *  stops where the zoomed page would be narrower than the layout it's in (else names and buttons get cut to "Sam…").
 *  Past that, the browser's own ⌘+ zoom still works (it re-picks the layout). */
F.zoomCap = (w = window.innerWidth) => (w < 640 ? w / 320 : w < 900 ? w / 640 : w < 1000 ? w / 900 : w / 1000);
F.applyZoom = (v) => { v = Math.max(0.9, Math.min(v, Math.max(1, F.zoomCap()))); const r = document.documentElement.style; r.zoom = String(v); r.setProperty("--zoom", String(v)); };
window.addEventListener("resize", () => { clearTimeout(F._zt); F._zt = setTimeout(() => F.applyZoom(F.zoom()), 150); });
F.setZoom = (v) => { try { localStorage.setItem("friday.zoom", String(v)); } catch {} F.applyZoom(v); };
F.applyZoom(F.zoom());
/** The Compass shown for a day (Franklin.swift actAs): his line for that day, else this week's Compass, else his
 *  standing card, else Friday's suggested Compass for the week (the iPhone/Mac write it). */
/** Marks (→ ✗) left on a day's page, minus tasks that are back on it. presentIds: ids on that day now. */
/** His first name: Friday settings' "From" name, else his email account's name; "" when neither is known (callers drop the ", name"). */
F.firstName = () => {
  const pick = (v) => String(v || "").trim().split(/\s+/)[0] || "";
  return pick(F.prefs().fromName) || pick((F.mail()?.accounts || []).find((a) => String(a.fullName || "").trim())?.fullName);
};
/** ", Jose" when his name is known, else "" (so lines read "Good morning" rather than naming someone else). */
F.withName = () => { const n = F.firstName(); return n ? ", " + n : ""; };
F.dayMarks = (date, presentIds = []) => {
  const p = F.planner && F.planner(); if (!p || !p.days) return [];
  const ids = new Set(presentIds);
  return ((p.days[F.D.key(date)] || {}).marks || []).filter((m) => !ids.has(m.id));
};
F.compassFor = (p, d) => {
  if (!p) return "";
  const day = p.days?.[F.D.key(d)] || {};
  if (day.actAs != null) return String(day.actAs).trim();
  const w = p.weeks?.[F.D.key(F.D.weekStart(d))] || {};
  if (String(w.compass || "").trim()) return String(w.compass).trim();
  if (String(p.actAs || "").trim()) return String(p.actAs).trim();
  return String(w.suggestedCompass || "").trim();
};
F.compassSuggested = (p, d) => !!p && p.days?.[F.D.key(d)]?.actAs == null && !String(p.weeks?.[F.D.key(F.D.weekStart(d))]?.compass || "").trim()
  && !String(p.actAs || "").trim() && !!String(p.weeks?.[F.D.key(F.D.weekStart(d))]?.suggestedCompass || "").trim();
window.F = F;
document.addEventListener("DOMContentLoaded", () => F.boot());
