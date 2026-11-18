// Brief tab — port of DashboardView (FridayApp.swift) and the cards it shows, in the app's order:
// header · PlannerGuideCard (GuideViews.swift) · access banner · DayLoadCard + LoadRing · NextUpCard (ScheduleViews.swift)
// · TodoPanel(brief: true) (TodoViews.swift) · CommsSummary (Tabs.swift) · TodayPanel · WeekPanel (ScheduleViews.swift).
// Compact (< 640 px) is one column; wider uses the app's non-compact branch (two rows of side-by-side cards).
// Event pieces (EventRow, AllDayChips, CalendarFilterButton, AccessOffRow) come from F.calKit in calendar.js.
"use strict";
(() => {
  const { D, ui, esc } = F;
  const K = () => F.calKit;

  F.addIcons({
    "moon.stars.fill": '<path d="M17 14.5A7.5 7.5 0 1 1 8 4.5a6 6 0 0 0 9 10z" fill="currentColor" stroke="none"/><path d="M17.5 3.5v3M16 5h3M20.5 9v2M19.5 10h2"/>',
    "sunrise.fill": '<path d="M3 18h18M7 18a5 5 0 0 1 10 0" /><path d="M7 18a5 5 0 0 1 10 0z" fill="currentColor"/><path d="M12 3v4M9.5 5.5L12 3l2.5 2.5M4.2 11.2l1.4 1.4M19.8 11.2l-1.4 1.4M8 21h8"/>',
    "sun.max.fill": '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    "sunset.fill": '<path d="M3 18h18M7 18a5 5 0 0 1 10 0z" fill="currentColor"/><path d="M3 18h18M12 3v4.5M9.5 5L12 7.5 14.5 5M4.2 11.2l1.4 1.4M19.8 11.2l-1.4 1.4M8 21h8"/>',
  });

  // ------------------------------------------------------------ helpers
  const firstName = () => { const n = String(F.prefs().fromName || "").trim().split(/\s+/)[0]; return n || "Boss"; };
  const plural = (v, w) => `${v} ${w}${v === 1 ? "" : "s"}`;
  const fcSort = (a, b) => { const k = (t) => [{ A: 0, B: 1, C: 2 }[t.fc?.letter] ?? 3, t.fc?.number ?? 999]; const x = k(a), y = k(b); return x[0] - y[0] || x[1] - y[1]; };
  const dueSort = (a, b) => (a.due ?? Infinity) - (b.due ?? Infinity);

  /** store.buckets over open to-dos */
  function buckets() {
    const today = D.start(new Date()), tomorrow = D.add(today, 1);
    const open = F.todos().filter((t) => !t.done);
    const b = { overdue: [], today: [], open };
    for (const t of open) {
      if (!t.due) continue;
      if (D.start(t.due) < today) b.overdue.push(t);
      else if (D.same(t.due, today)) b.today.push(t);
    }
    b.overdue.sort(dueSort);
    b.tomorrow = open.filter((t) => t.due && D.same(t.due, tomorrow)).sort(fcSort);
    return b;
  }

  /** MailStore.inbox: newest INBOX messages, all accounts */
  function mailState() {
    const m = F.mail();
    if (!m || !(m.accounts || []).length) return null;
    const inboxName = (acc) => (m.folders?.[acc]?.find((f) => f.role === "inbox")?.name) || "INBOX";
    const inbox = (m.messages || []).filter((x) => x.folder === inboxName(x.accountID) || x.folder === "INBOX").sort((a, b) => b.date - a.date);
    return { m, inbox, accounts: m.accounts, drafts: m.drafts || [] };
  }
  const MAIL_PALETTE = ["#6D28D9", "#57534E", "#9D174D", "#3F3F46", "#86198F", "#475569"];
  const accColor = (a) => MAIL_PALETTE[((a?.colorIndex ?? 0) % MAIL_PALETTE.length + MAIL_PALETTE.length) % MAIL_PALETTE.length];

  // ------------------------------------------------------------ header
  function header(now) {
    const h = now.getHours();
    const [greet, ic] = h < 5 ? ["Late night", "moon.stars.fill"] : h < 12 ? ["Good morning", "sunrise.fill"]
      : h < 17 ? ["Good afternoon", "sun.max.fill"] : h < 21 ? ["Good evening", "sunset.fill"] : ["Late night", "moon.stars.fill"];
    const dateLine = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + " · " + D.time(now);
    return `<div class="h bottom g16 brief-head">
      <div class="v g4 grow">${ui.label2(dateLine)}
        <div class="h g8">${F.icon(ic, 'class="greet-ic"')}<h1 class="t24 w6 ink">${esc(greet)}, ${esc(firstName())}</h1></div>
      </div>
      ${ui.btn({ icon: "gearshape", kind: "icon", filled: true, act: "brief-settings", aria: "Settings and connections" })}
    </div>`;
  }

  // ------------------------------------------------------------ PlannerGuideCard
  function nextStep(now) {
    const p = F.planner() || {};
    const hour = now.getHours(), weekday = now.getDay() + 1;   // Calendar weekday: 1 = Sunday
    const today = p.days?.[D.key(now)] || {};
    const week = p.weeks?.[D.key(D.weekStart(now))] || {};
    const rocks = week.rocks || [];
    if (!rocks.some((r) => !r.done) && (weekday === 1 || weekday === 2 || !rocks.length))
      return { title: "Plan your week", detail: "About 20 minutes: pick one or two Big Rocks for each role and block time for them first.", button: "Plan my week", go: "week" };
    if (hour >= 17 && !today.closed)
      return { title: "Close out your day", detail: "Two minutes: mark each task done, forward, in progress, delegated or deleted, so tomorrow starts clean.", button: "Close out", go: "closeout" };
    if (!today.planned && hour < 17)
      return { title: "Plan your day", detail: "About 15 minutes: list everything, mark A, B or C, and block time for your A's at your best hours.", button: "Plan my day", go: "day" };
    return { title: "You're on track", detail: today.planned ? "Today is planned. Work your A's first; your deep-work block is for A1." : "Planning tomorrow tonight makes the morning easier.",
             button: "See my A's", go: "day" };
  }
  function guideCard(now) {
    const p = F.planner();
    const setUp = F.prefs().plannerSetupDone === "1" && (p?.values || []).length > 0 && (p?.roles || []).length > 0;
    if (!setUp) {
      return `<section class="card friday-edge guide v g8">
        ${ui.label2("Start here", "friday")}
        <h2 class="t20 w6 ink">Set up your planner</h2>
        <p class="t15 ink2">Six quick questions, about three minutes. Tap or type. You'll get your values, roles, a 90-day goal, this week's Big Rocks and protected time on your calendar.</p>
        <div class="flow">${ui.btn({ label: "Start the 6 questions", icon: "arrow.right", kind: "primary", act: "brief-setup", data: { mode: "diagnostic" } })}${ui.btn({ label: "Pick a starter profile", act: "brief-setup", data: { mode: "starter" } })}</div>
      </section>`;
    }
    const s = nextStep(now);
    return `<section class="card friday-edge guide v g8">
      ${ui.label2("Your next step", "friday")}
      <h2 class="t20 w6 ink">${esc(s.title)}</h2>
      <p class="t15 ink2">${esc(s.detail)}</p>
      <div class="flow">${ui.btn({ label: s.button, kind: "primary", act: "brief-go", data: { go: s.go } })}${ui.btn({ label: "Organizer", icon: "target", act: "brief-organizer" })}</div>
    </section>`;
  }

  // ------------------------------------------------------------ access banner
  function accessBanner() {
    const a = F.snap()?.access;
    if (!a || (a.calendar !== false && a.reminders !== false)) return "";
    return `<div class="card attention p16 v g8">
      <p class="t15 w5 c-attention">F.R.I.D.A.Y. needs Full Access to Calendar and Reminders.</p>
      <p class="t13 muted">Open Settings on your iPhone to turn it on.</p>
    </div>`;
  }

  // ------------------------------------------------------------ DayLoadCard + LoadRing (ToolExecutor.dayLoadInfo)
  const isBackground = (e) => { const c = (e.calendar || "").toLowerCase(); return c.includes("holiday") || c.includes("birthday"); };
  function dayLoadInfo(evs, day, next) {
    const timed = evs.filter((e) => !e.allDay);
    const commitments = evs.filter((e) => e.allDay && !(isBackground(e) || (e.title || "").toLowerCase().includes("birthday")));
    const spans = timed.map((e) => [Math.max(e.start, day), Math.min(e.end, next)]).filter((s) => s[0] < s[1]).sort((a, b) => a[0] - b[0]);
    let minutes = 0, cur = null;
    for (const s of spans) {
      if (cur && s[0] <= cur[1]) cur = [cur[0], Math.max(cur[1], s[1])];
      else { if (cur) minutes += (cur[1] - cur[0]) / 60000; cur = s; }
    }
    if (cur) minutes += (cur[1] - cur[0]) / 60000;
    const n = timed.length, hours = minutes / 60;
    let label;
    if (n === 0) label = commitments.length ? "all-day commitment" : "open";
    else if (n === 1 && hours < 7) label = "light";
    else if (n <= 2 && hours < 4) label = "light";
    else if (n <= 4 && hours < 6) label = "moderate";
    else if (n < 7 && hours < 8) label = "busy";
    else label = "packed";
    return { label, minutes, count: n };
  }
  const loadTitle = (l) => (l === "open" ? "Open day" : l === "all-day commitment" ? "All-day commitment" : l[0].toUpperCase() + l.slice(1) + " day");
  const loadColors = (l) => (l === "open" || l === "light" ? ["var(--ink2)", "var(--control)"] : l === "moderate" ? ["var(--ink)", "var(--ink2)"] : ["var(--warm)", "var(--warm)"]);

  let ringPlayed = false;   // the arc fills once on appear, not on every 60-second refresh
  function loadRing(fraction, fill, size) {
    const s = 100, c = 50;
    const r0 = c - s * 0.025 - 0.5;                 // hairline + gold ticks (padding s*0.025)
    const r1 = c - s * 0.12 - s * 0.03;             // booked track (padding s*0.12, line s*0.06)
    const r2 = c - s * 0.22 - 0.5;                  // cyan dashed inner ring (padding s*0.22)
    const circ = 2 * Math.PI * r1, pct = Math.round(fraction * 100);
    return `<div class="loadring" style="width:${size}px;height:${size}px" role="img" aria-label="${pct} percent of the day booked">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="${r0}" fill="none" stroke="var(--hairline)" stroke-width="${100 / size}"/>
        <g class="spin-cw"><circle cx="50" cy="50" r="${r0}" fill="none" stroke="var(--gold)" stroke-opacity=".75" stroke-width="2.5" stroke-dasharray="0.8 5"/></g>
        <circle cx="50" cy="50" r="${r1}" fill="none" stroke="var(--divider)" stroke-width="6"/>
        ${fraction > 0 ? `<circle class="booked ${ringPlayed ? "" : "anim"}" cx="50" cy="50" r="${r1}" fill="none" stroke="${fill}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${circ * fraction} ${circ}" transform="rotate(-90 50 50)" style="--circ:${circ}"/>` : ""}
        <g class="spin-ccw"><circle cx="50" cy="50" r="${r2}" fill="none" stroke="var(--friday-light)" stroke-width="${100 / size}" stroke-dasharray="15 5"/></g>
      </svg>
      <div class="lr-text"><span class="pct" style="font-size:${size * 0.2}px">${pct}%</span><span class="bk" style="font-size:${Math.max(10, size * 0.1)}px">booked</span></div>
    </div>`;
  }
  function dayLoadCard(now, ringSize, b, ms) {
    const day = D.start(now), next = D.add(day, 1);
    const evs = K().eventsOn(now);
    const info = dayLoadInfo(evs, day, next);
    const frac = Math.min(1, info.minutes / 600);
    const [textColor, fill] = loadColors(info.label);
    const unread = ms ? ms.inbox.filter((m) => !m.seen).length : 0;
    const holiday = evs.find((e) => e.allDay && isBackground(e));
    let summary = `${plural(info.count, "event")}, ${plural(b.today.length + b.overdue.length, "to-do")} due, ${unread} new email${unread === 1 ? "" : "s"}.`;
    if (holiday) summary += ` ${holiday.title} today.`;
    return `<section class="card p16 h g16 dayload">
      ${loadRing(frac, fill, ringSize)}
      <div class="v g4 grow">${ui.label2("Day load")}<p class="t20 w6" style="color:${textColor}">${esc(loadTitle(info.label))}</p><p class="t13 muted">${esc(summary)}</p></div>
    </section>`;
  }

  // ------------------------------------------------------------ NextUpCard
  function nextUp(now) {
    const all = F.events();
    const tomorrow = D.add(D.start(now), 1);
    const timed = all.filter((e) => !e.allDay && e.end > now).sort((a, b) => a.start - b.start);
    const allDay = all.filter((e) => e.allDay && e.start >= tomorrow).sort((a, b) => a.start - b.start);
    const firstTimed = timed[0];
    const primaryAllDay = allDay.find((e) => !isBackground(e) && e.start < (firstTimed?.start ?? Infinity));
    const primary = primaryAllDay || firstTimed;
    if (!primary) return null;
    const also = allDay.filter((e) => e.id !== primary.id && D.same(e.start, primary.start));
    return { e: primary, also };
  }
  function countdown(e, now) {
    const days = D.daysBetween(now, e.start);
    const dayWord = days === 1 ? "Tomorrow" : days < 7 ? D.wd(e.start) : e.start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    if (e.allDay) return days === 0 ? "Today, all day" : `${dayWord}, all day`;
    const mins = Math.trunc((e.start - now) / 60000);
    if (mins <= 0) return "Happening now";
    if (mins < 60) return `in ${mins} min`;
    if (days === 0) return `in ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
    return dayWord + " " + D.time(e.start);
  }
  function nextUpCard(now) {
    const n = nextUp(now);
    if (!n) {
      return `<section class="card p16 v g4 nextup">${ui.label2("Next up", "ink2")}
        <p class="t15 muted">${K().calendarAccess() ? "Nothing else on the calendar this week." : "Waiting for calendar access."}</p></section>`;
    }
    const { e, also } = n;
    const when = e.allDay ? `${e.start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · All day`
      : `${D.time(e.start)} – ${D.time(e.end)}${e.location ? " · " + e.location : ""}`;
    return `<section class="card p16 h g16 nextup">
      <div class="v g4 grow">${ui.label2("Next up · " + countdown(e, now), "ink2")}
        <p class="t17 w6 ink wrap">${esc(e.title)}</p>
        <p class="t13 muted">${esc(when)}</p>
        ${also.length ? `<p class="t13 muted">${esc("Also that day: " + also.map((x) => x.title).join(" · "))}</p>` : ""}
      </div>
      ${ui.btn({ label: "Open", kind: "primary", act: "cal-open-event", data: { id: e.id }, aria: "Open " + e.title })}
    </section>`;
  }

  // ------------------------------------------------------------ TodoPanel(brief: true)
  function priorityBadge(t) {
    const l = t.fc?.letter; if (!l) return "";
    const code = l + (t.fc.number ?? "");
    return `<span class="pbadge pb-${l}" aria-label="Priority ${esc(code)}">${esc(code)}</span>`;
  }
  const plainNotes = (n) => String(n || "").replace(/⟦FC[\s\S]*?⟧/g, "").split("\n").filter((l) => !l.startsWith("☐ ") && !l.startsWith("☑ ")).join("\n").trim();
  function dueTag(t, showDay) {
    if (!t.due) return "";
    const diff = D.daysBetween(new Date(), t.due);
    if (diff < 0) { const a = t.fc?.letter === "A"; return ui.tag(diff === -1 ? "Yesterday" : `${-diff}d late`, a ? "danger" : "ink"); }
    if (!showDay) return t.dueHasTime ? ui.tag(D.time(t.due)) : "";
    if (diff === 0) return ui.tag(t.dueHasTime ? D.time(t.due) : "Today");
    if (diff === 1) return ui.tag("Tomorrow");
    if (diff < 7) return ui.tag(D.wdShort(t.due));
    return ui.tag(D.md(t.due));
  }
  /** TodoRow: DiamondCheck · PriorityBadge · title / list · notes · flag · due tag · chevron */
  function todoRow(t, { showList = true, showDay = true } = {}) {
    const notes = plainNotes(t.notes);
    return `<div class="todorow ${t.done ? "done" : ""}">
      ${ui.check(t.done, "brief-toggle", { id: t.id }, t.title)}
      ${priorityBadge(t)}
      <button type="button" class="plain todorow-open" data-act="brief-todo" data-id="${esc(t.id)}" aria-label="${esc(t.title)}. Edit, move or delete">
        <span class="v g2 grow">
          <span class="t15 tt">${esc(t.title)}</span>
          ${showList || notes ? `<span class="h g8 t13 muted sub">${showList ? `<span class="ldot" style="background:${esc(t.listColor || "#767E8A")}"></span><span class="nowrap">${esc(t.list || "")}</span>` : ""}${notes ? `<span class="ell">${esc(notes.split("\n")[0])}</span>` : ""}</span>` : ""}
        </span>
        ${t.important ? F.icon("flag.fill", 'class="flag" aria-label="Important"') : ""}
        ${dueTag(t, showDay)}
        ${F.icon("chevron.right", 'class="chev"')}
      </button>
    </div>`;
  }
  function briefDay(title, date, items, strong, empty, extra) {
    const shown = items.slice(0, 5);
    return `<div class="h g8 bday">
        <div class="bday-name"><span class="t15 w6 ink">${esc(title)}</span><span class="h g8 nowrap"><span class="t13 muted">${esc(date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }))}</span>${items.length ? ui.tag(`${items.length} due`, strong ? "ink" : "") : ""}</span></div>
        <span class="sp"></span>
        ${ui.btn({ icon: "plus", kind: "small", cls: "plusbtn", act: "brief-add-todo", data: { day: D.key(date) }, aria: `Add a to-do for ${title.toLowerCase()}` })}
      </div>
      ${items.length ? "" : `<p class="t15 muted bempty">${esc(empty)}</p>`}
      <div class="rows">${shown.map((t) => todoRow(t, { showDay: false })).join("")}</div>
      ${extra > shown.length ? `<div>${ui.btn({ label: `${extra - shown.length} more for ${title.toLowerCase()}`, kind: "link", act: "brief-tasks", cls: "t13" })}</div>` : ""}`;
  }
  function todoPanel(b) {
    const trailing = ui.btn({ label: "See all", kind: "small", act: "brief-tasks" });
    let body;
    if (!K().remindersAccess()) body = K().accessOffRow("Reminders");
    else {
      const today = [...b.overdue, ...b.today].sort(fcSort);
      const t0 = D.start(new Date());
      body = briefDay("Today", t0, today, true, "Nothing due today.", b.overdue.length + b.today.length)
        + '<div class="divider"></div>'
        + briefDay("Tomorrow", D.add(t0, 1), b.tomorrow, false, "Nothing on the docket yet.", b.tomorrow.length);
    }
    return ui.panel("To-dos", trailing, body, "todopanel");
  }

  // ------------------------------------------------------------ CommsSummary
  function messageRow(msg, acc, showAccount) {
    const from = msg.from?.name || msg.from?.email || "";
    const initials = (from.split(/[^\p{L}]+/u).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()) || "?";
    const c = accColor(acc), unread = !msg.seen, d = new Date(msg.date * 1000);
    const yest = D.same(d, D.add(new Date(), -1));
    const time = D.same(d, new Date()) ? D.time(d) : yest ? "Yesterday" : D.md(d);
    return `<button type="button" class="plain press msgrow" data-act="brief-msg" data-id="${esc(msg.id)}" aria-label="${esc(`${unread ? "Unread. " : ""}From ${from}. ${msg.subject}. ${time}`)}">
      <span class="av" style="color:${c};background:${K().hexRGBA(c, 0.13)}">${esc(initials)}</span>
      <span class="v g2 grow">
        <span class="h g8"><span class="t15 ink ell ${unread ? "w6" : ""}">${esc(from)}</span>${msg.flagged ? F.icon("flag.fill", 'class="mflag"') : ""}<span class="sp"></span><span class="t13 muted nowrap">${esc(time)}</span>${unread ? '<span class="udot"></span>' : ""}</span>
        <span class="t15 subj ${msg.seen ? "ink2" : "ink"}">${esc(msg.subject || "")}</span>
        ${showAccount && acc ? `<span><span class="tag" style="color:${c};background:${K().hexRGBA(c, 0.12)}">${esc(acc.label)}</span></span>` : ""}
      </span>
    </button>`;
  }
  function commsSummary(ms, compact) {
    if (!ms) {
      return ui.panel("Latest email", "", `<p class="t15 muted">No email connected.</p><p class="t13 muted">Email comes from your iPhone. Connect an account in F.R.I.D.A.Y. on the iPhone and it shows up here.</p>`, "comms");
    }
    const latest = ms.inbox.slice(0, compact ? 5 : 6);
    const unread = ms.inbox.filter((m) => !m.seen).length;
    const accById = new Map(ms.accounts.map((a) => [a.id, a]));
    const trailing = ui.btn({ label: "Compose", icon: "square.and.pencil", kind: "small", act: "brief-compose" });
    const nd = ms.drafts.length;
    const body = `<div class="flow">${ui.tag(`${unread} unread`, unread > 0 ? "ink" : "")}${nd ? ui.tag(`${nd} draft${nd === 1 ? "" : "s"} by Friday`, "friday") : ""}</div>
      ${latest.length ? "" : '<p class="t13 muted">Your inbox is empty, Boss.</p>'}
      <div class="rows">${latest.map((m) => messageRow(m, accById.get(m.accountID), ms.accounts.length > 1)).join("")}</div>
      ${ms.inbox.length > latest.length ? `<button type="button" class="plain viewall" data-act="brief-mail">View all ${ms.inbox.length} in Mail ${F.icon("chevron.right")}</button>` : ""}`;
    return ui.panel("Latest email", trailing, body, "comms");
  }

  // ------------------------------------------------------------ TodayPanel / WeekPanel
  function todayPanel(now) {
    const list = K().eventsOn(now);
    const allDay = list.filter((e) => e.allDay), timed = list.filter((e) => !e.allDay);
    const title = "Today" + (timed.length ? ` · ${timed.filter((e) => e.end > now).length} ahead` : "");
    const trailing = `<span class="h g8">${K().filterButton()}${ui.btn({ label: "Event", icon: "plus", kind: "small", act: "brief-add-event" })}</span>`;
    let body;
    if (!K().calendarAccess()) body = K().accessOffRow("Calendar");
    else body = K().allDayChips(allDay) + (timed.length ? timed.map((e) => K().eventRow(e, now)).join("") : '<p class="t15 muted">No events today.</p>');
    return ui.panel(title, trailing, body, "todaypanel");
  }
  function weekPanel(now) {
    const all = F.events();
    let html = "";
    for (let i = 1; i <= 6; i++) {
      const day = D.add(D.start(now), i);
      const evs = K().eventsOn(day, all);
      html += `<div class="v g8 wday">
        ${i > 1 ? '<div class="divider wdiv"></div>' : ""}
        <div class="h"><span class="t15 w6 ink nowrap">${esc(D.wd(day))}</span><span class="sp"></span><span class="t13 muted">${esc(D.md(day))}</span></div>
        ${K().allDayChips(evs.filter((e) => e.allDay))}
        ${evs.filter((e) => !e.allDay).map((e) => K().eventRow(e, now, false)).join("")}
        ${evs.length ? "" : '<p class="t13 muted">Open day</p>'}
      </div>`;
    }
    return ui.panel("Next 6 days", "", `<div class="v g8">${html}</div>`, "weekpanel");
  }

  // ------------------------------------------------------------ the view
  F.view("brief", {
    render() {
      if (!F.snap()) {
        return `${header(new Date())}<section class="panel"><p class="t15 muted">Waiting for your iPhone. Open F.R.I.D.A.Y. on the iPhone once so it can share your day.</p></section>`;
      }
      const now = new Date();
      const b = buckets(), ms = mailState();
      const top = header(now) + guideCard(now) + accessBanner() + K().failedCard([...K().TODO_KINDS, ...K().EVENT_KINDS]);
      // compact branch (one column, the app's iPhone order)
      const compact = `<div class="v g16 only-compact">
          ${dayLoadCard(now, 104, b, ms)}${nextUpCard(now)}${todoPanel(b)}${commsSummary(ms, true)}${todayPanel(now)}${weekPanel(now)}
        </div>`;
      // non-compact branch: DayLoad | NextUp, then (Today + Week) | (To-dos + Email)
      const wide = `<div class="v g16 only-wide">
          <div class="cols two">${dayLoadCard(now, 120, b, ms)}${nextUpCard(now)}</div>
          <div class="cols two">
            <div class="v g16">${todayPanel(now)}${weekPanel(now)}</div>
            <div class="v g16">${todoPanel(b)}${commsSummary(ms, false)}</div>
          </div>
        </div>`;
      return `<div class="brief v g16">${top}${compact}${wide}</div>`;
    },
    after() { if (F.snap()) ringPlayed = true; },
  });

  // ------------------------------------------------------------ actions
  F.on("brief-settings", () => { if (F.openSettings) F.openSettings(); });
  F.on("brief-setup", (el) => F.openSetup?.(el.dataset.mode));
  F.on("brief-go", (el) => {
    const go = el.dataset.go, today = F.D.key(new Date());
    if (go === "closeout") return F.openCloseOut?.(today);
    F.openTasks?.(go === "week" ? "week" : "day", today);
  });
  F.on("brief-organizer", () => F.openOrganizer?.());
  F.on("brief-tasks", () => { location.hash = "tasks"; });
  F.on("brief-mail", () => { location.hash = "mail"; });
  F.on("brief-compose", () => { if (F.openCompose) F.openCompose(); else location.hash = "mail"; });
  F.on("brief-msg", (el) => { if (F.openMessage) F.openMessage(el.dataset.id); else location.hash = "mail"; });
  F.on("brief-add-event", () => F.openEventEdit?.(null));
  F.on("brief-todo", (el) => { const t = F.todos().find((x) => x.id === el.dataset.id); if (t) F.openTodoEdit?.(t); });
  F.on("brief-add-todo", (el) => F.openTodoEdit?.(null, { due: el.dataset.day }));
  F.on("brief-toggle", async (el) => {
    const t = F.todos().find((x) => x.id === el.dataset.id); if (!t) return;
    el.classList.toggle("on", !t.done);   // instant feedback while the change is saved
    await F.cmd(t.done ? "uncomplete_todo" : "complete_todo", { todoID: t.id }, (t.done ? "Not done: " : "Done: ") + t.title);
  });
})();
