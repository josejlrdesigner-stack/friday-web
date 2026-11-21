// Tasks tab — a 1:1 port of PlannerTab (PlannerViews.swift) and everything it opens:
// DayPage · MasterPage · ListsPage · WeekPage · ValuesPage · TaskSearchResults, FranklinRow (+ its menus),
// CloseOutSheet, TodoEditSheet (EditSheets.swift), ListsSheet + RolesSheet (ListsRolesViews.swift),
// OverloadBanner + MoveTasksSheet + DayCapacity (Capacity.swift). Voice features are not part of the web.
"use strict";
(() => {
  const { ui, D, esc } = F;
  const icon = F.icon;

  F.addIcons({
    square: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
    "checkmark.square.fill": '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="currentColor" stroke="none"/><path d="M7.5 12.3l3 3 6-6.3" stroke="#fff" stroke-width="2.4"/>',
    person: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    "person.fill.badge.plus": '<circle cx="10" cy="8" r="3.8" fill="currentColor"/><path d="M3 20.5a7 7 0 0 1 14 0z" fill="currentColor"/><path d="M19.5 6v6M16.5 9h6"/>',
    "circle.fill": '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>',
    "checkmark.circle": '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16.2 9.5"/>',
    "line.3.horizontal": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    minus: '<path d="M5 12h14"/>',
  });

  // ------------------------------------------------------------ state (one per tab, like @State / @AppStorage)
  const T = {
    page: (() => { try { return localStorage.getItem("friday.plannerPage") || "day"; } catch { return "day"; } })(),
    day: D.start(new Date()),
    week: D.weekStart(new Date()),
    query: "",
    searching: false,      // search box opens from the 🔍 icon on the title row (same as the app, UAT D19)
    folded: new Set(),
    drafts: {},            // add-row text fields, kept across redraws
    rows: new Map(),       // todo id → {t, day, gc} for the rows on screen
  };
  const PAGES = [["day", "Day"], ["master", "Master"], ["lists", "Lists"], ["week", "Week"], ["values", "Goals"]];
  const setPage = (p) => { T.page = p; try { localStorage.setItem("friday.plannerPage", p); } catch {} };

  // ------------------------------------------------------------ helpers
  const today0 = () => D.start(new Date());
  const isToday = (d) => D.same(d, new Date());
  const isTomorrow = (d) => D.same(d, D.add(today0(), 1));
  const fmtWide = (d) => d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });     // Wednesday, Nov 19
  const fmtMDY = (d) => d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });       // November 18, 2026
  const wdAbbr = (d) => d.toLocaleDateString([], { weekday: "short" });
  const max = (a, b) => (a > b ? a : b);
  const trim = (s) => String(s ?? "").trim();
  const code = (m) => (m?.letter ? m.letter + (m.number ?? "") : null);
  const rankL = (l) => ({ A: 0, B: 1, C: 2 }[l] ?? 3);
  const fcCmp = (a, b) => rankL(a.fc?.letter) - rankL(b.fc?.letter) || (a.fc?.number ?? 999) - (b.fc?.number ?? 999);
  const QNAMES = { 1: "Q1 · Urgent & important (necessity)", 2: "Q2 · Important, not urgent (Big Rocks)", 3: "Q3 · Urgent, not important (deception)", 4: "Q4 · Neither (waste)" };
  const QSHORT = { 1: "Urgent", 2: "Important", 3: "Interruption", 4: "Waste" };
  const QKIND = { 1: "q1", 2: "q2", 3: "q3", 4: "q4" };
  const SAW = ["Physical", "Social / Emotional", "Mental", "Spiritual"];
  const REPEATS = [["never", "Never"], ["daily", "Every day"], ["weekdays", "Every weekday"], ["weekly", "Every week"], ["biweekly", "Every 2 weeks"], ["monthly", "Every month"], ["yearly", "Every year"]];
  const fullFC = (m = {}) => ({ letter: m.letter ?? null, number: m.number ?? null, quadrant: m.quadrant ?? null, role: m.role ?? null, bigRock: !!m.bigRock, inProgress: !!m.inProgress, delegate: m.delegate ?? null, goal: m.goal ?? null });

  // the data
  const all = () => F.todos();
  const openTodos = () => all().filter((t) => !t.done);
  const doneToday = () => all().filter((t) => t.done);
  function history(day) {
    const h = F.snap()?.history?.[D.key(day)] || [];
    return h.map((t) => ({ ...t, due: D.fromEpoch(t.due), done: true, fc: fullFC(t) }));
  }
  const findTodo = (id) => T.rows.get(id)?.t || all().find((t) => t.id === id) || null;

  /** Lists with the website's not-yet-applied list changes laid over them. */
  function lists() {
    let ls = F.lists().map((l) => ({ ...l }));
    for (const c of F.queue()) {
      if (c.kind === "add_list" && !ls.some((l) => l.title === c.name)) ls.push({ title: c.name, color: "#767E8A", pending: true });
      if (c.kind === "rename_list") ls = ls.map((l) => (l.title === c.old ? { ...l, title: c.new, from: [...(l.from || []), c.old], pending: true } : l));
      if (c.kind === "delete_list") ls = ls.filter((l) => l.title !== c.name);
      if (c.kind === "set_list_color") ls = ls.map((l) => (l.title === c.name ? { ...l, color: c.color } : l));
    }
    return ls;
  }
  const listCount = (name) => openTodos().filter((t) => t.list === name).length;

  // checklist lines in notes (CheckItem)
  function splitChecklist(notes) {
    const items = [], rest = [];
    for (const line of String(notes || "").split("\n")) {
      if (line.startsWith("☐ ")) items.push({ id: F.uuid(), text: line.slice(2), done: false });
      else if (line.startsWith("☑ ")) items.push({ id: F.uuid(), text: line.slice(2), done: true });
      else rest.push(line);
    }
    return [items, rest.join("\n").trim()];
  }
  const joinChecklist = (items, notes) => [trim(notes), ...items.filter((i) => trim(i.text)).map((i) => (i.done ? "☑ " : "☐ ") + i.text)].filter(Boolean).join("\n");
  const checklistProgress = (t) => { const [items] = splitChecklist(t.notes); return items.length ? [items.filter((i) => i.done).length, items.length] : null; };

  // ------------------------------------------------------------ planner (PlannerData, Franklin.swift)
  function norm(p) {
    p = p && typeof p === "object" ? p : {};
    p.mission ??= ""; p.actAs ??= "";
    for (const k of ["values", "longGoals", "midGoals", "roles"]) if (!Array.isArray(p[k])) p[k] = [];
    if (!p.weeks || typeof p.weeks !== "object") p.weeks = {};
    if (!p.days || typeof p.days !== "object") p.days = {};
    return p;
  }
  const P = () => norm(F.planner());
  const normDay = (x) => ({ record: [], planned: false, closed: false, ...(x || {}) });
  const normWeek = (x) => ({ rocks: [], saw: {}, sawDone: {}, ...(x || {}) });
  const weekKey = (d) => D.key(D.weekStart(d));
  const pday = (p, d) => normDay(p.days[D.key(d)]);
  const pweek = (p, d) => normWeek(p.weeks[weekKey(d)]);
  const actAs = (p, d) => F.compassFor(p, d);
  const roleName = (p, id) => p.roles.find((r) => r.id === id)?.name || "";
  const valueName = (p, id) => p.values.find((v) => v.id === id)?.title || "";
  const save = (mutate) => F.savePlanner((p) => mutate(norm(p)));
  const updateDay = (d, f) => save((p) => { const k = D.key(d), x = normDay(p.days[k]); f(x); p.days[k] = x; });
  const updateWeek = (d, f) => save((p) => { const k = weekKey(d), w = normWeek(p.weeks[k]); f(w); p.weeks[k] = w; });
  const log = (text, d = new Date()) => updateDay(d, (x) => x.record.push({ id: F.uuid(), time: D.toRef(new Date()), text }));

  // ------------------------------------------------------------ DayCapacity (Capacity.swift)
  const OWN = new Set(["Deep work · A1 & Big Rocks (Quadrant II)", "Crisis buffer · leave open", "Batch & triage · messages and requests", "Low-energy window · C tasks"]);
  const LIFE = /parent|partner|spouse|family|home|son|daughter|caregiv|community|friend|self-renewal/i;
  // v2 (Capacity.swift): work and home are weighed apart. Work to-dos are mostly quick; home ones carry travel and setup.
  const minutesFor = (letter, ctx = "work") => (ctx === "home" ? { A: 60, B: 40, C: 25 }[letter] ?? 30 : { A: 45, B: 30, C: 15 }[letter] ?? 25);
  const LIFE_CTX = /parent|partner|spouse|family|home|son|daughter|caregiv|community|friend|self-renewal|health|finance|money|self/i;
  function taskContext(t, weekend) {
    const r = String(t.fc?.role || "").toLowerCase();
    if (r) {
      if (LIFE_CTX.test(r)) return "home";
      if (/career|work|job|leader|manager|professional|business|employee|team|client/.test(r)) return "work";
    }
    const l = String(t.list || t.listTitle || "").toLowerCase();
    if (/work|job|career|office|project|client|team|search|apply/.test(l)) return "work";
    if (/home|family|personal|grocer|shopping|errand|house|kids|health|finance|bills|chores/.test(l)) return "home";
    const s = String(t.title || "").toLowerCase();
    if (/\b(email|e-mail|call|meeting|interview|resume|résumé|apply|application|recruiter|linkedin|cover letter|deck|report|review|draft|prep|zoom|sync|follow ?up|send|proposal|invoice|slides)\b/.test(s)) return "work";
    if (/\b(buy|pick up|groceries|grocery|clean|laundry|gym|exercise|workout|run|walk|doctor|dentist|pay|bill|kids|school|cook|dinner|fix|car|errand|yard|dishes|vacuum|wash|haircut|pharmacy|vet|bank)\b/.test(s)) return "home";
    return weekend ? "home" : "work";
  }
  function hm(m) { if (m < 60) return `${m} min`; return m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`; }
  const dayName = (d) => (isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : D.wd(d));
  function capTasks(day) {
    const t0 = today0(), d0 = D.start(day), isT = D.same(d0, t0);
    return openTodos().filter((t) => t.due && (D.same(t.due, d0) || (isT && t.due < t0)));
  }
  function meetingMinutes(day) {
    const a = D.start(day), b = D.add(a, 1);
    // the app's own number for the day (same calendars, same rules) unless the website has an event change waiting
    const own = F.snap()?.capacity?.[D.key(day)]?.meetings;
    if (typeof own === "number" && !F.queue().some((c) => /_event$/.test(c.kind))) return own;
    // same rules as Capacity.swift: no all-day, no Friday blocks, no 12 h+ blocks, one copy of an event shown in two calendars
    const seen = new Set();
    const spans = F.events().filter((e) => !e.allDay && !OWN.has(e.title) && e.end - e.start <= 12 * 3600000)
      .filter((e) => { const k = (e.title || "").toLowerCase() + "|" + e.start.getTime(); if (seen.has(k)) return false; seen.add(k); return true; }).map((e) => [max(e.start, a), e.end < b ? e.end : b]).filter((s) => s[0] < s[1]).sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const s of spans) { const l = merged[merged.length - 1]; if (l && s[0] <= l[1]) l[1] = max(l[1], s[1]); else merged.push([...s]); }
    return Math.round(merged.reduce((n, s) => n + (s[1] - s[0]) / 60000, 0));
  }
  /** The iPhone's own numbers (snapshot.capacity) for free time and basis; the task list includes the website's pending changes. */
  function estimate(day, { adding = 0, excluding = null } = {}) {
    const list = capTasks(day).filter((t) => t.id !== excluding);
    const c = F.snap()?.capacity?.[D.key(day)];
    let free, basis, reasons, cap = Infinity, pace = null;
    if (c && typeof c.free === "number") {
      free = c.free; basis = c.basis || "standard"; reasons = c.reasons || [];
      if (basis === "pace" && c.pace) { pace = c.pace; }
    } else {
      const p = P(), weekend = [0, 6].includes(day.getDay()), meetings = meetingMinutes(day);
      reasons = meetings > 0 ? [`${hm(meetings)} of meetings`] : [];
      if ((F.prefs().plannerSetupDone === "1" || p.values.length) && p.roles.length) {   // same set-up rule as the app
        basis = "profile";
        const pr = p.profile || {};
        free = (weekend ? 360 : 600) - meetings;
        if (!weekend) {
          const buf = pr.bufferMinutes ?? 90; free -= buf; reasons.push(`${hm(buf)} crisis buffer`);
          const batch = (pr.batchTimes || ["16:30"]).length * 30; if (batch > 0) { free -= batch; reasons.push(`${hm(batch)} for messages`); }
        }
        const life = p.roles.map((r) => r.name).filter((n) => LIFE.test(n));
        if (life.length) { free -= life.length * 30; reasons.push(`${hm(life.length * 30)} for ${life.slice(0, 3).join(", ")}${life.length > 3 ? "…" : ""}`); }
      } else { basis = "standard"; free = (weekend ? 300 : 480) - meetings - 90; reasons.push("90 min for home, family and the unexpected"); }
      free = Math.max(free, 60);
    }
    const weekend = [0, 6].includes(day.getDay());
    // the iPhone's split (v2); older snapshots: treat it all as one pool, the work side
    const workFree = typeof c?.workFree === "number" ? c.workFree : free, homeFree = typeof c?.homeFree === "number" ? c.homeFree : 0;
    const work = list.filter((t) => taskContext(t, weekend) === "work").sort(fcCmp), home = list.filter((t) => taskContext(t, weekend) === "home").sort(fcCmp);
    const fit = (ts, ctx, capM, start) => { let used = start, n = 0; for (const t of ts) { const m = minutesFor(t.fc?.letter, ctx); if (used + m > capM) break; used += m; n++; } return [n, used]; };
    const capW = Math.floor(workFree * 1.1), capH = Math.floor(homeFree * 1.1);
    const exW = weekend ? 0 : adding, exH = weekend ? adding : 0;
    let [wf, wu] = fit(work, "work", capW, exW);
    const [hf, hu] = fit(home, "home", capH + Math.floor(Math.max(0, capW - wu) / 2), exH);
    if (wf < work.length) [wf, wu] = fit(work, "work", capW + Math.floor(Math.max(0, capH - hu) / 2), exW);
    const workNeeded = work.reduce((n, t) => n + minutesFor(t.fc?.letter, "work"), exW), homeNeeded = home.reduce((n, t) => n + minutesFor(t.fc?.letter, "home"), exH);
    const needed = workNeeded + homeNeeded, fits = Math.min(wf + hf, cap);
    const aCount = list.filter((t) => t.fc?.letter === "A").length;
    const aMinutes = list.filter((t) => t.fc?.letter === "A").reduce((n, t) => n + minutesFor("A", taskContext(t, weekend)), 0);
    const tot = workFree + homeFree;
    return { tasks: list, needed, free: tot, fits, aCount, basis, pace, reasons, overloaded: list.length > fits, excess: Math.max(0, list.length - fits),
      tooManyAs: aCount > 3 && aMinutes > tot * 0.6, room: Math.max(0, tot - needed),
      workCount: work.length, homeCount: home.length, workNeeded, homeNeeded, workFree, homeFree, workFits: wf, homeFits: hf, workOver: wf < work.length, homeOver: hf < home.length };
  }
  /** Day load for the Brief (spec "Charts and graphs"): the same DayCapacity numbers plus that day's meeting minutes. */
  F.capacity = (day) => ({ ...estimate(day), meetings: meetingMinutes(day), hm });
  function nextDays(day) {
    const start = max(D.start(day), today0());
    return [1, 2, 3, 4, 5, 6, 7].map((i) => { const d = D.add(start, i), e = estimate(d); return [d, e.free - e.needed]; });
  }
  function roomiestDay(after) { let best = null; for (const x of nextDays(after)) if (!best || x[1] > best[1]) best = x; return best; }
  function headsUp(e, day, pending) {
    const total = e.tasks.length + (pending ? 1 : 0);
    if (total <= e.fits) return null;
    return `${dayName(day)} ${pending ? "would have" : "now has"} ${total} to-dos and about ${e.fits} realistically fit, so some may roll over.`;
  }

  // ------------------------------------------------------------ popover menu (SwiftUI Menu)
  /** sections: [{title?, items:[{label, icon?, danger?, run?, sub?:sections, note?}]}] */
  function menu(anchor, sections) {
    document.querySelector("dialog.tmenu")?.close();
    const d = document.createElement("dialog");
    d.className = "tmenu";
    let stack = [sections];
    const draw = () => {
      const cur = stack[stack.length - 1];
      d.innerHTML = (stack.length > 1 ? `<button type="button" class="mi back" data-mi="back">${icon("chevron.left")}<span>Back</span></button>` : "") +
        cur.map((s, si) => `<div class="msec">${s.title ? `<div class="mtitle">${esc(s.title)}</div>` : ""}${s.items.map((it, ii) => it.note
          ? `<div class="mi note">${esc(it.label)}</div>`
          : `<button type="button" class="mi ${it.danger ? "danger" : ""}" data-mi="${si}.${ii}"><span>${esc(it.label)}</span>${it.sub ? icon("chevron.right") : it.icon ? icon(it.icon) : ""}</button>`).join("")}</div>`).join("");
    };
    draw();
    document.body.appendChild(d);
    d.addEventListener("close", () => d.remove());
    d.addEventListener("click", (e) => {
      if (e.target === d) { d.close(); return; }
      const b = e.target.closest("[data-mi]"); if (!b) return;
      if (b.dataset.mi === "back") { stack.pop(); draw(); place(); return; }
      const [si, ii] = b.dataset.mi.split(".").map(Number), it = stack[stack.length - 1][si].items[ii];
      if (it.sub) { stack.push(it.sub); draw(); place(); return; }
      d.close();
      Promise.resolve().then(() => it.run?.()).catch((ex) => { console.error(ex); F.toast("Couldn't do that: " + F.friendly(ex.message)); });
    });
    d.showModal();
    const place = () => {
      const z = F.zoomScale(), r = anchor.getBoundingClientRect(), w = d.offsetWidth * z, h = d.offsetHeight * z, vw = innerWidth, vh = innerHeight;
      let left = Math.min(Math.max(8, r.left), vw - w - 8);
      if (r.right > vw / 2) left = Math.max(8, Math.min(r.right - w, vw - w - 8));
      let top = r.bottom + 4;
      if (top + h > vh - 8) top = Math.max(8, r.top - h - 4);
      d.style.left = left / z + "px"; d.style.top = top / z + "px";   // CSS pixels under the text-size zoom
    };
    place();
    d.querySelector(".mi:not(.note)")?.focus();
  }

  // ------------------------------------------------------------ FranklinRow pieces
  function priorityBadge(m, attrs = "") {
    const c = code(m), cls = { A: "a", B: "b", C: "c" }[m?.letter] || "";
    return `<span class="pbadge ${cls} ${c ? "" : "unset"}" ${attrs}>${esc(c ?? "Set")}</span>`;
  }
  function statusMark(t) {
    const m = t.fc || {};
    const st = t.done ? "done" : m.inProgress ? "prog" : m.delegate ? "dlg" : "";
    return `<span class="smark ${st}">${t.done ? icon("checkmark") : m.inProgress ? "<b></b>" : m.delegate ? "D" : ""}</span>`;
  }
  function tags(t, day) {
    const m = t.fc || {}, out = [];
    if (m.role) out.push(ui.roleTag(m.role));
    if (m.quadrant) out.push(ui.tag(`Q${m.quadrant} ${QSHORT[m.quadrant] || ""}`, QKIND[m.quadrant]));
    if (m.bigRock) out.push(ui.tag("Big Rock", "done"));
    if (m.delegate) out.push(ui.tag(`D · ${m.delegate}`));
    const cp = checklistProgress(t); if (cp) out.push(ui.tag(`☑ ${cp[0]}/${cp[1]}`));
    if (t.repeats) out.push(ui.tag("Repeats"));
    if (t.due && !t.done && D.daysBetween(t.due, day) > 0) out.push(ui.tag(`→ from ${wdAbbr(t.due)}`, m.letter === "A" ? "danger" : ""));
    return out.length ? `<div class="flow g4">${out.join("")}</div>` : "";
  }
  const statusWord = (t) => (t.done ? "Completed" : t.fc?.inProgress ? "In progress" : t.fc?.delegate ? "Delegated" : "Open");

  /** One task row. gc(letter) = how many already have that letter (for the next number). */
  function franklinRow(t, day, gc, { drag = null, trailing = "" } = {}) {
    T.rows.set(t.id, { t, day, gc });
    const m = t.fc || {};
    const rc = F.roleClass(m.role);
    return `<div class="tk-row fr ${rc ? "has-role " + rc : ""}" ${drag ? `draggable="true" data-dnd="${esc(drag)}" data-id="${esc(t.id)}"` : ""}>
      <button type="button" class="plain hit44" data-act="tk-done" data-id="${esc(t.id)}" aria-label="${esc(statusWord(t) + ", " + t.title)}" title="Tap to check off">${statusMark(t)}</button>
      <button type="button" class="plain hit44 pb" data-act="tk-prio" data-id="${esc(t.id)}" aria-label="${esc(`Priority ${code(m) ?? "none"}. Change priority, quadrant or role`)}">${priorityBadge(m)}</button>
      <button type="button" class="plain fr-main" data-act="tk-edit" data-id="${esc(t.id)}" aria-description="Opens the to-do to edit">
        <span class="fr-title ${t.done ? "done" : ""}">${esc(t.title)}</span>${tags(t, day)}</button>
      <button type="button" class="plain fr-more" data-act="tk-more" data-id="${esc(t.id)}" aria-label="${esc("More actions for " + t.title)}">${icon("ellipsis")}</button>
      ${trailing}</div>`;
  }

  // row actions (FranklinRow)
  const setFranklin = (t, meta) => F.cmd("set_franklin", { todoID: t.id, meta: fullFC(meta) });
  async function complete(t, day, el = null) {
    const was = t.done;
    const mk = !was && el?.querySelector(".smark");
    if (mk) { mk.className = "smark done"; mk.innerHTML = icon("checkmark"); }   // turns green at once
    if (!was) await F.celebrate(el || document.querySelector(`[data-act="tk-done"][data-id="${CSS.escape(t.id)}"]`), F.isBig(t));   // spring (+ ring for A1/Big Rock), then save
    await F.cmd(was ? "uncomplete_todo" : "complete_todo", { todoID: t.id }, (was ? "Not done: " : "Done: ") + t.title);
    if (!was) await log("✓ " + t.title, day);
  }
  async function setInProgress(t, day) {
    const x = { ...t.fc, inProgress: !t.fc.inProgress };
    await F.cmd("set_franklin", { todoID: t.id, meta: fullFC(x) }, (x.inProgress ? "In progress: " : "Not in progress: ") + t.title);
    if (x.inProgress) await log(`• ${t.title} (in progress)`, day);
  }
  async function forward(t, to, day) {
    const whereTo = to ? fmtWide(to) : "the master list";
    await F.cmd("forward_todos", { ids: [t.id], due: to ? D.key(to) : null, keepLetter: !!(to && isToday(to)) }, `Forwarded to ${whereTo}: ${t.title}`);
    await log(`→ ${t.title} to ${whereTo}`, day);
  }
  async function delegate(t, day) {
    const r = await F.alert({ title: "Delegated to", message: "Who has it? The due date becomes your follow-up date.", input: { placeholder: "Name", value: t.fc.delegate || "" },
      buttons: [{ label: "Save", value: "save" }, { label: "Cancel", kind: "cancel" }] });
    const who = trim(r?.text);
    if (!r || !who) return;
    await F.cmd("set_franklin", { todoID: t.id, meta: fullFC({ ...t.fc, delegate: who, inProgress: false }) }, `Delegated to ${who}: ${t.title}`);
    await log(`D ${t.title} → ${who}`, day);
  }
  async function confirmDelete(t, day) {
    const ok = await F.alert({ title: `Delete "${t.title}"?`, message: "No longer needed. It's logged in today's record.",
      buttons: [{ label: "Delete  ✗", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
    if (!ok) return;
    await F.cmd("delete_todo", { todoID: t.id }, "Deleted: " + t.title);
    await log("✗ " + t.title, day);
  }
  async function setLetter(t, l, gc) {
    if ((t.fc.letter || null) === l) return;
    const x = { ...t.fc, letter: l, number: l ? gc(l) + 1 : null };
    await F.cmd("set_franklin", { todoID: t.id, meta: fullFC(x) }, (code(x) ? `Now ${code(x)}: ` : "No priority: ") + t.title);
  }
  function forwardPicker(t, day) {
    // same pick-a-day pop-up as the app's Forward to
    F.pickDate({ title: "Forward to", confirm: "Forward", value: D.add(max(D.start(day), today0()), 1), onPick: (d) => forward(t, d, day) });
  }
  function statusMenu(t, day) {
    const m = t.fc;
    const tomorrow = D.add(max(D.start(day), today0()), 1);
    const items = [
      { label: t.done ? "Mark not done" : "Done  ✓", icon: "checkmark", run: () => complete(t, day) },
      { label: m.inProgress ? "In progress  • (on)" : "In progress  •", icon: m.inProgress ? "checkmark.circle" : "circle.fill", run: () => setInProgress(t, day) },
      { label: "Forward  →", sub: [{ items: [
        { label: "Tomorrow", run: () => forward(t, tomorrow, day) },
        { label: "Pick a day…", run: () => forwardPicker(t, day) },
        { label: "Master list (no date)", run: () => forward(t, null, day) }] }] },
      { label: m.delegate ? `Delegated to ${m.delegate}` : "Delegate  D", icon: "person.fill.badge.plus", run: () => delegate(t, day) },
    ];
    if (m.delegate) items.push({ label: "Take it back", icon: "arrow.uturn.backward", run: () => F.cmd("set_franklin", { todoID: t.id, meta: fullFC({ ...m, delegate: null }) }, "Taken back: " + t.title) });
    items.push({ label: "Edit…", icon: "pencil", run: () => openTodoEdit(t) });
    items.push({ label: "Delete  ✗", icon: "trash", danger: true, run: () => confirmDelete(t, day) });
    return [{ items }];
  }
  function priorityMenu(t, gc) {
    const m = t.fc, p = P();
    return [
      { title: "Priority (value)", items: [
        { label: "A · Vital, must do today", run: () => setLetter(t, "A", gc) },
        { label: "B · Important, should do", run: () => setLetter(t, "B", gc) },
        { label: "C · Optional, nice to do", run: () => setLetter(t, "C", gc) },
        { label: "No priority", run: () => setLetter(t, null, gc) }] },
      { title: "Quadrant", items: [1, 2, 3, 4].map((q) => ({ label: QNAMES[q], icon: m.quadrant === q ? "checkmark" : "square", run: () => setFranklin(t, { ...m, quadrant: m.quadrant === q ? null : q }) })) },
      ...(p.roles.length ? [{ title: "Role", items: p.roles.map((r) => ({ label: r.name, icon: m.role === r.name ? "checkmark" : "person", run: () => setFranklin(t, { ...m, role: m.role === r.name ? null : r.name }) })) }] : []),
      { items: [{ label: m.bigRock ? "Not a Big Rock" : "Make it a Big Rock", icon: "mountain.2", run: () => setFranklin(t, { ...m, bigRock: !m.bigRock }) }] },
    ];
  }
  F.on("tk-done", (el) => { const r = T.rows.get(el.dataset.id); if (r) return complete(r.t, r.day, el); });
  F.on("tk-edit", (el) => { const r = T.rows.get(el.dataset.id); if (r) openTodoEdit(r.t); });
  F.on("tk-more", (el) => { const r = T.rows.get(el.dataset.id); if (r) menu(el, statusMenu(r.t, r.day)); });
  F.on("tk-prio", (el) => { const r = T.rows.get(el.dataset.id); if (r) menu(el, priorityMenu(r.t, r.gc)); });
  F.on("tk-sheet-primary", (el) => el.closest("dialog")?._api?.onPrimary?.());

  // ------------------------------------------------------------ shared layout pieces
  const sec = (head, body, { foot = "", cls = "" } = {}) => `<section class="tk-sec ${cls}">${head ? `<div class="tk-head">${head}</div>` : ""}<div class="tk-card">${body}</div>${foot ? `<p class="tk-foot">${foot}</p>` : ""}</section>`;
  const textRow = (t, cls = "muted") => `<div class="tk-row"><p class="t15 ${cls}">${esc(t)}</p></div>`;
  const small = (label, act, data = {}, extra = {}) => ui.btn({ label, kind: "small", act, data, ...extra });
  const fridayBtn = (label, act, data = {}) => ui.btn({ labelHTML: ui.fmark(18) + esc(label), act, data });
  /** An add row: text field + small Add button, submitted with Enter. */
  function addRow(key, placeholder, form, data = {}) {
    const v = T.drafts[key] || "";
    return `<form class="tk-row addrow" data-form="${esc(form)}" ${Object.entries(data).map(([k, x]) => `data-${k}="${esc(x)}"`).join(" ")}>
      <input id="tk-in-${esc(key)}" class="bare grow" name="text" placeholder="${esc(placeholder)}" value="${esc(v)}" data-input="tk-draft" data-key="${esc(key)}" autocomplete="off">
      <button type="submit" class="btn small" ${trim(v) ? "" : "disabled"}>Add</button></form>`;
  }
  F.onInput("tk-draft", (el) => { T.drafts[el.dataset.key] = el.value; const b = el.form?.querySelector("button[type=submit]"); if (b) b.disabled = !trim(el.value); });
  const takeDraft = (key) => { const v = trim(T.drafts[key]); T.drafts[key] = ""; return v; };
  const navBtn = (dir, act, label) => `<button type="button" class="btn icon small filled" data-act="${act}" data-dir="${dir}" aria-label="${label}" title="${label}">${icon(dir < 0 ? "chevron.left" : "chevron.right")}</button>`;

  // ------------------------------------------------------------ the tab
  function render() {
    T.rows.clear();
    const s = F.snap();
    const open = openTodos();
    const searchIc = ui.btn({ kind: "icon", filled: true, icon: T.searching || T.query ? "xmark" : "magnifyingglass", act: "tk-search", aria: T.searching || T.query ? "Close search" : "Search all to-dos", title: "Search all to-dos" });
    const actions = [ui.btn({ label: "Organizer", icon: "target", act: "tk-organizer", title: "Values, roles, time matrix, rules, focus time, and setup" }),
      ui.btn({ label: "To-do", icon: "plus", kind: "primary", act: "tk-new" }), searchIc].join("");
    // "77 open · 29 late": the same late number as the tab badge and the Brief (UAT D18)
    const today0 = D.start(new Date());
    const late = open.filter((t) => t.due && D.start(t.due) < today0).length;   // same rule as the tab badge (core.js)
    const top = `<div class="tk-top">
      <div class="phc">${ui.header({ eyebrow: ui.label2(`${open.length} open` + (late ? ` · ${late} late` : "")), title: "Tasks", actions,
        tools: `<span class="ph-tools">${searchIc}${ui.btn({ kind: "icon", filled: true, icon: "target", act: "tk-organizer", aria: "Organizer", title: "Organizer: values, roles, time matrix, rules, focus time" })}${ui.btn({ kind: "icon", icon: "plus", cls: "primary-ic", act: "tk-new", aria: "New to-do", title: "New to-do" })}</span>` })}</div>
      ${s && s.access && s.access.reminders === false ? `<div class="card attention p16 h g16"><span class="h g8 t15 w5 c-attention">${icon("exclamationmark.triangle.fill", 'style="width:17px;height:17px;flex:none"')}Reminders access is off, so nothing can show here.</span></div>` : ""}
      ${T.searching || T.query ? `<label class="search">${icon("magnifyingglass")}<span class="sr">Search all to-dos</span><input id="tk-q" type="text" placeholder="Search all to-dos" value="${esc(T.query)}" data-input="tk-q" autocomplete="off" spellcheck="false" autocapitalize="none">${T.query ? `<button type="button" class="plain clearq" data-act="tk-clearq" aria-label="Clear search">${icon("xmark.circle.fill")}</button>` : ""}</label>` : ""}
      ${failedCard()}
      ${T.query ? "" : ui.seg("tk-page", PAGES, T.page)}
    </div>`;
    let body;
    if (!s) body = `<div class="tk-list">${sec("", textRow("Your to-dos appear here once your iPhone syncs."))}</div>`;
    else if (trim(T.query)) body = searchResults();
    else body = { day: dayPage, master: masterPage, lists: listsPage, week: weekPage, values: valuesPage }[T.page]?.() || dayPage();
    return `<div class="tasks">${top}${body}</div>`;
  }

  /** snapshot.failed: changes the iPhone couldn't carry out, so nothing silently stays "pending". */
  const TODO_KINDS = new Set(["add_todo", "update_todo", "complete_todo", "uncomplete_todo", "delete_todo", "move_todo", "set_franklin", "forward_todos", "renumber", "add_list", "rename_list", "delete_list", "set_list_color"]);
  const dismissed = () => { try { return new Set(JSON.parse(localStorage.getItem("friday.tasksFailedSeen") || "[]")); } catch { return new Set(); } };
  function failedCard() {
    const failed = F.snap()?.failed || {};
    const sent = new Map((F.S.payload?.queue?.value || []).map((c) => [c.id, c]));
    const seen = dismissed();
    const rows = Object.entries(failed).filter(([id]) => !seen.has(id) && (!sent.has(id) || TODO_KINDS.has(sent.get(id).kind)));
    if (!rows.length) return "";
    return `<div class="card attention p16 v g8"><span class="h g8 t15 w6 c-attention">${icon("exclamationmark.triangle.fill", 'style="width:17px;height:17px;flex:none"')}Your iPhone couldn't make ${rows.length === 1 ? "this change" : `these ${rows.length} changes`}</span>
      ${rows.map(([id, msg]) => { const c = sent.get(id); const what = c?.title || findTodo(c?.todoID)?.title || c?.name || ""; return `<p class="t15 ink">${esc((what ? `“${what}”: ` : "") + msg)}</p>`; }).join("")}
      ${ui.actbar([ui.btn({ label: "OK", kind: "small", act: "tk-failed-ok", data: { ids: rows.map(([id]) => id).join(",") } })])}</div>`;
  }
  F.on("tk-failed-ok", (el) => { const s = dismissed(); el.dataset.ids.split(",").forEach((i) => s.add(i)); try { localStorage.setItem("friday.tasksFailedSeen", JSON.stringify([...s].slice(-200))); } catch {} F.render(); });

  F.on("tk-organizer", () => F.openOrganizer?.());
  F.on("tk-editlists", () => openListsSheet());
  F.on("tk-new", () => openTodoEdit(null, T.page === "day" ? { due: D.key(T.day) } : {}));
  F.on("tk-page", (el) => { setPage(el.dataset.value); F.render(); });
  F.onInput("tk-q", (el) => { T.query = el.value; F.render(); });
  F.on("tk-search", () => {
    T.searching = !(T.searching || T.query); if (!T.searching) T.query = "";
    F.render(); if (T.searching) document.getElementById("tk-q")?.focus();
  });
  F.on("tk-clearq", () => { T.query = ""; F.render(); document.getElementById("tk-q")?.focus(); });

  // ------------------------------------------------------------ search
  function searchResults() {
    const q = trim(T.query).toLowerCase();
    const hits = [...openTodos(), ...doneToday()].filter((t) => t.title.toLowerCase().includes(q) || splitChecklist(t.notes)[1].toLowerCase().includes(q) || (t.list || "").toLowerCase().includes(q) || (t.fc?.role || "").toLowerCase().includes(q)).sort(fcCmp);
    const gc = (l) => openTodos().filter((t) => t.fc?.letter === l).length;
    return `<div class="tk-list">${sec(ui.label2(`${hits.length} found`),
      hits.map((t) => franklinRow(t, t.due ? D.start(t.due) : today0(), gc)).join("") || textRow(`No to-dos match “${T.query}”.`))}</div>`;
  }

  // ------------------------------------------------------------ Day page
  function dayTasks(day) {
    const t0 = D.start(day), isT = isToday(day);
    const everything = all();
    let list = everything.filter((t) => !t.done && t.due && (D.same(t.due, t0) || (isT && t.due < t0)));
    if (isT) list = list.concat(everything.filter((t) => t.done && t.due));
    else { const ids = new Set(list.map((t) => t.id)); list = list.concat(history(day).filter((d) => !ids.has(d.id))); }
    return list.sort(fcCmp);
  }
  const dayWord = (d) => (isToday(d) ? "today" : isTomorrow(d) ? "tomorrow" : fmtWide(d));

  function dayPage() {
    const day = T.day, p = P(), list = dayTasks(day), today = isToday(day);
    const a = actAs(p, day);
    const canClose = day <= today0();
    const head = `<div class="tk-clear v g8">
      <div class="h g8 datenav">${navBtn(-1, "tk-day", "Previous day")}
        <div class="v g2 grow center"><span class="t17 w6 ink">${esc(D.wd(day))}</span><span class="t13 muted">${esc(fmtMDY(day))}</span></div>
        ${navBtn(1, "tk-day", "Next day")}${today ? "" : small("Today", "tk-day", { dir: 0 })}</div>
      ${overloadBanner(day)}
      <div class="tk-pair">
      <button type="button" class="plain card actas press" data-act="tk-actas" aria-description="Edit your Compass">
        ${ui.compass(a, { label: pday(p, day).actAs != null ? `Compass · ${today ? "today" : dayWord(day)}` : F.compassSuggested(p, day) ? "Compass · suggested" : "Compass · this week",
                          placeholder: "Tap to write this week's Compass: one sentence about how you'll show up." })}</button>
      ${aMeter(list, day)}</div>
      ${canClose ? ui.actbar([ui.btn({ label: "Close out day", icon: "checklist.checked", act: "tk-closeout" })]) : ""}
    </div>`;
    const groups = ["A", "B", "C", ""].map((letter) => {
      const g = list.filter((t) => (t.fc?.letter || "") === letter);
      if (!g.length) return "";
      const [name, color] = { A: ["A · Vital: must do today", "ink"], B: ["B · Important: should do today", "ink2"], C: ["C · Optional: nice to do", "muted"], "": ["Not prioritized yet", "muted"] }[letter];
      const gc = (l) => list.filter((t) => t.fc?.letter === l).length;
      return sec(`${ui.label2(name, color)}<span class="sp"></span><span class="t12 w6 muted">${g.length}</span>`,
        g.map((t) => franklinRow(t, day, gc, { drag: letter ? "day-" + letter : null })).join(""));
    }).join("");
    const marks = F.dayMarks(day, list.map((t) => t.id));
    const markSec = marks.length ? sec(`${ui.label2(`Forwarded & deleted · ${marks.length}`, "muted")}`, marks.map((m) => `<div class="tk-row">${ui.markRow(m)}</div>`).join("")) : "";
    const empty = list.length || marks.length ? "" : sec("", `<div class="tk-row v g12 top pad"><p class="t-secondary">${esc(today ? "Nothing on today's list yet. Add the first thing you want to get done." : `Nothing scheduled for ${dayWord(day)} yet.`)}</p>
      ${ui.actbar([ui.btn({ label: "Add a to-do", icon: "plus", kind: "small", cls: "tinted", act: "tk-new" })])}</div>`);
    // wide (≥1100): 12-column split — the day's list (7) | Big Rocks, schedule, record (5). Narrow: one column, Big Rocks first.
    return `<div class="tk-list tk-split"><div class="tk-main">${head}${groups}${markSec}${empty}</div><div class="tk-side">${bigRocks(p, day)}${schedule(day)}${record(p, day)}</div></div>`;
  }
  F.on("tk-day", (el) => { const d = +el.dataset.dir; T.day = d === 0 ? today0() : D.add(T.day, d); F.render(); });
  F.on("tk-closeout", () => openCloseOut(D.key(T.day)));
  F.on("tk-wk-compass", () => editCompass(T.week));
  F.on("tk-actas", () => editCompass(T.day));
  F.editCompass = (d) => editCompass(d || new Date());      // the Organizer's Roles & Weekly Compass page uses it too
  async function editCompass(day) {
    const sug = pweek(P(), day).suggestedCompass || "";
    const r = await F.alert({ title: "Compass", message: "Your north star for the week, from your roles: who you're being, in the present tense." + (sug ? ` Friday's suggestion: “${sug}”` : ""),
      input: { placeholder: "I act as…", value: actAs(P(), day) },
      buttons: [{ label: "Save for this week", value: "week" }, { label: `Just for ${dayWord(day)}`, value: "day" }, { label: "Cancel", kind: "cancel" }] });
    if (!r) return;
    const text = String(r.text || "").trim();
    if (r.value === "day") { if (text) await updateDay(day, (x) => { x.actAs = text; }); }
    else await save((p) => { const w = normWeek(p.weeks[weekKey(day)]); if (text && text !== sug) w.compass = text; else delete w.compass; p.weeks[weekKey(day)] = w;
      const k = D.key(day), x = normDay(p.days[k]); delete x.actAs; p.days[k] = x; });
  }

  /** "Did I do my A's?" = A's done ÷ A's planned (spec "Charts and graphs"). No A's → a short invitation instead of a chart. */
  function meter(label, done, total, invite, aria) {
    if (!total) return `<div class="tk-meter">${ui.label2(label)}<p class="invite">${esc(invite)}</p></div>`;
    return `<div class="tk-meter">${ui.label2(label)}<span class="chart-l"><span class="big">${done} of ${total}</span><span class="t13 w6 ink2">done</span></span>${ui.pbar(done, total, aria)}</div>`;
  }
  function aMeter(list, day) {
    const as = list.filter((t) => t.fc?.letter === "A"), done = as.filter((t) => t.done).length;
    return `<div class="tk-card tk-ameter sec-health">${meter(`A's done · ${dayWord(day)}`, done, as.length, `No A's planned for ${dayWord(day)} yet. Mark the must-dos A.`, `${done} of ${as.length} A tasks done ${dayWord(day)}`)}</div>`;
  }
  /** A's planned this week (open ones due this week, plus the ones finished on each day so far) and how many are done. */
  function weekAs(wk) {
    const t0 = today0(), end = D.add(wk, 7), ids = new Map();
    for (const t of all()) if (t.fc?.letter === "A" && t.due && t.due >= wk && t.due < end) ids.set(t.id, t);
    for (let i = 0; i < 7; i++) { const d = D.add(wk, i); if (d <= t0) for (const t of history(d)) if (t.fc?.letter === "A") ids.set(t.id, t); }
    const list = [...ids.values()];
    return { total: list.length, done: list.filter((t) => t.done).length };
  }
  function bigRocks(p, day) {
    const w = pweek(p, day);
    const n = w.rocks.filter((r) => r.scheduled || r.done).length;
    const count = w.rocks.length ? `<span class="t12 ${n === w.rocks.length ? "c-done" : "ink2"} nowrap">${n} of ${w.rocks.length} in the calendar</span>` : "";
    const rd = w.rocks.filter((r) => r.done).length;
    const body = w.rocks.length
      ? `<div class="tk-meter sec-health"><span class="chart-l"><span class="big">${rd} of ${w.rocks.length}</span><span class="t13 w6 ink2">done</span></span>${ui.pbar(rd, w.rocks.length, `${rd} of ${w.rocks.length} Big Rocks done this week`)}</div>` + w.rocks.map((r) => `<div class="tk-row rock">${ui.check(r.done, "tk-rock-done", { id: r.id, wk: weekKey(day) }, r.title)}
          <div class="v g4 grow"><span class="t15 ${r.done ? "muted strike" : "ink"}">${esc(r.title)}</span>${roleName(p, r.roleID) ? `<span>${ui.roleTag(roleName(p, r.roleID))}</span>` : ""}</div>
          ${r.scheduled ? ui.tag("Scheduled", "done") : r.done ? "" : small("Block time", "tk-rock-block", { id: r.id, wk: weekKey(day) })}</div>`).join("")
      : `<div class="tk-row v g12 top pad"><p class="t-secondary">No Big Rocks yet this week. They're the one or two important things per role that you schedule first.</p>
          ${ui.actbar([ui.btn({ label: "Set this week's Big Rocks", icon: "mountain.2", kind: "small", cls: "tinted", act: "tk-goweek" })])}</div>`;
    return sec(`${ui.label2("Big Rocks this week")}<span class="sp"></span>${count}`, body, { cls: "tk-rocks" });
  }
  F.on("tk-goweek", () => { T.week = D.weekStart(T.day); setPage("week"); F.render(); });
  F.on("tk-rock-done", (el) => updateWeek(D.parse(el.dataset.wk), (w) => { const r = w.rocks.find((x) => x.id === el.dataset.id); if (r) r.done = !r.done; }));
  F.on("tk-rock-block", (el) => {
    const wk = D.parse(el.dataset.wk), r = pweek(P(), wk).rocks.find((x) => x.id === el.dataset.id); if (!r) return;
    const base = T.page === "week" ? wk : T.day;
    openEvent(null, { day: max(D.start(base), today0()), title: "Big Rock: " + r.title,
      onSaved: () => updateWeek(wk, (w) => { const x = w.rocks.find((y) => y.id === r.id); if (x) x.scheduled = true; }) });
  });
  function openEvent(e, opts = {}) {
    if (F.openEventEdit) return F.openEventEdit(e, opts);
    F.toast("The calendar editor isn't available yet.");
  }

  // Schedule (EventRow / AllDayChips)
  const rgba = (hex, a) => { const n = parseInt(String(hex || "#767E8A").replace("#", "").slice(0, 6), 16) || 0x767e8a; return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function eventsOn(day) { const a = D.start(day), b = D.add(a, 1); return F.events().filter((e) => e.start < b && e.end > a); }
  function eventRow(e, now) {
    const past = e.end < now, live = e.start <= now && e.end > now;
    return `<button type="button" class="plain tk-evrow evtint press" data-act="tk-event" data-id="${esc(e.id)}" style="--evc:${rgba(e.color, past ? 0.6 : 1)};--evt:${rgba(e.color, past ? 0.10 : 0.18)}">
      <span class="v g2 tk-evtime"><span class="t13 w6 ${past ? "muted" : "ink"}">${esc(D.time(e.start))}</span><span class="t13 muted">${esc(D.time(e.end))}</span></span>
      <span class="v g2 grow"><span class="t13 w6 ${past ? "muted" : "ink"} tk-evtime2">${esc(D.time(e.start) + " – " + D.time(e.end))}</span>
        <span class="flow"><span class="t15 w6 ${past ? "muted" : "ink"}">${esc(e.title)}</span>${past ? ui.tag("Ended") : ""}${live ? ui.tag("NOW", "ink") : ""}</span>
        <span class="t13 muted">${esc(e.location ? `${e.location} · ${e.calendar}` : e.calendar)}</span></span>
      ${icon("chevron.right", 'class="chev"')}</button>`;
  }
  function schedule(day) {
    const evs = eventsOn(day), a = D.start(day), b = D.add(a, 1), now = new Date();
    const spans = evs.filter((e) => !e.allDay).map((e) => [max(e.start, a), e.end < b ? e.end : b]).filter((s) => s[0] < s[1]).sort((x, y) => x[0] - y[0]);
    let mins = 0, cur = null;
    for (const s of spans) { if (cur && s[0] <= cur[1]) cur[1] = max(cur[1], s[1]); else { if (cur) mins += (cur[1] - cur[0]) / 60000; cur = [...s]; } }
    if (cur) mins += (cur[1] - cur[0]) / 60000;
    const pct = Math.round(mins / 600 * 100);
    const warn = pct >= 85 && F.rule("bufferWarn", true);   // DayCapacity.bookedWarning: the Task Engine rule can turn it off
    const head = `${ui.label2("Schedule")}<span class="sp"></span><span class="t12 w5 ${warn ? "c-warm" : "ink2"}">${warn ? `${pct}% booked · leave 15–20% open` : `${pct}% booked · ${Math.max(0, 100 - pct)}% margin`}</span>`;
    const rows = evs.map((e) => `<div class="tk-row">${e.allDay
      ? `<button type="button" class="plain tk-allday evtint press" data-act="tk-event" data-id="${esc(e.id)}" style="--evc:${rgba(e.color, 1)};--evt:${rgba(e.color, 0.18)}"><span class="t13 ink2">All day</span><span class="t15 w6 ink">${esc(e.title)}</span></button>`
      : eventRow(e, now)}</div>`).join("");
    return sec(head + ui.btn({ label: "Event", icon: "plus", kind: "small", act: "tk-addevent" }), `${rows}${evs.length ? "" : textRow("Nothing on the calendar. Block time for your A tasks and Big Rocks first.")}`);
  }
  F.on("tk-event", (el) => { const e = F.events().find((x) => x.id === el.dataset.id); if (e) openEvent(e); });
  F.on("tk-addevent", () => openEvent(null, { day: T.day }));

  // Daily record of events
  function record(p, day) {
    const entries = pday(p, day).record;
    const rows = entries.map((r, i) => `<div class="tk-row top rec"><span class="t13 muted rectime">${esc(D.time(D.fromRef(r.time)))}</span><span class="t15 ink grow wrap">${esc(r.text)}</span>
      <button type="button" class="btn icon rdel" data-act="tk-rec-del" data-i="${i}" aria-label="Delete this entry">${icon("trash")}</button></div>`).join("");
    return sec(ui.label2("Daily record of events"), rows + addRow("record:" + D.key(day), "Log a call, decision or commitment", "tk-record"));
  }
  F.onSubmit("tk-record", async () => { const t = takeDraft("record:" + D.key(T.day)); if (t) await log(t, T.day); });
  F.on("tk-rec-del", (el) => updateDay(T.day, (x) => { x.record.splice(+el.dataset.i, 1); }));

  // ------------------------------------------------------------ OverloadBanner + MoveTasksSheet
  function nudgeHidden() { try { return Date.now() / 1000 <= +(localStorage.getItem("friday.capacityNudgeHiddenUntil") || 0); } catch { return false; } }
  function basisLine(e) {
    if (e.basis === "profile") return "Based on your planner profile and your calendar.";
    if (e.basis === "pace") return e.pace ? `Based on your own pace: you finish about ${Math.round(e.pace)} a day. Setting up your planner makes this more accurate.` : "Based on your own pace. Setting up your planner makes this more accurate.";
    return "Based on a standard day with your calendar. Setting up your planner makes this more accurate.";
  }
  function overloadBanner(day) {
    if (day < today0()) return "";
    const e = estimate(day);
    if (!e.overloaded && !e.tooManyAs) return "";
    return `<div class="card attention p16 v g8 overload">
      <span class="h g8 t16 w6 c-attention">${icon("exclamationmark.triangle.fill", 'style="width:18px;height:18px;flex:none"')}${esc(e.overloaded ? `${dayName(day)} looks overloaded` : "A lot of A's")}</span>
      ${e.overloaded ? `<p class="t15 ink">${esc([
        e.workOver ? `Work: ${e.workCount} to-do${e.workCount === 1 ? "" : "s"}, about ${hm(e.workNeeded)}, with about ${hm(e.workFree)} open around meetings.` : "",
        e.homeOver ? `Home: ${e.homeCount} to-do${e.homeCount === 1 ? "" : "s"}, about ${hm(e.homeNeeded)}, with about ${hm(e.homeFree)} once family time is set aside.` : "",
        `About ${e.fits} of ${e.tasks.length} fit${e.reasons.length ? " around " + e.reasons.join(", ") : ""}. The rest tend to roll over.`].filter(Boolean).join(" "))}</p>` : ""}
      ${e.tooManyAs ? `<p class="t15 ink">${esc(`${e.aCount} are marked A. A's are the few that truly must happen today; consider making some of them B.`)}</p>` : ""}
      <p class="t13 muted">${esc(basisLine(e))}</p>
      ${ui.actbar([e.basis !== "profile" && !nudgeHidden() ? ui.btn({ label: "Not now", kind: "small", act: "tk-nudge-hide" }) : "",
        e.basis !== "profile" && !nudgeHidden() ? ui.btn({ label: "Set up my planner", kind: "small", act: "tk-setup" }) : "",
        e.overloaded ? ui.btn({ label: "Pick what to move", kind: "small", cls: "tinted", act: "tk-move" }) : ""])}</div>`;
  }
  F.on("tk-move", () => openMoveTasks(T.day));
  F.on("tk-setup", () => (F.openPlannerSetup ? F.openPlannerSetup() : F.openOrganizer?.()));
  F.on("tk-nudge-hide", () => { try { localStorage.setItem("friday.capacityNudgeHiddenUntil", String(Date.now() / 1000 + 7 * 86400)); } catch {} F.render(); });

  function openMoveTasks(day) {
    const picked = new Set();
    let target = null;
    const rank = (t) => ({ C: 0, "": 1, B: 2, A: 3 }[t.fc?.letter || ""] ?? 1);
    const model = () => {
      const e = estimate(day);
      const ordered = [...e.tasks].sort((a, b) => rank(a) - rank(b) || (-(a.fc?.number ?? 0)) - (-(b.fc?.number ?? 0)));
      return { e, ordered, suggested: new Set(ordered.slice(0, e.excess).map((t) => t.id)), days: nextDays(day) };
    };
    const s = F.sheet({
      title: "Lighten the day", leading: { label: "Cancel" },
      body: () => {
        const { e, ordered, suggested, days } = model();
        let best = null; for (const x of days) if (!best || x[1] > best[1]) best = x;
        return `<div class="narrow v g16">
          <p class="t15 ink2">${esc(`About ${e.fits} of ${e.tasks.length} fit ${dayName(day).toLowerCase()}. Check the ones to move. The ones marked Suggested are the lowest priority.`)}</p>
          <div class="v g8">${ui.label2("Move to")}<div class="flow">${days.map(([d, room]) => `<button type="button" class="plain daypick press ${target && D.same(d, target) ? "on" : ""}" data-x="day" data-day="${D.key(d)}" aria-pressed="${!!(target && D.same(d, target))}">
              <span class="t15 w6">${esc(D.short(d))}</span><span class="t12">${esc(room > 0 ? `room for ~${hm(room)}` : "already full")}</span></button>`).join("")}</div>
            ${best ? `<p class="t13 muted">${esc(`Most room: ${fmtWide(best[0])}.`)}</p>` : ""}</div>
          <div class="v g8">${ui.label2(`To-dos on ${dayName(day).toLowerCase()}`)}
            ${ordered.map((t) => chip((code(t.fc) ? code(t.fc) + " · " : "") + t.title + (suggested.has(t.id) ? "  (Suggested)" : ""), picked.has(t.id), "pick", { id: t.id })).join("")}</div></div>`;
      },
      foot: () => ui.btn({ label: !picked.size ? "Check what to move" : !target ? "Pick a day" : `Move ${picked.size} to ${wdAbbr(target)}`, kind: "primary", wide: true, act: "tk-sheet-primary", disabled: !picked.size || !target }),
    });
    s.refresh = s.update;
    s.el.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-x]"); if (!b) return;
      if (b.dataset.x === "day") target = D.parse(b.dataset.day);
      if (b.dataset.x === "pick") { const id = b.dataset.id; picked.has(id) ? picked.delete(id) : picked.add(id); }
      s.update();
    });
    s.onPrimary = async () => {
      if (!target || !picked.size) return;
      const n = picked.size, t = target;
      s.close();
      await F.cmd("forward_todos", { ids: [...picked], due: D.key(t) }, `Moved ${n} to ${D.wd(t)}.`);
    };
  }
  /** DiagnosticChip: a tappable answer chip, neutral when off, raised with a check when on. */
  const chip = (title, on, x, data = {}) => `<button type="button" class="plain optchip press ${on ? "on" : ""}" data-x="${x}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")} aria-pressed="${on}">
    ${icon(on ? "checkmark.square.fill" : "square")}<span class="t16 ink">${esc(title)}</span></button>`;

  // ------------------------------------------------------------ CloseOutSheet
  function openCloseOut(dayKey) {
    const day = D.parse(dayKey) || today0();
    const tasks = dayTasks(day).filter((t) => !t.done);
    const handled = {};
    const nextDay = max(D.add(D.start(day), 1), D.add(today0(), 1));
    const MARKS = [["✓", "Completed"], ["→", "Forward to tomorrow"], ["•", "In progress"], ["D", "Delegate"], ["✗", "Delete"]];
    const s = F.sheet({
      title: isToday(day) ? "Close out today" : `Close out ${D.md(day)}`,
      leading: { label: "Close" }, trailing: { label: "Done", act: "tk-sheet-primary" },
      body: () => `<div class="narrow v g16">
        <div class="tk-card"><div class="tk-row pad"><p class="t15 ink2">Give every task a mark: ✓ done, → forward, • in progress, D delegated, ✗ deleted. Each mark saves right away.</p></div></div>
        <div class="tk-card">${tasks.map((t) => `<div class="tk-row v g8 top pad co">
            <div class="h g8 fill">${priorityBadge(t.fc)}<span class="t15 ink grow">${esc(t.title)}</span>${handled[t.id] ? `<span class="t17 w7 ${handled[t.id] === "✓" ? "c-done" : handled[t.id] === "✗" ? "c-danger" : "ink2"}">${esc(handled[t.id])}</span>` : ""}</div>
            <div class="comarks">${MARKS.map(([sym, label]) => `<button type="button" class="btn ${sym === "✗" ? "destructive" : ""}" data-x="mark" data-sym="${esc(sym)}" data-id="${esc(t.id)}" aria-label="${esc(label)}">${esc(sym)}</button>`).join("")}</div></div>`).join("")
          || `<div class="tk-row"><p class="t15 c-done">Everything on this page is closed out.</p></div>`}</div></div>`,
      foot: '<p class="t13 muted center">Anything left unmarked is forwarded to tomorrow when you tap Done.</p>',
    });
    let busy = false;
    s.el.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-x=mark]"); if (!b || busy) return;
      const t = tasks.find((x) => x.id === b.dataset.id), sym = b.dataset.sym; if (!t) return;
      busy = true;
      try {
        if (sym === "D") {
          const r = await F.alert({ title: "Delegated to", message: "Who has it? It stays on your list as a follow-up.", input: { placeholder: "Name" }, buttons: [{ label: "Save", value: "save" }, { label: "Cancel", kind: "cancel" }] });
          const who = trim(r?.text);
          if (r && who) { await F.cmd("set_franklin", { todoID: t.id, meta: fullFC({ ...t.fc, delegate: who }) }); handled[t.id] = "D"; s.update(); await log(`D ${t.title} → ${who}`, day); }
          return;
        }
        if (sym === "✓") await F.cmd("complete_todo", { todoID: t.id });
        if (sym === "→") await F.cmd("forward_todos", { ids: [t.id], due: D.key(nextDay) });
        if (sym === "•") await F.cmd("forward_todos", { ids: [t.id], due: D.key(nextDay), inProgress: true });
        if (sym === "✗") await F.cmd("delete_todo", { todoID: t.id });
        handled[t.id] = sym; s.update();
        await log(`${sym} ${t.title}`, day);
      } catch (ex) { console.error(ex); F.toast("Couldn't do that: " + F.friendly(ex.message)); }
      finally { busy = false; }
    });
    s.onPrimary = async () => {
      const rest = tasks.filter((t) => !handled[t.id]);
      s.close();
      if (F.prefs().closeOutForwardRest !== "0" && rest.length) await F.cmd("forward_todos", { ids: rest.map((t) => t.id), due: D.key(nextDay) });
      await save((p) => {
        const k = D.key(day), x = normDay(p.days[k]);
        if (rest.length) x.record.push({ id: F.uuid(), time: D.toRef(new Date()), text: `→ ${rest.length} open task${rest.length === 1 ? "" : "s"} forwarded` });
        x.closed = true; p.days[k] = x;
      });
      F.toast("Day closed out" + (rest.length ? `, ${rest.length} forwarded.` : "."));
    };
    return s;
  }

  // ------------------------------------------------------------ Master page
  function masterPage() {
    const open = openTodos(), tomorrow = D.add(today0(), 1);
    const undated = open.filter((t) => !t.due).sort(fcCmp);
    const later = open.filter((t) => t.due && t.due >= tomorrow).sort((a, b) => a.due - b.due);
    const gc = (l) => open.filter((t) => t.fc?.letter === l && !t.due).length;
    const row = (t) => franklinRow(t, t.due ? D.start(t.due) : today0(), gc,
      { trailing: !t.due || !isToday(t.due) ? ui.btn({ label: "Today", kind: "small", act: "tk-totoday", data: { id: t.id }, aria: `Put ${t.title} on today's list` }) : "" });
    return `<div class="tk-list tk-cols">
      ${sec(ui.label2("Master task list · no date yet"), undated.map(row).join("") || textRow("Nothing waiting without a date."), { foot: "Pull items onto a day when you plan. Forwarded items land here when you choose \"Master list\"." })}
      ${sec(ui.label2("Coming up"), later.map(row).join("") || textRow("Nothing scheduled after today."))}</div>`;
  }
  F.on("tk-totoday", (el) => F.cmd("forward_todos", { ids: [el.dataset.id], due: D.key(today0()), keepLetter: true }));

  // ------------------------------------------------------------ Lists page
  function listsPage() {
    const ls = lists(), open = openTodos();
    const far = new Date(8.64e15);
    const body = ls.map((l) => {
      const items = open.filter((t) => t.list === l.title || (l.from || []).includes(t.list)).sort((a, b) => ((a.due || far) - (b.due || far)) || fcCmp(a, b));
      const folded = T.folded.has(l.title);
      const gc = (x) => items.filter((t) => t.fc?.letter === x).length;
      const head = `<button type="button" class="plain listhead" data-act="tk-fold" data-list="${esc(l.title)}" aria-label="${esc(`${l.title}, ${items.length} open. ${folded ? "Show" : "Hide"}`)}">
        <span class="dot" style="background:${esc(l.color)}"></span><span class="t15 w6 ink">${esc(l.title)}</span><span class="t13 w6 muted">${items.length}</span><span class="sp"></span>${icon(folded ? "chevron.down" : "chevron.up", 'class="fold"')}</button>`;
      if (folded) return `<section class="tk-sec"><div class="tk-head">${head}</div></section>`;
      return sec(head, items.map((t) => franklinRow(t, t.due ? D.start(t.due) : today0(), gc)).join("") + (items.length ? "" : textRow(`Nothing open in ${l.title}.`)) + addRow("list:" + l.title, `Add to ${l.title}`, "tk-listadd", { list: l.title }));
    }).join("");
    // LY-7: "Edit lists" lives in the Lists page's own header, not the tab header
    const head = `<div class="tk-pagehead">${ui.label2(`${ls.length} list${ls.length === 1 ? "" : "s"}`)}${ui.btn({ label: "Edit lists", icon: "list.bullet", kind: "small", act: "tk-editlists" })}</div>`;
    return `${head}<div class="tk-list tk-cols">${body || sec("", textRow("No lists yet. Tap Edit lists to add one."))}</div>`;
  }
  F.on("tk-fold", (el) => { const n = el.dataset.list; T.folded.has(n) ? T.folded.delete(n) : T.folded.add(n); F.render(); });
  F.onSubmit("tk-listadd", async (f, form) => {
    const list = form.dataset.list, t = takeDraft("list:" + list); if (!t) return;
    // Task Engine rule "quick tasks get a C" (the app does it for spoken ones; a one-line add is the website's quick task)
    const c = F.rule("quickDefaultC", false) ? { letter: "C", number: F.todos().filter((x) => !x.done && x.fc?.letter === "C").length + 1 } : {};
    await F.cmd("add_todo", { title: t, list, ...c }, `Added “${t}” to ${list}` + (c.letter ? ` as ${c.letter}${c.number}` : ""));
  });

  // ------------------------------------------------------------ Week page (Weekly Compass)
  function weekPage() {
    const p = P(), wk = T.week, w = pweek(p, wk);
    const thisWeek = D.same(D.weekStart(new Date()), wk);
    const head = `<div class="tk-clear v g8">
      <div class="h g8 datenav">${navBtn(-1, "tk-week", "Previous week")}<span class="t17 w6 ink grow center">${esc("Week of " + D.md(wk))}</span>${navBtn(1, "tk-week", "Next week")}
        ${thisWeek ? "" : small("This week", "tk-week", { dir: 0 })}</div>
      ${ui.actbar([ui.btn({ label: "Edit roles", icon: "person.2", act: "tk-roles" })])}
      <button type="button" class="plain card actas press" data-act="tk-wk-compass" aria-description="Edit this week's Compass">
        ${ui.compass(F.compassFor({ ...p, days: {} }, wk), { label: String(w.compass || "").trim() ? "Compass · this week" : w.suggestedCompass ? "Compass · suggested" : "Compass",
                          placeholder: "Tap to write this week's Compass: who you're being across your roles." })}</button>
      ${(() => { const rd = w.rocks.filter((r) => r.done).length, a = weekAs(wk);
        return `<div class="tk-card tk-meters two sec-health">${meter("Big Rocks done", rd, w.rocks.length, "No Big Rocks yet this week. Add one or two for each role below.", `${rd} of ${w.rocks.length} Big Rocks done this week`)}
          ${meter("A's done this week", a.done, a.total, "No A tasks planned this week yet.", `${a.done} of ${a.total} A tasks done this week`)}</div>`; })()}</div>`;
    const roles = p.roles.map((role) => {
      const rocks = w.rocks.filter((r) => r.roleID === role.id);
      const rows = rocks.map((r) => `<div class="tk-row rock">${ui.check(r.done, "tk-rock-done", { id: r.id, wk: weekKey(wk) }, r.title)}
        <span class="t15 grow ${r.done ? "muted strike" : "ink"}">${esc(r.title)}</span>
        ${r.scheduled ? ui.tag("Scheduled", "done") : r.done ? "" : small("Block time", "tk-rock-block", { id: r.id, wk: weekKey(wk) })}
        <button type="button" class="btn icon rdel" data-act="tk-rock-del" data-id="${esc(r.id)}" aria-label="${esc("Remove " + r.title)}">${icon("trash")}</button></div>`).join("");
      const add = rocks.length >= 2 ? `<div class="tk-row"><p class="t13 muted">Two Big Rocks is the most for one role, so each gets real time. Finish or remove one to add another.</p></div>`
        : addRow("rock:" + role.id, `Big Rock for ${role.name}`, "tk-rockadd", { role: role.id });
      const rn = rocks.filter((r) => r.done).length, rc = F.roleColor(role.name);
      const mini = rocks.length >= 2 ? `<span class="sp"></span><span class="rk-mini">${ui.pbar(rn, rocks.length, `${role.name}: ${rn} of ${rocks.length} Big Rocks done`, "sm", rc ? `linear-gradient(90deg, ${rc.fill}, ${rc.next})` : "")}<span class="t12 w7 ink2 num">${rn}/${rocks.length}</span></span>` : "";
      return sec(`<span class="h g8 ${F.roleClass(role.name)}"><span class="role-dot"></span>${ui.label2(role.name, "role-l")}</span>${mini}`, rows + add);
    }).join("");
    const saw = sec(ui.label2("Sharpen the saw · renew yourself", "lwrap"), SAW.map((dim) => `<div class="tk-row rock">${ui.check(!!w.sawDone[dim], "tk-saw-done", { dim }, dim)}
        <label class="v g2 grow"><span class="t13 w6 muted">${esc(dim)}</span><input id="tk-saw-${esc(dim.replace(/\W+/g, ""))}" class="bare t15" placeholder="This week's renewal" value="${esc(w.saw[dim] || "")}" data-change="tk-saw" data-dim="${esc(dim)}" autocomplete="off"></label></div>`).join(""),
      { foot: "One small thing this week for each part of you: body, mind, heart and spirit." });
    return `<div class="tk-list tk-cols">${head}${roles}${saw}</div>`;
  }
  F.on("tk-week", (el) => { const d = +el.dataset.dir; T.week = d === 0 ? D.weekStart(new Date()) : D.add(T.week, 7 * d); F.render(); });
  F.on("tk-roles", () => openRolesSheet());
  // deleting the weekly self-renewal keystone marks the week like the apps do, so no app puts it back (Jose 11-20)
  F.on("tk-rock-del", (el) => save((p) => {
    const k = weekKey(T.week), w = normWeek(p.weeks[k]);
    const gone = w.rocks.find((r) => r.id === el.dataset.id);
    w.rocks = w.rocks.filter((r) => r.id !== el.dataset.id);
    if (gone && p.profile?.keystone && gone.title === p.profile.keystone) w.keystoneDismissed = true;
    p.weeks[k] = w;
  }));
  F.on("tk-saw-done", (el) => updateWeek(T.week, (w) => { w.sawDone[el.dataset.dim] = !w.sawDone[el.dataset.dim]; }));
  F.onChange("tk-saw", (el) => updateWeek(T.week, (w) => { w.saw[el.dataset.dim] = el.value; }).catch((e) => F.toast(F.friendly(e.message))));
  F.onSubmit("tk-rockadd", async (f, form) => {
    const role = form.dataset.role, t = takeDraft("rock:" + role); if (!t) return;
    await updateWeek(T.week, (w) => { w.rocks.push({ id: F.uuid(), roleID: role, title: t, done: false, scheduled: false }); });
  });

  // ------------------------------------------------------------ Values page (productivity pyramid)
  function valuesPage() {
    const p = P();
    const fld = (path, value, placeholder, cls = "t15", multi = false) => multi
      ? `<textarea id="tk-pf-${esc(path.replace(/\W+/g, ""))}" class="input org-fb ${cls} auto" rows="${multi === 1 ? 1 : 2}" placeholder="${esc(placeholder)}" data-change="tk-pf" data-path="${esc(path)}">${esc(value)}</textarea>`
      : `<input id="tk-pf-${esc(path.replace(/\W+/g, ""))}" class="input org-fb ${cls}" placeholder="${esc(placeholder)}" value="${esc(value)}" data-change="tk-pf" data-path="${esc(path)}" autocomplete="off">`;
    const del = (coll, id, what) => `<button type="button" class="btn icon rdel" data-act="tk-pf-del" data-coll="${coll}" data-id="${esc(id)}" aria-label="${esc("Delete " + what)}">${icon("trash")}</button>`;
    const values = p.values.map((v) => `<div class="tk-row top"><div class="v g4 grow">${fld(`values.${v.id}.title`, v.title, "Value", "t15 w6", 1)}${fld(`values.${v.id}.detail`, v.detail || "", "What it means to you", "t15 ink2", 1)}</div>${del("values", v.id, v.title)}</div>`).join("");
    const longs = p.longGoals.map((g) => `<div class="tk-row top"><div class="v g8 grow">${fld(`longGoals.${g.id}.title`, g.title, "Goal", "t15 w6", 1)}
        <div class="h g8"><button type="button" class="plain linktag" data-act="tk-linkval" data-id="${esc(g.id)}">${ui.tag(valueName(p, g.valueID) ? "← " + valueName(p, g.valueID) : "Link a value")}</button>${fld(`longGoals.${g.id}.target`, g.target || "", "Target year", "t13 tk-when")}</div></div>${del("longGoals", g.id, g.title)}</div>`).join("");
    const mids = p.midGoals.map((g) => { const parent = p.longGoals.find((x) => x.id === g.parentID);
      return `<div class="tk-row top">${ui.check(!!g.done, "tk-mid-done", { id: g.id }, g.title)}<div class="v g8 grow">${fld(`midGoals.${g.id}.title`, g.title, "Milestone", "t15 w6", 1)}
        <div class="h g8"><button type="button" class="plain linktag" data-act="tk-linkgoal" data-id="${esc(g.id)}">${ui.tag(parent ? "← " + parent.title : "Link a goal")}</button>${fld(`midGoals.${g.id}.target`, g.target || "", "By when", "t13 tk-when")}</div></div>${del("midGoals", g.id, g.title)}</div>`; }).join("");
    // Tasks › Goals (his word): goals first, then what they serve. Every line is a tinted field: tap and type.
    return `<div class="tk-list tk-cols">
      ${sec(ui.label2("Long-range goals"), longs + addRow("long", "Add a goal", "tk-pfadd", { coll: "longGoals" }), { foot: "One to five years out. Tap a goal to change its words; link it to the value it serves." })}
      ${sec(ui.label2("Milestones"), mids + addRow("mid", "Add a milestone", "tk-pfadd", { coll: "midGoals" }), { foot: "Steps this year, quarter or month toward a goal. Check one off when it's done." })}
      ${sec(ui.label2("Mission"), `<div class="tk-row">${fld("mission", p.mission, "What matters most, in a sentence or two", "t15", true)}</div>`)}
      ${sec(ui.label2("Governing values"), values + addRow("value", "Add a governing value", "tk-pfadd", { coll: "values" }))}
      ${sec(ui.label2("Standing Compass"), `<div class="tk-row">${fld("actAs", p.actAs, "I act as…", "t15", true)}</div>`, { foot: "Your Compass for every week you don't write a new one. Leave it empty and Friday writes one each week from your roles, values and the week ahead." })}</div>`;
  }
  F.onChange("tk-pf", (el) => {
    const [coll, id, field] = el.dataset.path.split(".");
    save((p) => { if (!id) p[coll] = el.value; else { const x = p[coll].find((y) => y.id === id); if (x) x[field] = el.value; } }).catch((e) => F.toast(F.friendly(e.message)));
  });
  F.on("tk-pf-del", (el) => save((p) => { p[el.dataset.coll] = p[el.dataset.coll].filter((x) => x.id !== el.dataset.id); }));
  F.on("tk-mid-done", (el) => save((p) => { const g = p.midGoals.find((x) => x.id === el.dataset.id); if (g) g.done = !g.done; }));
  F.onSubmit("tk-pfadd", async (f, form) => {
    const coll = form.dataset.coll, key = { values: "value", longGoals: "long", midGoals: "mid" }[coll], t = takeDraft(key); if (!t) return;
    await save((p) => { p[coll].push(coll === "values" ? { id: F.uuid(), title: t, detail: "" } : { id: F.uuid(), title: t, target: "", done: false }); });
  });
  F.on("tk-linkval", (el) => {
    const p = P(), g = p.longGoals.find((x) => x.id === el.dataset.id); if (!g) return;
    const set = (v) => save((q) => { const x = q.longGoals.find((y) => y.id === g.id); if (x) { if (v) x.valueID = v; else delete x.valueID; } });
    menu(el, [{ items: [...(p.values.length ? [] : [{ label: "Add a value above first", note: true }]), ...p.values.map((v) => ({ label: v.title, run: () => set(v.id) })),
      ...(g.valueID ? [{ label: "Unlink", danger: true, run: () => set(null) }] : [])] }]);
  });
  F.on("tk-linkgoal", (el) => {
    const p = P(), g = p.midGoals.find((x) => x.id === el.dataset.id); if (!g) return;
    const set = (v) => save((q) => { const x = q.midGoals.find((y) => y.id === g.id); if (x) { if (v) x.parentID = v; else delete x.parentID; } });
    menu(el, [{ items: [...(p.longGoals.length ? [] : [{ label: "Add a long-range goal above first", note: true }]), ...p.longGoals.map((lg) => ({ label: lg.title, run: () => set(lg.id) })),
      ...(g.parentID ? [{ label: "Unlink", danger: true, run: () => set(null) }] : [])] }]);
  });

  // ------------------------------------------------------------ drag to reorder (List.onMove)
  function dnd(root, onDrop) {
    if (root._tkDnd) return; root._tkDnd = true;
    let drag = null;
    root.addEventListener("dragstart", (e) => {
      const r = e.target.closest?.("[data-dnd]"); if (!r) return;
      drag = { group: r.dataset.dnd, id: r.dataset.id, el: r }; r.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", r.dataset.id); } catch {}
    });
    root.addEventListener("dragover", (e) => {
      const r = e.target.closest?.("[data-dnd]"); if (!drag || !r || r.dataset.dnd !== drag.group) return;
      e.preventDefault();
      root.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
      if (r !== drag.el) { const b = r.getBoundingClientRect(); r.classList.add(e.clientY < b.top + b.height / 2 ? "drop-before" : "drop-after"); }
    });
    const end = () => { root.querySelectorAll(".drop-before,.drop-after,.dragging").forEach((x) => x.classList.remove("drop-before", "drop-after", "dragging")); };
    root.addEventListener("dragend", () => { end(); drag = null; });
    root.addEventListener("drop", (e) => {
      const r = e.target.closest?.("[data-dnd]"); if (!drag || !r || r.dataset.dnd !== drag.group) return;
      e.preventDefault();
      const before = r.classList.contains("drop-before");
      const ids = [...root.querySelectorAll(`[data-dnd="${CSS.escape(drag.group)}"]`)].map((x) => x.dataset.id).filter((id) => id !== drag.id);
      if (r.dataset.id !== drag.id) { const i = ids.indexOf(r.dataset.id); ids.splice(before ? i : i + 1, 0, drag.id); onDrop(drag.group, ids); }
      end(); drag = null;
    });
  }

  F.view("tasks", {
    render,
    after(root) {
      dnd(root, (group, ids) => {
        if (group.startsWith("day-")) F.cmd("renumber", { ids, letter: group.slice(4) }).catch((e) => F.toast(F.friendly(e.message)));
      });
      if (!root._tkCtx) {
        root._tkCtx = true;
        root.addEventListener("contextmenu", (e) => {        // touch-and-hold / right-click on the status mark = the same status menu
          const b = e.target.closest?.('[data-act="tk-done"]'); if (!b) return;
          const r = T.rows.get(b.dataset.id); if (!r) return;
          e.preventDefault(); menu(b, statusMenu(r.t, r.day));
        });
      }
      root.querySelectorAll("textarea.auto").forEach(autosize);
    },
  });
  const autosize = (ta) => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
  document.addEventListener("input", (e) => { if (e.target.matches?.("textarea.auto")) autosize(e.target); });

  // ------------------------------------------------------------ TodoEditSheet (EditSheets.swift)
  function openTodoEdit(todo, opts = {}) {
    if (typeof todo === "string") todo = findTodo(todo);
    const p = P();
    const ls = lists();
    const d = { title: opts.title || "", list: F.defaultList(), hasDue: false, due: D.key(today0()), hasTime: false, time: "09:00", notes: "", fc: fullFC(), repeatRule: "never" };
    let checklist = [], orig = null;
    if (todo) {
      Object.assign(d, { title: todo.title, list: todo.list || d.list, hasDue: !!todo.due, due: todo.due ? D.key(todo.due) : d.due, hasTime: !!(todo.due && todo.dueHasTime),
        time: todo.due && todo.dueHasTime ? D.hhmm(todo.due) : "09:00", notes: todo.notes || "", fc: fullFC(todo.fc), repeatRule: todo.repeatRule || (todo.repeats ? "weekly" : "never") });
      orig = { ...d, fc: { ...d.fc } };
    } else if (opts.due) { d.hasDue = true; d.due = opts.due; }
    if (!ls.some((l) => l.title === d.list) && ls[0]) d.list = ls[0].title;
    [checklist, d.notes] = splitChecklist(d.notes);
    const origNotes = todo ? joinChecklist(checklist, d.notes) : "";
    let newItem = "";

    const overloadNote = () => {
      if (!d.hasDue) return "";
      const due = D.parse(d.due); if (!due) return "";
      const sameDay = !!(todo?.due && D.same(todo.due, due));
      if (sameDay || due < today0()) return "";
      const e = estimate(due, { adding: minutesFor(d.fc.letter), excluding: todo?.id });
      const line = headsUp(e, due, true); if (!line) return "";
      const best = roomiestDay(due);
      return `<div class="frow"><div class="v g8 fill" style="padding:4px 0"><span class="h top g8 t13 w5 c-attention">${icon("exclamationmark.triangle.fill", 'style="width:15px;height:15px;flex:none;margin-top:1px"')}<span>${esc(line)}</span></span>
        ${best ? `<button type="button" class="btn small" data-x="usebest" data-day="${D.key(best[0])}" style="align-self:flex-start">${esc(`Use ${fmtWide(best[0])} instead`)}</button>` : ""}</div></div>`;
    };
    const listColor = () => ls.find((l) => l.title === d.list)?.color || "#767E8A";
    const goals = [...p.midGoals, ...p.longGoals];
    const body = () => `<div class="narrow form te">
      <div class="fsec"><div class="fgroup"><div class="frow"><textarea id="te-title" class="bare auto" rows="1" placeholder="To-do" data-f="title" aria-label="To-do">${esc(d.title)}</textarea></div></div></div>
      <div class="fsec"><div class="fgroup">
        <div class="frow"><span class="lbl">List</span><span class="dot" style="background:${esc(listColor())}"></span><select id="te-list" class="bare" data-f="list">${ls.map((l) => `<option ${l.title === d.list ? "selected" : ""}>${esc(l.title)}</option>`).join("")}</select></div>
        <div class="frow"><button type="button" class="rowlink h g8" data-x="lists">${icon("list.bullet", 'style="width:18px;height:18px"')}Edit lists…</button></div></div></div>
      <div class="fsec"><div class="fgroup">
        <div class="frow"><label class="lbl" for="te-hasdue">Due date</label><span class="switch"><input id="te-hasdue" type="checkbox" role="switch" data-f="hasDue" ${d.hasDue ? "checked" : ""}></span></div>
        ${d.hasDue ? `<div class="frow"><span class="lbl">Date</span><input id="te-due" class="bare right" type="date" value="${esc(d.due)}" data-f="due" required></div>
          <div class="frow"><label class="lbl" for="te-hastime">Remind me at a time</label><span class="switch"><input id="te-hastime" type="checkbox" role="switch" data-f="hasTime" ${d.hasTime ? "checked" : ""}></span></div>
          ${d.hasTime ? `<div class="frow"><span class="lbl">Time</span><input id="te-time" class="bare right" type="time" value="${esc(d.time)}" data-f="time" required></div>` : ""}
          <div class="frow"><span class="lbl">Repeat</span><select id="te-repeat" class="bare" data-f="repeatRule">${REPEATS.map(([k, l]) => `<option value="${k}" ${k === d.repeatRule ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
          ${overloadNote()}` : ""}</div>
        ${d.hasDue ? "" : '<p class="ffoot">Turn on a due date to make it repeat.</p>'}</div>
      <div class="fsec"><div class="fhead">Franklin</div><div class="fgroup">
        <div class="frow seg-row">${ui.seg("", ["None", "A", "B", "C"], d.fc.letter || "None").replace(/data-act=""/g, 'data-x="letter"')}</div>
        ${d.fc.letter ? `<div class="frow"><span class="lbl">Order: ${esc(d.fc.letter + (d.fc.number ?? 1))}</span><div class="stepper"><button type="button" data-x="num" data-d="-1" aria-label="Decrease" ${(d.fc.number ?? 1) <= 1 ? "disabled" : ""}>${icon("minus")}</button><span></span><button type="button" data-x="num" data-d="1" aria-label="Increase" ${(d.fc.number ?? 1) >= 30 ? "disabled" : ""}>${icon("plus")}</button></div></div>` : ""}
        <div class="frow"><span class="lbl">Quadrant</span><select id="te-q" class="bare" data-f="quadrant"><option value="0">Not set</option>${[1, 2, 3, 4].map((q) => `<option value="${q}" ${d.fc.quadrant === q ? "selected" : ""}>${esc(QNAMES[q])}</option>`).join("")}</select></div>
        <div class="frow"><span class="lbl">Role</span><select id="te-role" class="bare" data-f="role"><option value="">None</option>${p.roles.map((r) => `<option ${d.fc.role === r.name ? "selected" : ""}>${esc(r.name)}</option>`).join("")}${d.fc.role && !p.roles.some((r) => r.name === d.fc.role) ? `<option selected>${esc(d.fc.role)}</option>` : ""}</select></div>
        <div class="frow"><button type="button" class="rowlink h g8" data-x="roles">${icon("person.2", 'style="width:18px;height:18px"')}Edit roles…</button></div>
        <div class="frow"><span class="lbl">Goal</span><select id="te-goal" class="bare" data-f="goal"><option value="">None</option>${goals.map((g) => `<option ${d.fc.goal === g.title ? "selected" : ""}>${esc(g.title)}</option>`).join("")}${d.fc.goal && !goals.some((g) => g.title === d.fc.goal) ? `<option selected>${esc(d.fc.goal)}</option>` : ""}</select></div>
        <div class="frow"><label class="lbl" for="te-rock">Big Rock</label><span class="switch"><input id="te-rock" type="checkbox" role="switch" data-f="bigRock" ${d.fc.bigRock ? "checked" : ""}></span></div>
        <div class="frow"><input id="te-del" class="bare" placeholder="Delegated to (optional)" value="${esc(d.fc.delegate || "")}" data-f="delegate" autocomplete="off"></div></div>
        <p class="ffoot">A = vital, must do today · B = important, should do · C = optional. Number them in the order you'll do them. Goals come from the Values page.</p></div>
      <div class="fsec"><div class="fhead">${esc(checklist.length ? `Checklist · ${checklist.filter((i) => i.done).length} of ${checklist.length}` : "Checklist")}</div><div class="fgroup">
        ${checklist.map((it) => `<div class="frow"><button type="button" class="plain cbox ${it.done ? "on" : ""}" data-x="ctoggle" data-id="${it.id}" aria-label="${it.done ? "Done" : "Not done"}">${icon(it.done ? "checkmark.square.fill" : "square")}</button>
          <input id="te-c-${it.id}" class="bare ${it.done ? "strike muted" : ""}" placeholder="Step" value="${esc(it.text)}" data-f="citem" data-id="${it.id}" autocomplete="off">
          <button type="button" class="btn icon rdel" data-x="cdel" data-id="${it.id}" aria-label="Remove this step">${icon("trash")}</button></div>`).join("")}
        <div class="frow"><input id="te-newitem" class="bare" placeholder="Add a step" value="${esc(newItem)}" data-f="newItem" autocomplete="off"><button type="button" class="btn link" data-x="cadd" ${trim(newItem) ? "" : "disabled"}>Add</button></div></div>
        ${checklist.length ? '<p class="ffoot">Tap the trash button to remove a step.</p>' : ""}</div>
      <div class="fsec"><div class="fhead">Notes</div><div class="fgroup"><div class="frow"><textarea id="te-notes" class="bare auto" rows="3" placeholder="Notes" data-f="notes">${esc(d.notes)}</textarea></div></div></div>
      ${todo ? `<div class="fsec"><div class="fgroup danger"><button type="button" class="plain delrow" data-x="delete">${icon("trash")}Delete to-do</button></div></div>` : ""}
    </div>`;
    const s = F.sheet({
      title: todo ? "Edit to-do" : "New to-do", leading: { label: "Cancel" },
      trailing: () => ({ label: todo ? "Save" : "Add", act: "tk-sheet-primary", disabled: !trim(d.title) }),
      body,
    });
    const after = () => s.el.querySelectorAll("textarea.auto").forEach(autosize);
    const redraw = () => { s.update(); after(); };
    after();
    if (!todo) s.el.querySelector("#te-title")?.focus();
    const primary = () => s.el.querySelector(".sheetbar .btn.primary");
    // Esc with something typed asks first (same Keep/Discard as Compose); the Cancel button is his explicit choice and just closes
    const startTitle = d.title, startNotes = d.notes;
    s.guard = { dirty: () => d.title !== startTitle || d.notes !== startNotes || trim(newItem) !== "" || (!todo && checklist.length > 0),
      title: todo ? "Discard your changes?" : "Discard this to-do?", message: todo ? "Your changes to this to-do aren't saved yet." : "It hasn't been added yet.", leave: todo ? "Discard changes" : "Discard", stay: "Keep editing" };
    s.el.addEventListener("input", (e) => {
      const f = e.target.dataset?.f; if (!f) return;
      const v = e.target.value;
      if (f === "title") { d.title = v; const b = primary(); if (b) b.disabled = !trim(v); }
      else if (f === "notes") d.notes = v;
      else if (f === "delegate") d.fc.delegate = v || null;
      else if (f === "citem") { const it = checklist.find((x) => x.id === e.target.dataset.id); if (it) it.text = v; }
      else if (f === "newItem") { newItem = v; const b = s.el.querySelector('[data-x="cadd"]'); if (b) b.disabled = !trim(v); }
    });
    s.el.addEventListener("change", (e) => {
      const f = e.target.dataset?.f; if (!f) return;
      const el = e.target, v = el.value;
      if (f === "list") d.list = v;
      else if (f === "hasDue") d.hasDue = el.checked;
      else if (f === "hasTime") d.hasTime = el.checked;
      else if (f === "due") { if (v) d.due = v; }
      else if (f === "time") { if (v) d.time = v; }
      else if (f === "repeatRule") d.repeatRule = v;
      else if (f === "quadrant") d.fc.quadrant = +v || null;
      else if (f === "role") d.fc.role = v || null;
      else if (f === "goal") d.fc.goal = v || null;
      else if (f === "bigRock") d.fc.bigRock = el.checked;
      else return;
      if (["list", "hasDue", "hasTime", "due"].includes(f)) redraw();
    });
    s.el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset?.f === "newItem") { e.preventDefault(); addItem(); } });
    const addItem = () => { const t = trim(newItem); if (!t) return; checklist.push({ id: F.uuid(), text: t, done: false }); newItem = ""; redraw(); s.el.querySelector("#te-newitem")?.focus(); };
    s.el.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-x]"); if (!b || b.disabled) return;
      const x = b.dataset.x;
      if (x === "letter") { const l = b.dataset.value; d.fc.letter = l === "None" ? null : l; if (d.fc.letter && d.fc.number == null) d.fc.number = 1; redraw(); }
      else if (x === "num") { d.fc.number = Math.min(30, Math.max(1, (d.fc.number ?? 1) + +b.dataset.d)); redraw(); }
      else if (x === "ctoggle") { const it = checklist.find((i) => i.id === b.dataset.id); if (it) it.done = !it.done; redraw(); }
      else if (x === "cdel") { checklist = checklist.filter((i) => i.id !== b.dataset.id); redraw(); }
      else if (x === "cadd") addItem();
      else if (x === "usebest") { d.due = b.dataset.day; redraw(); }
      else if (x === "lists") { const ls2 = openListsSheet(); ls2.onDone = () => { const nl = lists(); ls.splice(0, ls.length, ...nl); if (!ls.some((l) => l.title === d.list) && ls[0]) d.list = ls[0].title; redraw(); }; }
      else if (x === "roles") { const rs = openRolesSheet(); rs.onDone = (renames = {}) => { Object.assign(p, P()); if (d.fc.role && renames[d.fc.role]) d.fc.role = renames[d.fc.role]; redraw(); }; }
      else if (x === "delete") {
        const ok = await F.alert({ title: `Delete "${d.title}"?`, message: "It's removed from Apple Reminders on all your devices.", buttons: [{ label: "Delete to-do", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
        if (!ok) return;
        s.close();
        await F.cmd("delete_todo", { todoID: todo.id }, "Deleted: " + todo.title);
      }
    });
    s.onPrimary = async () => {
      const title = trim(d.title); if (!title) return;
      const notes = joinChecklist(checklist, d.notes);
      const repeat = d.hasDue ? d.repeatRule : "never";
      const fc = fullFC({ ...d.fc, number: d.fc.letter ? (d.fc.number ?? 1) : null, delegate: trim(d.fc.delegate) || null });
      const due = d.hasDue ? D.parse(d.due) : null;
      const toast = (todo ? "Saved " : "Added ") + `“${title}”` + (due ? ", due " + D.short(due) : "");
      s.close();
      if (todo) {
        const c = { todoID: todo.id, title, list: d.list, hasDue: d.hasDue, fc, repeat };
        if (d.hasDue) { c.due = d.due; if (d.hasTime) c.time = d.time; }
        if (notes !== origNotes) c.notes = notes;          // the snapshot carries trimmed notes; only send them when he changed them
        await F.cmd("update_todo", c, toast);
      } else {
        const c = { title, list: d.list, notes, repeat, letter: fc.letter, number: fc.number, quadrant: fc.quadrant, role: fc.role, bigRock: fc.bigRock, goal: fc.goal };
        if (d.hasDue) { c.due = d.due; if (d.hasTime) c.time = d.time; }
        await F.cmd("add_todo", c, toast);
      }
    };
    return s;
  }

  // ------------------------------------------------------------ ListsSheet (ListsRolesViews.swift)
  function openListsSheet() {
    const names = {};
    let newName = "";
    const s = F.sheet({
      title: "Lists", trailing: { label: "Done", act: "tk-sheet-primary" },
      body: () => `<div class="narrow form">
        <div class="fsec"><div class="fgroup">${lists().map((l, i) => `<div class="frow lsrow">
            <label class="list-swatch" style="background:${esc(l.color)}"><span class="sr">${esc("Color for " + l.title)}</span><input type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(l.color) ? l.color : "#767e8a")}" data-x="color" data-list="${esc(l.title)}"></label>
            <input id="ls-n-${i}" class="bare" value="${esc(names[l.title] ?? l.title)}" placeholder="List name" data-x="name" data-list="${esc(l.title)}" autocomplete="off" enterkeyhint="done">
            <span class="t15 muted" aria-label="${esc(listCount(l.title) + " open to-dos")}">${listCount(l.title)}</span>
            <button type="button" class="btn destructive lsdel" data-x="del" data-list="${esc(l.title)}" aria-label="${esc("Delete list " + l.title)}">${icon("trash")}</button></div>`).join("") || '<div class="frow"><span class="muted">No lists yet.</span></div>'}</div>
          <p class="ffoot">Tap a name to rename it, the color dot to change its color, the trash button to delete it.</p></div>
        <div class="fsec"><div class="fhead">Add a list</div><div class="fgroup"><div class="frow"><input id="ls-new" class="bare" placeholder="New list name" value="${esc(newName)}" data-x="new" autocomplete="off">
          <button type="button" class="btn small" data-x="add" ${trim(newName) ? "" : "disabled"}>Add</button></div></div></div></div>`,
      onClose: () => s.onDone?.(),
    });
    s.refresh = s.update;
    const commit = async (old) => { const n = trim(names[old]); delete names[old]; if (n && n !== old) await F.cmd("rename_list", { old, new: n }); };
    const add = async () => { const n = trim(newName); if (!n) return; newName = ""; await F.cmd("add_list", { name: n }); s.update(); };
    s.el.addEventListener("input", (e) => {
      const x = e.target.dataset?.x;
      if (x === "name") names[e.target.dataset.list] = e.target.value;
      if (x === "new") { newName = e.target.value; const b = s.el.querySelector('[data-x="add"]'); if (b) b.disabled = !trim(newName); }
    });
    s.el.addEventListener("change", (e) => {
      const x = e.target.dataset?.x;
      if (x === "color") F.cmd("set_list_color", { name: e.target.dataset.list, color: e.target.value.toUpperCase() }).then(() => s.update());
      if (x === "name") commit(e.target.dataset.list).then(() => s.update());
    });
    s.el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset?.x === "new") { e.preventDefault(); add(); } if (e.key === "Enter" && e.target.dataset?.x === "name") { e.preventDefault(); e.target.blur(); } });
    s.el.addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-x]"); if (!b || b.disabled) return;
      if (b.dataset.x === "add") add();
      if (b.dataset.x === "del") {
        const l = b.dataset.list;
        const ok = await F.alert({ title: `Delete "${l}"?`, message: "It's removed from Apple Reminders on all your devices. This can't be undone.",
          buttons: [{ label: `Delete list and its ${listCount(l)} to-dos`, kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
        if (ok) { await F.cmd("delete_list", { name: l }); s.update(); }
      }
    });
    s.onPrimary = async () => { const olds = Object.keys(names); s.close(); for (const o of olds) await commit(o); };
    return s;
  }

  // ------------------------------------------------------------ RolesSheet
  function openRolesSheet() {
    const p0 = P();
    let roles = p0.roles.map((r) => ({ ...r }));
    const original = Object.fromEntries(p0.roles.map((r) => [r.id, r.name]));
    const removed = new Set();
    let newRole = "", saved = false;
    const s = F.sheet({
      title: "Roles", trailing: { label: "Done", act: "tk-sheet-primary" },
      body: () => `<div class="narrow form">
        <div class="fsec"><div class="fgroup">${roles.map((r) => `<div class="frow" draggable="true" data-dnd="roles" data-id="${esc(r.id)}">
            <span class="grip" aria-hidden="true">${icon("line.3.horizontal")}</span>
            <span class="role-dot rc${roles.indexOf(r) % 8}" aria-hidden="true"></span>
            <input id="rs-${esc(r.id)}" class="bare" value="${esc(r.name)}" placeholder="Role" data-x="name" data-id="${esc(r.id)}" autocomplete="off">
            <button type="button" class="btn destructive lsdel" data-x="del" data-id="${esc(r.id)}" aria-label="${esc("Delete role " + r.name)}">${icon("trash")}</button></div>`).join("") || '<div class="frow"><span class="muted">No roles yet.</span></div>'}</div>
          <p class="ffoot">Tap a role to rename it, hold the ≡ handle and drag to reorder, tap the trash button to delete it. Most people have 4 to 7: work roles plus self, family, community.</p></div>
        <div class="fsec"><div class="fhead">Add a role</div><div class="fgroup"><div class="frow"><input id="rs-new" class="bare" placeholder="New role, e.g. Father, Job seeker" value="${esc(newRole)}" data-x="new" autocomplete="off">
          <button type="button" class="btn small" data-x="add" ${trim(newRole) ? "" : "disabled"}>Add</button></div></div></div></div>`,
      onClose: () => { persist(); },
    });
    const persist = async () => {
      if (saved) return; saved = true;
      try {
        await save((p) => {
          p.roles = roles.map((r) => ({ id: r.id, name: r.name }));
          if (removed.size) for (const k of Object.keys(p.weeks)) { const w = normWeek(p.weeks[k]); w.rocks = w.rocks.filter((x) => !removed.has(x.roleID)); p.weeks[k] = w; }
        });
        for (const r of roles) {          // a renamed role keeps its to-dos: their role tag is rewritten to the new name
          const old = original[r.id];
          if (!old || old === r.name || !trim(r.name)) continue;
          for (const t of openTodos().filter((x) => x.fc?.role === old)) await F.cmd("set_franklin", { todoID: t.id, meta: fullFC({ ...t.fc, role: r.name }) });
        }
      } catch (ex) { console.error(ex); F.toast("Couldn't save roles: " + F.friendly(ex.message)); }
      s.onDone?.(Object.fromEntries(roles.filter((r) => original[r.id] && original[r.id] !== r.name && trim(r.name)).map((r) => [original[r.id], r.name])));
    };
    const add = () => { const n = trim(newRole); if (!n) return; roles.push({ id: F.uuid(), name: n }); newRole = ""; s.update(); s.el.querySelector("#rs-new")?.focus(); };
    s.el.addEventListener("input", (e) => {
      const x = e.target.dataset?.x;
      if (x === "name") { const r = roles.find((y) => y.id === e.target.dataset.id); if (r) r.name = e.target.value; }
      if (x === "new") { newRole = e.target.value; const b = s.el.querySelector('[data-x="add"]'); if (b) b.disabled = !trim(newRole); }
    });
    s.el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset?.x === "new") { e.preventDefault(); add(); } });
    s.el.addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-x]"); if (!b || b.disabled) return;
      if (b.dataset.x === "add") add();
      if (b.dataset.x === "del") {
        const r = roles.find((y) => y.id === b.dataset.id); if (!r) return;
        const ok = await F.alert({ title: `Delete the role “${r.name}”?`, message: "Its Big Rocks are removed too. To-dos tagged with it keep their other details.",
          buttons: [{ label: "Delete role", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
        if (ok) { roles = roles.filter((y) => y.id !== r.id); removed.add(r.id); s.update(); }
      }
    });
    dnd(s.el, (group, ids) => { roles = ids.map((id) => roles.find((r) => r.id === id)).filter(Boolean); s.update(); });
    s.onPrimary = () => s.close();
    return s;
  }

  // ------------------------------------------------------------ what other screens use
  F.openTodoEdit = openTodoEdit;
  F.openCloseOut = openCloseOut;
  F.openListsSheet = openListsSheet;
  F.openRolesSheet = openRolesSheet;
  /** PlannerNav.go: open Tasks on a page and day ("3 more for tomorrow"). */
  F.openTasks = (page = "day", day = null) => { setPage(page); if (day) T.day = D.start(typeof day === "string" ? D.parse(day) : day); T.query = ""; if (location.hash.slice(1) !== "tasks") location.hash = "tasks"; else F.render(); };
  F.dayCapacity = { estimate, headsUp, roomiestDay, hm, dayName };
})();
