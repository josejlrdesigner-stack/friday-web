// Morning "Act As" ritual — once a day, on the first open after 4 am, a full-screen moment before the day starts:
// greeting + date · today's Act As line (or a field to write one) · the 90-day needle goal and where it stands ·
// today's A1 · the planning streak · Friday's core (idle). One button: "Start my day" → Tasks › Day.
// Turn it off in Settings › Your planner › Morning ritual (prefs.ritualOff = "1"). No chat here: chat is iPhone/iPad only.
"use strict";
(() => {
  const { D, ui, esc } = F;
  const WEEKS = 13;
  const seenKey = (d) => "friday.ritual." + D.key(d);
  let shownThisSession = null;   // day key, in case storage is blocked
  let open = null;

  // ------------------------------------------------------------ the data
  const greeting = (h) => (h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Late night");
  const planner = () => { const p = F.planner() || {}; p.days ||= {}; p.weeks ||= {}; p.midGoals ||= []; p.longGoals ||= []; p.profile ||= {}; return p; };
  const actAsToday = (p, d) => F.compassFor(p, d);

  /** When the 90 days started: 13 weeks before the goal's "by …" date, else the first week holding one of its milestones. */
  function goalStart(p, g) {
    goalStart.fromDate = false;
    const t = String(g.target || "").replace(/^by\s+/i, "").trim();
    if (t) {
      const now = new Date(), y = now.getFullYear();
      let d = new Date(`${t} ${y}`);
      if (isNaN(d)) d = new Date(t);
      if (!isNaN(d)) {
        if (!/\d{4}/.test(t) && d < D.add(now, -60)) d = new Date(`${t} ${y + 1}`);
        goalStart.fromDate = true;
        return D.add(D.start(d), -WEEKS * 7);
      }
    }
    const ms = new Set(p.profile.milestones || []);
    const keys = Object.keys(p.weeks).filter((k) => (p.weeks[k]?.rocks || []).some((r) => ms.has(r.title))).sort();
    return keys.length ? D.parse(keys[0]) : null;
  }
  function needle(p) {
    const id = p.profile.needleGoalID;
    const g = id && [...p.midGoals, ...p.longGoals].find((x) => x.id === id);
    if (!g) return null;
    const start = goalStart(p, g), today = D.start(new Date());
    const week = start ? Math.min(WEEKS, Math.max(1, Math.floor(D.daysBetween(start, today) / 7) + 1)) : null;
    // the 90-day needle (spec "Charts and graphs"): only when the goal has a date — days elapsed ÷ 90
    const dated = !!start && goalStart.fromDate;
    const day = dated ? Math.min(90, Math.max(1, D.daysBetween(start, today) + 1)) : null;
    const rocks = Object.values(p.weeks).flatMap((w) => w?.rocks || []);
    const milestones = (p.profile.milestones || []).map((title) => ({ title, done: rocks.some((r) => r.title === title && r.done) }));
    return { g, week, dated, day, total: 90, milestones };
  }
  /** Today's A1: the open A to-do with the lowest number that's due today (or overdue). */
  function a1() {
    const end = D.add(D.start(new Date()), 1);
    return F.todos().filter((t) => !t.done && t.fc?.letter === "A" && t.due && t.due < end).sort((a, b) => (a.fc.number ?? 99) - (b.fc.number ?? 99))[0] || null;
  }
  /** Days in a row planned or closed out, counting today if it already counts, else from yesterday. */
  function streak(p) {
    const counts = (d) => { const x = p.days[D.key(d)]; return !!(x && (x.planned || x.closed)); };
    let d = D.start(new Date()), n = 0;
    if (!counts(d)) d = D.add(d, -1);
    while (counts(d) && n < 999) { n++; d = D.add(d, -1); }
    const last7 = [...Array(7)].map((_, i) => { const day = D.add(D.start(new Date()), i - 6); return { day, on: counts(day) }; });
    return { n, last7 };
  }

  /** Shared with the Brief's stat tiles: today's A1 and the planning streak (days in a row). */
  F.ritualKit = { a1, streakDays: () => streak(planner()).n, goal: () => needle(planner()), goalHTML: (nd) => goalBars(nd) };

  /** 90-day goal: time used (days ÷ 90) next to milestones done ÷ total — real numbers on every bar. */
  function goalBars(nd) {
    const md = nd.milestones.filter((m) => m.done).length, mn = nd.milestones.length;
    const time = nd.dated
      ? `<div class="v g4"><span class="h g8"><span class="t12 w7 ink2">Time used</span><span class="sp"></span><span class="t12 w7 ink2 num">Day ${nd.day} of ${nd.total}</span></span>${ui.pbar(nd.day, nd.total, `Day ${nd.day} of ${nd.total}`, "", "var(--g-friday)")}</div>`
      : `<p class="invite">Give this goal a “by” date to see how much of the 90 days is used.</p>`;
    const ms = mn && nd.dated
      ? `<div class="v g4"><span class="h g8"><span class="t12 w7 ink2">Milestones</span><span class="sp"></span><span class="t12 w7 ink2 num">${md} of ${mn} done</span></span>${ui.pbar(md, mn, `${md} of ${mn} milestones done`, "done-fill")}</div>`
      : "";
    return time + ms;
  }

  // ------------------------------------------------------------ the screen
  function body() {
    const now = new Date(), p = planner(), act = actAsToday(p, now), nd = needle(p), top = a1(), st = streak(p);
    const dateLine = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    const actCard = act
      ? ui.compass(act)
      : `<label class="v g8"><span class="t13 muted">Who do you want to be today? One line is enough.</span>
          <textarea id="rit-actas" class="input rit-field" rows="2" placeholder="Today I act as a calm, focused…" maxlength="240"></textarea></label>`;
    const goalCard = nd ? `<section class="rit-card sec-friday">
        <div class="h g8">${ui.label2("90-day goal")}<span class="sp"></span>${nd.week && !nd.dated ? `<span class="t13 w7 ink2 num">Week ${nd.week} of ${WEEKS}</span>` : ""}</div>
        <p class="t-card-title wrap">${esc(nd.g.title)}</p>
        ${goalBars(nd)}
        ${nd.milestones.length ? `<ul class="rit-ms">${nd.milestones.map((m) => `<li class="${m.done ? "done" : ""}">${F.icon(m.done ? "checkmark" : "dot")}<span>${esc(m.title)}</span></li>`).join("")}</ul>
          ${nd.dated ? "" : `<p class="t13 muted">${nd.milestones.filter((m) => m.done).length} of ${nd.milestones.length} milestones done</p>`}` : ""}
      </section>` : "";
    const a1Card = `<section class="rit-card sec-brief">
        ${ui.label2("Your A1 today")}
        ${top ? `<div class="h g16"><span class="a1tile" aria-hidden="true">A${esc(top.fc.number ?? 1)}</span><p class="t-card-title wrap grow"><span class="sr">A${esc(top.fc.number ?? 1)}: </span>${esc(top.title)}</p></div>
          ${top.fc.bigRock ? `<p class="t13 c-done w6">Big Rock · it moves your week forward</p>` : ""}`
          : `<p class="t15 muted">No A1 yet. Pick the one thing that matters most when you plan your day.</p>`}
      </section>`;
    const streakCard = `<section class="rit-card rit-streak sec-brief">
        <span class="rit-flame" aria-hidden="true">${F.icon("flame")}</span>
        <div class="v g4 grow">${ui.label2("Planning streak")}
          <p class="t17 w7 ink">${st.n ? `<span class="rit-n">${st.n}</span> day${st.n === 1 ? "" : "s"} in a row` : "Start a streak today"}</p></div>
        <div class="rit-days" role="img" aria-label="${st.last7.filter((x) => x.on).length} of the last 7 days planned">${st.last7.map((x) => `<span class="${x.on ? "on" : ""}"><i></i>${esc(D.wdShort(x.day).slice(0, 1))}</span>`).join("")}</div>
      </section>`;
    return `<div class="rit">
      <div class="rit-band"><div class="rit-band-in">
        <div class="rit-brand">${ui.fmark(24)}<span>F.R.I.D.A.Y.</span>${ui.btn({ icon: "xmark", kind: "icon", cls: "rit-x", act: "rit-close", aria: "Not now", title: "Not now (Esc)" })}</div>
        <div class="rit-hero" aria-hidden="true"><canvas id="rit-core"></canvas></div>
        <div class="v g4 rit-greet"><span class="band-label">${esc(dateLine)}</span><h1 id="rit-title" class="band-greet">${esc(greeting(now.getHours()) + F.withName())}</h1></div>
      </div></div>
      <div class="rit-in">
        <section class="rit-card rit-actcard sec-friday actas-l">${act ? "" : ui.label2("Compass")}${actCard}</section>
        ${goalCard}${a1Card}${streakCard}
      </div>
    </div>
    <div class="rit-foot"><div class="rit-go">${ui.btn({ label: "Start my day", kind: "primary", wide: true, act: "rit-start" })}</div></div>`;
  }

  function openRitual() {
    if (open?.open) return open;
    const d = document.createElement("dialog");
    d.className = "sheet full ritual";
    d.setAttribute("aria-labelledby", "rit-title");
    d.innerHTML = body();
    document.body.appendChild(d);
    d.addEventListener("close", () => { d.remove(); if (open === d) open = null; });
    open = d;
    d.showModal();
    F.core(d.querySelector("#rit-core"), { compact: false, mode: "idle" });
    d.querySelector(".rit-go .btn")?.focus({ preventScroll: true });
    return d;
  }
  F.openRitual = openRitual;
  F.on("rit-close", (el) => el.closest("dialog")?.close());

  F.on("rit-start", async (el) => {
    const d = el.closest("dialog"), field = d?.querySelector("#rit-actas"), text = field?.value.trim();
    d?.close();
    F.openTasks?.("day");
    if (text) {
      const k = D.key(new Date());
      await F.savePlanner((p) => { p.days ||= {}; p.days[k] = { record: [], planned: false, closed: false, ...(p.days[k] || {}), actAs: text }; });
      F.toast("Saved today's Act As");
    }
  });

  /** Due? first open of the day after 4 am, data loaded, not turned off, nothing else open. */
  function maybeShow() {
    const now = new Date();
    if (now.getHours() < 4 || !F.S.payload || F.prefs().ritualOff === "1") return;
    if (document.querySelector("dialog[open]")) return;
    const key = seenKey(now);
    let seen = shownThisSession === D.key(now);
    try { seen = seen || !!localStorage.getItem(key); } catch {}
    if (seen) return;
    shownThisSession = D.key(now);
    try { localStorage.setItem(key, "1"); } catch {}
    setTimeout(openRitual, 0);
  }
  F.onRender(maybeShow);
})();
