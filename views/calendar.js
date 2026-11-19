// Calendar tab — port of CalendarTab (Tabs.swift), EventRow / AllDayChips (ScheduleViews.swift),
// CalendarFilterButton / CalendarFilterView / AccessOffRow (Tabs.swift) and EventEditSheet (EditSheets.swift).
// Also exposes F.calKit (shared event pieces the Brief uses), F.openEventEdit and F.openCalendarFilter.
"use strict";
(() => {
  const { D, ui, esc } = F;

  // ------------------------------------------------------------ shared pieces
  const hexRGBA = (hex, a) => {
    const h = String(hex || "#767E8A").replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
    if (Number.isNaN(n)) return `rgba(118,126,138,${a})`;
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  /** The event's calendar color (pending ones from the website carry only the calendar title). */
  function evColor(e) {
    if (e.color) return e.color;
    const c = F.calendars().find((c) => c.id === e.calendarID || c.title === e.calendar);
    return c?.color || "#767E8A";
  }
  const access = () => F.snap()?.access || {};
  const calendarAccess = () => access().calendar !== false;
  const remindersAccess = () => access().reminders !== false;
  /** store.events(on:) — everything overlapping that day. */
  function eventsOn(day, all = F.events()) {
    const a = D.start(day), b = D.add(a, 1);
    return all.filter((e) => e.start < b && e.end > a);
  }
  const findEvent = (id) => F.events().find((e) => e.id === id);

  /** EventRow: time column + color bar + title/tags + location · calendar + chevron. Stacks the time when narrow. */
  function eventRow(e, now, dimPast = true) {
    const past = dimPast && e.end < now;
    const live = e.start <= now && e.end > now;
    const col = evColor(e);
    const start = D.time(e.start), end = D.time(e.end);
    const sub = e.location ? `${e.location} · ${e.calendar || ""}` : (e.calendar || "");
    // tinted block: the calendar color at 14% behind, a 3px solid bar on the left edge, dark ink text (Color spec 2026-11-18)
    return `<button type="button" class="plain press evrow evtint ${past ? "past" : ""}" data-act="cal-open-event" data-id="${esc(e.id)}"
        style="--evc:${past ? hexRGBA(col, 0.6) : hexRGBA(col, 1)};--evt:${hexRGBA(col, past ? 0.10 : 0.18)}"
        aria-label="${esc(`${e.title}, ${start} to ${end}${sub ? ", " + sub : ""}`)}">
      <span class="evrow-in">
        <span class="evtime"><span class="s">${esc(start)}</span><span class="e">${esc(end)}</span></span>
        <span class="evmain">
          <span class="evstack">${esc(start + " – " + end)}</span>
          <span class="evtitle"><span class="t">${esc(e.title)}</span>${past ? ui.tag("Ended") : ""}${live ? ui.tag("NOW", "ink") : ""}${e.pending && failedMap()[e.id] ? ui.tag("Not added", "attention") : ""}</span>
          <span class="evsub">${esc(sub)}</span>
        </span>
        ${F.icon("chevron.right", 'class="chev"')}
      </span>
    </button>`;
  }
  /** AllDayChips */
  function allDayChips(events) {
    if (!events.length) return "";
    return `<div class="v g8">${events.map((e) => { const col = evColor(e); return `<button type="button" class="plain press allday evtint" data-act="cal-open-event" data-id="${esc(e.id)}" style="--evc:${hexRGBA(col, 1)};--evt:${hexRGBA(col, 0.18)}">
      <span class="t13 ink2">All day</span><span class="t15 w6 ink ell">${esc(e.title)}</span></button>`; }).join("")}</div>`;
  }
  /** CalendarFilterButton: "Calendars" (+ "2/5" when some are hidden; neutral emphasis then). */
  function filterButton(labeled = false) {
    const all = F.calendars(), hidden = new Set(F.prefsHiddenCalendars());
    const total = all.length, shown = all.filter((c) => !hidden.has(c.id)).length;
    const some = shown < total;
    return `<button type="button" class="press calfilter ${some ? "some" : ""}" data-act="cal-filter" aria-label="Choose calendars, ${shown} of ${total} shown">
      ${F.icon("calendar")}<span class="lbl">${labeled ? "Choose calendars" : "Calendars"}</span>${some ? `<span>${shown}/${total}</span>` : ""}</button>`;
  }
  /** AccessOffRow — the Allow button lives on the iPhone; the web can only say so. */
  function accessOffRow(what) {
    return `<div class="card attention p16 accessoff"><span class="h g8 top c-attention t15 w5">${F.icon("exclamationmark.triangle.fill", 'class="wi"')}<span>${esc(what)} access is off, so nothing can show here.</span></span>
      <span class="t13 muted">Tap Allow in F.R.I.D.A.Y. on your iPhone.</span></div>`;
  }
  /** snapshot.failed: changes the iPhone couldn't carry out, shown where they belong. kinds = which command kinds to list. */
  const failedMap = () => F.snap()?.failed || {};
  function failedCard(kinds) {
    const f = failedMap(), cutoff = F.nowSec() - 3 * 86400;
    const words = { add_event: "Add event", update_event: "Change event", delete_event: "Delete event", add_todo: "Add to-do", update_todo: "Change to-do",
      complete_todo: "Check off", uncomplete_todo: "Uncheck", delete_todo: "Delete to-do", move_todo: "Move to-do", forward_todos: "Forward to-dos", set_franklin: "Set priority", renumber: "Renumber" };
    const todoTitle = (id) => F.todos().find((t) => t.id === id)?.title;
    const rows = (F.S.payload?.queue?.value || []).filter((c) => f[c.id] && kinds.includes(c.kind) && (c.at || 0) > cutoff)
      .map((c) => { const what = c.title || todoTitle(c.todoID) || ""; return `<li><span class="w6">${esc(words[c.kind] || c.kind)}${what ? ": " + esc(what) : ""}</span><br><span class="muted">${esc(f[c.id])}</span></li>`; });
    if (!rows.length) return "";
    return `<div class="card attention p16 v g8 failedcard" role="status"><span class="h g8 top c-attention t15 w5">${F.icon("exclamationmark.triangle.fill", 'class="wi"')}<span>Your iPhone couldn't do ${rows.length === 1 ? "this change" : `these ${rows.length} changes`}.</span></span>
      <ul class="t13 ink">${rows.join("")}</ul></div>`;
  }
  const EVENT_KINDS = ["add_event", "update_event", "delete_event"];
  const TODO_KINDS = ["add_todo", "update_todo", "complete_todo", "uncomplete_todo", "delete_todo", "move_todo", "forward_todos", "set_franklin", "renumber"];
  F.calKit = { failedCard, EVENT_KINDS, TODO_KINDS, failedMap, eventRow, allDayChips, filterButton, accessOffRow, eventsOn, evColor, hexRGBA, calendarAccess, remindersAccess, findEvent };

  F.on("cal-open-event", (el) => { const e = findEvent(el.dataset.id); if (e) openEventEdit(e); });
  F.on("cal-filter", () => openCalendarFilter());

  // ------------------------------------------------------------ CalendarFilterView
  function openCalendarFilter() {
    const api = F.sheet({
      title: "Calendars", trailing: { label: "Done", act: "sheet-close" }, id: "calfilter",
      body: () => {
        const hidden = new Set(F.prefsHiddenCalendars());
        const groups = {};
        for (const c of F.calendars()) (groups[c.source || ""] ||= []).push(c);
        return `<div class="narrow v g16">
          <p class="t15 ink2">Choose which calendars F.R.I.D.A.Y. shows. Hidden calendars stay in your account; they just don't appear here or in her answers.</p>
          ${Object.keys(groups).sort().map((src) => {
            const cals = groups[src], allOn = cals.every((c) => !hidden.has(c.id));
            return `<div class="card edge calgroup v g4">
              <div class="h g8">${ui.label2(src)}<span class="sp"></span>${ui.btn({ label: allOn ? "Hide all" : "Show all", kind: "small", act: "calf-all", data: { src, on: allOn ? "0" : "1" } })}</div>
              ${cals.map((c) => `<label class="h g8 calf-row"><span class="dot" style="background:${esc(c.color || "#767E8A")}"></span>
                <span class="t16 grow ${hidden.has(c.id) ? "muted" : "ink"}">${esc(c.title)}${c.writable === false ? ' <span class="t11 muted">read-only</span>' : ""}</span>
                <span class="switch"><input type="checkbox" role="switch" data-change="calf-one" data-id="${esc(c.id)}" ${hidden.has(c.id) ? "" : "checked"} aria-label="${esc(c.title)}"></span></label>`).join("")}
            </div>`;
          }).join("") || '<p class="t15 muted">No calendars yet. They come from your iPhone.</p>'}
        </div>`;
      },
    });
    api.refresh = api.update;
    return api;
  }
  async function setVisible(ids, visible) {
    const hidden = new Set(F.prefsHiddenCalendars());
    for (const id of ids) { if (visible) hidden.delete(id); else hidden.add(id); }
    await F.setPref("hiddenCalendars", [...hidden].join("\n"));
    F.refreshSheets();
  }
  F.on("calf-all", (el) => setVisible(F.calendars().filter((c) => (c.source || "") === el.dataset.src).map((c) => c.id), el.dataset.on === "1"));
  F.onChange("calf-one", (el) => { setVisible([el.dataset.id], el.checked).catch((e) => { F.toast("Couldn't do that: " + F.friendly(e.message)); F.refreshSheets(); }); });

  // ------------------------------------------------------------ EventEditSheet
  const localDT = (d) => `${D.key(d)}T${D.hhmm(d)}`;
  const parseDT = (v, allDay) => (v ? new Date(allDay ? v.slice(0, 10) + "T00:00" : v) : null);
  let ev = null;   // the open sheet's state

  function openEventEdit(event, opts = {}) {
    const cals = F.calendars();
    const writableCals = cals.filter((c) => c.writable !== false && !F.prefsHiddenCalendars().includes(c.id));
    const d = { title: "", location: "", allDay: false, start: new Date(), end: new Date(), calendar: "", notes: "", recurring: false, writable: true, links: [] };
    if (event) {
      const cal = cals.find((c) => c.id === event.calendarID || c.title === event.calendar);
      Object.assign(d, { title: event.title || "", location: event.location || "", allDay: !!event.allDay, start: event.start, end: event.end,
        calendar: event.calendar || "", notes: event.notes || "", recurring: !!event.repeats, writable: cal ? cal.writable !== false : true });
      const text = [d.notes, d.location].join("\n");
      d.links = [...new Set(text.match(/https?:\/\/[^\s<>"')]+/gi) || [])].slice(0, 8);
    } else {
      const base = opts.day || new Date();
      let start = new Date(base.getTime() + 3600000); start.setMinutes(0, 0, 0);
      if (opts.day && !D.same(opts.day, new Date())) start = new Date(opts.day.getFullYear(), opts.day.getMonth(), opts.day.getDate(), 9, 0);
      if (opts.start instanceof Date) start = new Date(opts.start);   // a tapped slot on the time grid
      d.start = start; d.end = new Date(start.getTime() + 3600000);
      if (opts.title) d.title = opts.title;
      // his own calendar (named after him, like the app's default) else the first one he can write to
      d.calendar = (writableCals.find((c) => F.firstName() && c.title === F.firstName()) || writableCals[0] || { title: "" }).title;
    }
    const readOnly = !!event && !d.writable;
    ev = { event, d, readOnly, opts, busy: false };
    const canSave = () => !!d.title.trim();
    const api = F.sheet({
      id: "event",
      title: readOnly ? "Event" : event ? "Edit event" : "New event",
      leading: readOnly ? null : { label: "Cancel", act: "sheet-close" },
      trailing: () => (readOnly ? { label: "Done", act: "sheet-close" } : { label: event ? "Save" : "Add", act: "ev-save", disabled: !canSave(), busy: ev?.busy }),
      body: () => eventBody(),
      onClose: () => { ev = null; },
    });
    ev.api = api;
    // Esc with something typed asks first (same Keep/Discard as Compose); Cancel just closes
    const start0 = { title: d.title, location: d.location, notes: d.notes };
    api.guard = { dirty: () => !readOnly && ["title", "location", "notes"].some((k) => d[k] !== start0[k]),
      title: event ? "Discard your changes?" : "Discard this event?", message: event ? "Your changes to this event aren't saved yet." : "It hasn't been added to your calendar yet.",
      leave: event ? "Discard changes" : "Discard", stay: "Keep editing" };
    setTimeout(() => api.el.querySelector("#ev-title")?.focus(), 30);
    return api;
  }

  function eventBody() {
    const { d, readOnly, event } = ev;
    const dis = readOnly ? "disabled" : "";
    const cals = F.calendars().filter((c) => c.writable !== false && !F.prefsHiddenCalendars().includes(c.id));
    const calOpts = cals.some((c) => c.title === d.calendar) ? cals : [{ title: d.calendar, color: "#767E8A" }, ...cals];
    const dt = (v) => (d.allDay ? D.key(v) : localDT(v));
    const type = d.allDay ? "date" : "datetime-local";
    const curCal = calOpts.find((c) => c.title === d.calendar);
    return `<div class="narrow form evsheet">
      ${readOnly ? `<div class="fsec"><div class="fgroup"><div class="frow"><span class="h g8 top t15 ink2" style="padding:8px 0">${F.icon("lock", 'class="wi"')}<span>This calendar is read-only (holidays, birthdays and subscribed calendars can't be changed here).</span></span></div></div></div>` : ""}
      <div class="fsec"><div class="fgroup">
        <div class="frow"><input class="bare" id="ev-title" data-input="ev-field" data-k="title" placeholder="Title" aria-label="Title" value="${esc(d.title)}" ${dis}></div>
        <div class="frow"><input class="bare" id="ev-loc" data-input="ev-field" data-k="location" placeholder="Location" aria-label="Location" value="${esc(d.location)}" ${dis}></div>
      </div></div>
      <div class="fsec"><div class="fgroup">
        <label class="frow"><span class="lbl">All day</span><span class="switch"><input type="checkbox" role="switch" id="ev-allday" data-change="ev-allday" ${d.allDay ? "checked" : ""} ${dis}></span></label>
        <label class="frow"><span class="lbl">Starts</span><input class="bare evdt" type="${type}" id="ev-start" data-change="ev-start" value="${dt(d.start)}" ${dis}></label>
        <label class="frow"><span class="lbl">Ends</span><input class="bare evdt" type="${type}" id="ev-end" data-change="ev-end" value="${dt(d.end)}" min="${dt(d.start)}" ${dis}></label>
        <label class="frow"><span class="lbl">Calendar</span>${readOnly ? `<span class="val">${esc(d.calendar)}</span>`
          : `<span class="h g8"><span class="dot" style="background:${esc(curCal?.color || "#767E8A")}"></span><select class="bare" id="ev-cal" data-change="ev-cal">${calOpts.map((c) => `<option ${c.title === d.calendar ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></span>`}</label>
      </div>${d.recurring && !readOnly ? '<p class="ffoot">This is a repeating event. When you save, you choose this event only or all future ones.</p>' : ""}</div>
      <div class="fsec"><p class="fhead">Notes</p><div class="fgroup">
        <div class="frow"><textarea class="bare" id="ev-notes" data-input="ev-field" data-k="notes" placeholder="Notes" aria-label="Notes" rows="3" ${dis}>${esc(d.notes)}</textarea></div>
      </div></div>
      ${event && d.links.length ? `<div class="fsec"><p class="fhead">Links</p><div class="fgroup">${d.links.map((u) => { let host = u; try { host = new URL(u).host.replace("www.", ""); } catch {} return `<div class="frow"><a class="evlink" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${F.icon("arrow.right", 'class="wi"')}${esc(host)}</a></div>`; }).join("")}</div>
        <p class="ffoot">Files attached to an event (like PDFs) open only in Apple's Calendar app.</p></div>` : ""}
      ${event && !readOnly ? `<div class="fsec"><div class="fgroup evdel"><div class="frow"><button type="button" class="rowlink destructive" data-act="ev-delete">${F.icon("trash", 'class="wi"')}Delete event</button></div></div></div>` : ""}
    </div>`;
  }

  F.onInput("ev-field", (el) => {
    if (!ev) return;
    ev.d[el.dataset.k] = el.value;
    if (el.dataset.k === "title") {
      const b = ev.api.el.querySelector('.sheetbar [data-act="ev-save"]');
      if (b) b.disabled = !el.value.trim();
    }
  });
  F.onChange("ev-allday", (el) => { if (!ev) return; ev.d.allDay = el.checked; ev.api.update(); });
  F.onChange("ev-start", (el) => {
    if (!ev) return;
    const v = parseDT(el.value, ev.d.allDay); if (!v || isNaN(v)) return;
    const len = ev.d.end - ev.d.start;
    if (ev.d.allDay) v.setHours(ev.d.start.getHours(), ev.d.start.getMinutes());
    ev.d.start = v;
    if (len > 0) ev.d.end = new Date(v.getTime() + len);
    ev.api.update();
  });
  F.onChange("ev-end", (el) => {
    if (!ev) return;
    const v = parseDT(el.value, ev.d.allDay); if (!v || isNaN(v)) return;
    if (ev.d.allDay) v.setHours(ev.d.end.getHours(), ev.d.end.getMinutes());
    ev.d.end = v < ev.d.start ? new Date(ev.d.start) : v;
    ev.api.update();
  });
  F.onChange("ev-cal", (el) => { if (!ev) return; ev.d.calendar = el.value; ev.api.update(); });

  F.on("ev-save", async () => {
    if (!ev || !ev.d.title.trim()) return;
    if (ev.d.recurring && ev.event) {
      const v = await F.alert({ title: "This is a repeating event", buttons: [{ label: "Save for this event only", value: "one" }, { label: "Save for all future events", value: "all" }, { label: "Cancel", kind: "cancel" }] });
      if (!v) return;
      return save(v === "all");
    }
    return save(false);
  });
  async function save(allFuture) {
    const s = ev; if (!s) return;
    const d = { ...s.d, title: s.d.title.trim() };
    let start = d.start, end = d.end < d.start ? d.start : d.end;
    if (d.allDay) { start = D.start(start); end = new Date(D.start(end).getTime() + 86399000); }
    const sec = (x) => Math.round(x.getTime() / 1000);
    const when = d.allDay ? start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
      : start.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const toastText = (s.event ? "Saved " : "Added ") + `“${d.title}”, ${when}`;
    s.busy = true; s.api.update();
    try {
      if (s.event) {
        await F.cmd("update_event", { itemID: s.event.itemID, occurrenceStart: sec(s.event.start), allFuture: !!allFuture, title: d.title, start: sec(start), end: sec(end),
          allDay: d.allDay, location: d.location, notes: d.notes, calendar: d.calendar }, toastText);
      } else {
        await F.cmd("add_event", { title: d.title, start: sec(start), end: sec(end), allDay: d.allDay, location: d.location, notes: d.notes || undefined, calendar: d.calendar || undefined }, toastText);
      }
      s.opts.onSaved?.();
      s.api.close();
    } catch (e) {
      s.busy = false; if (s.api.el.open) s.api.update();
      F.toast("Couldn't save the event: " + F.friendly(e.message));
    }
  }
  F.on("ev-delete", async () => {
    const s = ev; if (!s?.event) return;
    const buttons = s.d.recurring
      ? [{ label: "Delete this event only", kind: "destructive", value: "one" }, { label: "Delete all future events", kind: "destructive", value: "all" }, { label: "Cancel", kind: "cancel" }]
      : [{ label: "Delete event", kind: "destructive", value: "one" }, { label: "Cancel", kind: "cancel" }];
    const v = await F.alert({ title: `Delete "${s.d.title}"?`, message: "It's removed from Apple Calendar on all your devices.", buttons });
    if (!v) return;
    const allFuture = v === "all";
    await F.cmd("delete_event", { itemID: s.event.itemID, occurrenceStart: Math.round(s.event.start.getTime() / 1000), allFuture },
      `Deleted “${s.d.title}”` + (allFuture ? " and its future repeats" : ""));
    s.api.close();
  });

  F.openEventEdit = openEventEdit;
  F.openCalendarFilter = openCalendarFilter;

  // ------------------------------------------------------------ CalendarTab: Agenda · Day · Week (Design System v2 §10)
  let anchor = null;   // Agenda: first day shown; null = today
  let span = 30;
  let cursor = null;   // Day / Week: the day shown (Week: a day inside the range); null = today
  const VIEWS = [["agenda", "Agenda"], ["day", "Day"], ["week", "Week"]];
  let calView = (() => { try { const v = localStorage.getItem("friday.calView"); return VIEWS.some(([k]) => k === v) ? v : "week"; } catch { return "week"; } })();
  const setView = (v) => { calView = v; try { localStorage.setItem("friday.calView", v); } catch {} };
  const wideWeek = () => matchMedia("(min-width: 900px)").matches;   // 7 days on the sidebar layout, 3 below
  const hourPx = () => (matchMedia("(max-width: 639px)").matches ? 56 : 64);
  let tg = { key: "", scroll: null };   // remembers the grid's scroll for re-renders of the same range

  function dayBlock(day, events, now, isToday) {
    const allDay = events.filter((e) => e.allDay), timed = events.filter((e) => !e.allDay);
    const dk = D.key(day);
    return `<section class="card p16 v g12 calday">
      <div class="lockup">
        <span class="calday-name"><span class="t15 w6 ink">${isToday ? "Today" : esc(D.wd(day))}</span><span class="t-meta">${esc(D.md(day))}</span>${isToday ? ui.tag("Now " + D.time(now), "now") : ""}</span>
        <span class="lk-trail">${ui.btn({ icon: "plus", kind: "icon", cls: "small filled", act: "cal-add", data: { day: dk }, aria: "Add event on " + D.md(day) })}</span>
      </div>
      ${allDayChips(allDay)}
      ${timed.map((e) => eventRow(e, now, isToday)).join("")}
      ${events.length ? "" : `<p class="t-meta freeday">Free day</p>`}
    </section>`;
  }

  // ---- the time grid
  const bigRockIndex = () => {
    const p = F.planner(); const out = [];
    if (!p) return out;
    for (const w of Object.values(p.weeks || {})) for (const r of w?.rocks || []) {
      const role = (p.roles || []).find((x) => x.id === r.roleID)?.name || "";
      out.push({ title: String(r.title || "").trim().toLowerCase(), role });
    }
    return out;
  };
  function bigRockFor(e, rocks) {
    const t = String(e.title || "").trim();
    const m = /^big rock\s*[:·-]\s*(.+)$/i.exec(t);
    const key = (m ? m[1] : t).trim().toLowerCase();
    const r = rocks.find((x) => x.title && x.title === key);
    if (r) return r;
    return m ? { title: key, role: "" } : null;
  }
  /** Overlapping events split into columns: each cluster of overlaps shares its width. */
  function layoutDay(evs) {
    const items = evs.map((e) => ({ e, s: +e._s, f: +e._f })).sort((a, b) => a.s - b.s || b.f - a.f);
    let cluster = [], cols = [], end = -Infinity;
    const flush = () => { for (const it of cluster) it.n = cols.length; cluster = []; cols = []; };
    for (const it of items) {
      if (it.s >= end) { flush(); end = -Infinity; }
      let c = cols.findIndex((f) => f <= it.s);
      if (c < 0) { c = cols.length; cols.push(it.f); } else cols[c] = it.f;
      it.c = c; cluster.push(it); end = Math.max(end, it.f);
    }
    flush();
    return items;
  }
  const hhLabel = (h) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "Noon" : `${h - 12} PM`);
  function gridRange(now) {
    const c = D.start(cursor || now);
    if (calView === "day") return { start: c, n: 1 };
    if (wideWeek()) return { start: D.weekStart(c), n: 7 };
    return { start: c, n: 3 };
  }
  function rangeTitle(start, n) {
    if (n === 1) return `<span class="only-wide">${esc(D.wide(start))}</span><span class="only-compact">${esc(D.short(start))}</span>`;
    const end = D.add(start, n - 1);
    const sameMonth = start.getMonth() === end.getMonth();
    return esc(`${D.md(start)} – ${sameMonth ? end.getDate() : D.md(end)}`);
  }
  function timeGrid(now) {
    const { start, n } = gridRange(now);
    const H = hourPx(), all = F.events(), rocks = bigRockIndex();
    const days = Array.from({ length: n }, (_, i) => D.add(start, i));
    const cols = `64px repeat(${n}, minmax(0, 1fr))`;
    const head = days.map((d) => { const today = D.same(d, now);
      return `<button type="button" class="tg-dh ${today ? "today" : ""}" data-act="cal-pickday" data-day="${D.key(d)}" ${n === 1 ? "disabled" : ""} aria-label="${esc(D.wide(d) + (n > 1 ? ". Show this day" : ""))}">
        <span class="tg-wd">${esc(D.wdShort(d))}</span><span class="tg-dn">${d.getDate()}</span></button>`; }).join("");
    const allDay = days.map((d) => {
      const evs = eventsOn(d, all).filter((e) => e.allDay);
      return `<div class="tg-ad">${evs.map((e) => { const col = evColor(e); return `<button type="button" class="plain press tg-chip evtint" data-act="cal-open-event" data-id="${esc(e.id)}" style="--evc:${hexRGBA(col, 1)};--evt:${hexRGBA(col, 0.18)}" title="${esc(e.title)}"><span class="ell">${esc(e.title)}</span></button>`; }).join("")}</div>`;
    }).join("");
    const hasAllDay = days.some((d) => eventsOn(d, all).some((e) => e.allDay));   // no empty "All day" strip eating the hours
    const lines = Array.from({ length: 24 }, (_, h) => `<i class="tg-hr" style="top:${h * H}px"></i><i class="tg-half" style="top:${h * H + H / 2}px"></i>`).join("");
    const nowY = days.some((d) => D.same(d, now)) ? (now - D.start(now)) / 3600000 * H : null;
    const labels = Array.from({ length: 23 }, (_, k) => (nowY != null && Math.abs((k + 1) * H - nowY) < 14 ? "" : `<span class="tg-hl" style="top:${(k + 1) * H}px">${hhLabel(k + 1)}</span>`)).join("");
    let nowGutter = "";
    const columns = days.map((d, di) => {
      const a = D.start(d), b = D.add(a, 1), today = D.same(d, now);
      const evs = eventsOn(d, all).filter((e) => !e.allDay).map((e) => ({ ...e, _s: e.start < a ? a : e.start, _f: e.end > b ? b : e.end }));
      const blocks = layoutDay(evs).map((it) => {
        const e = it.e, top = (it.e._s - a) / 3600000 * H, h = Math.max(20, (it.e._f - it.e._s) / 3600000 * H - 2);
        const col = evColor(e), past = e.end < now, rock = bigRockFor(e, rocks), rc = rock && rock.role ? F.roleColor(rock.role) : null;
        const bar = rc ? rc.fill : col;
        const w = 100 / it.n, left = it.c * w;
        const time = `${D.time(e.start)} – ${D.time(e.end)}`;
        // the title gets the room first: the time line shows only when the title still has two lines above it
        const fit = Math.max(1, Math.floor((h - 8) / 17)), showTm = h >= 36, tLines = Math.max(1, fit - 1), tight = showTm && fit < 3;
        return `<button type="button" class="tg-ev ${past ? "past" : ""} ${h < 36 ? "short" : ""} ${tight ? "tight" : ""} ${e.pending ? "pending" : ""}" data-act="cal-open-event" data-id="${esc(e.id)}"
          style="top:${top}px;height:${h}px;left:calc(${left}% + 2px);width:calc(${w}% - 4px);--evc:${hexRGBA(bar, past ? 0.6 : 1)};--evt:${hexRGBA(col, past ? 0.09 : 0.18)}"
          aria-label="${esc(`${e.title}, ${time}${rock ? ", Big Rock" : ""}`)}">
          <span class="tg-et">${rock ? F.icon("mountain.2", 'class="tg-rock"') : ""}<span class="${h < 36 ? "ell" : "tg-tt"}" style="--lines:${tLines};--lines-n:${fit}">${esc(e.title)}</span></span>${showTm ? `<span class="tg-tm">${esc(D.time(e.start))}<span class="tg-end"> – ${esc(D.time(e.end))}</span></span>` : ""}</button>`;
      }).join("");
      let nowLine = "";
      if (today) {
        const y = (now - a) / 3600000 * H;
        nowLine = `<i class="tg-now" style="top:${y}px" aria-hidden="true"></i>`;
        nowGutter = `<span class="tg-nowl" style="top:${y}px">${esc(D.time(now))}</span>`;
      }
      return `<div class="tg-col ${today ? "today" : ""}" style="grid-column:${di + 2}" data-day="${D.key(d)}" role="group" aria-label="${esc(D.wide(d))}. Tap an empty time to add an event">${blocks}${nowLine}</div>`;
    }).join("");
    return { html: `<section class="card tg" style="--hour:${H}px;--tg-cols:${cols}" data-key="${calView}:${D.key(start)}:${n}">
      <div class="tg-head"><span class="tg-gut"></span>${head}</div>
      ${hasAllDay ? `<div class="tg-allrow"><span class="tg-gut tg-adl">All day</span>${allDay}</div>` : ""}
      <div class="tg-scroll"><div class="tg-body" style="height:${24 * H}px">
        <div class="tg-gutter">${labels}${nowGutter}</div>
        <div class="tg-lines">${lines}</div>
        ${columns}
      </div></div>
    </section>`, title: rangeTitle(start, n), start, n };
  }

  function toolbar(now, title) {
    const seg = ui.seg("cal-view", VIEWS, calView).replace('class="seg"', 'class="seg fit calseg" aria-label="Calendar view"');
    if (calView === "agenda") {
      return `<div class="caltool">${seg}
        <div class="actbar caltool-r">${ui.btn({ label: "Earlier", icon: "chevron.up", kind: "small", act: "cal-earlier" })}${ui.btn({ label: "Go to date", icon: "calendar", kind: "small", act: "cal-goto" })}${anchor ? ui.btn({ label: "Today", kind: "small", act: "cal-today" }) : ""}</div></div>`;
    }
    const isNow = (() => { const r = gridRange(now); return now >= r.start && now < D.add(r.start, r.n); })();
    return `<div class="caltool">${seg}
      <div class="stepper-d">${ui.btn({ icon: "chevron.left", kind: "icon", cls: "small filled", act: "cal-step", data: { dir: -1 }, aria: calView === "day" ? "Previous day" : "Previous days" })}
        <span class="sd-t t15 w6 ink">${title}</span>
        ${ui.btn({ icon: "chevron.right", kind: "icon", cls: "small filled", act: "cal-step", data: { dir: 1 }, aria: calView === "day" ? "Next day" : "Next days" })}</div>
      ${ui.btn({ label: "Today", kind: "small", act: "cal-today", disabled: isNow })}</div>`;
  }

  F.view("calendar", {
    render() {
      const now = new Date();
      const actions = filterButton() + ui.btn({ label: "Event", icon: "plus", kind: "primary", act: "cal-new" });
      // phones: the same two buttons as icons beside the title, so the hours get the room (D10 on the web); CSS picks one set
      const tools = `<span class="ph-tools">${filterButton()}${ui.btn({ kind: "icon", icon: "plus", cls: "primary-ic", act: "cal-new", aria: "New event", title: "New event" })}</span>`;
      const banners = (calendarAccess() ? "" : accessOffRow("Calendar")) + failedCard(EVENT_KINDS);
      if (calView === "agenda") {
        const start = anchor ? D.start(anchor) : D.start(now);
        const all = F.events();
        const eyebrow = ui.label2((anchor || now).toLocaleDateString([], { month: "long", year: "numeric" }));
        let days = "";
        for (let i = 0; i < span; i++) { const day = D.add(start, i); days += dayBlock(day, eventsOn(day, all), now, D.same(day, now)); }
        return `<div class="phc">${ui.header({ eyebrow, title: "Calendar", actions, tools })}</div>${banners}
          <div class="v cgap">${toolbar(now)}<div class="caldays">${days}</div>
          ${ui.actbar([ui.btn({ label: "Show 30 more days", icon: "chevron.down", act: "cal-more" })])}</div>`;
      }
      const g = timeGrid(now);
      const eyebrow = ui.label2(g.start.toLocaleDateString([], { month: "long", year: "numeric" }));
      return `<div class="phc">${ui.header({ eyebrow, title: "Calendar", actions, tools })}</div>${banners}<div class="v cgap">${toolbar(now, g.title)}${g.html}</div>`;
    },
    after(root) {
      const grid = root.querySelector(".tg"); if (!grid) { tg.key = ""; return; }
      const sc = grid.querySelector(".tg-scroll"), screen = root;
      // the grid fills the rest of the window; the hours scroll inside it
      const absTop = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
      const avail = screen.clientHeight - (absTop(sc) - absTop(screen)) - 24;
      sc.style.height = Math.max(360, Math.min(24 * hourPx(), avail)) + "px";
      const sb = sc.offsetWidth - sc.clientWidth;   // keep the day headers over their columns when a scrollbar shows
      for (const r of grid.querySelectorAll(".tg-head, .tg-allrow")) r.style.paddingRight = sb + "px";
      const key = grid.dataset.key;
      if (key === tg.key && tg.scroll != null) sc.scrollTop = tg.scroll;
      else {
        const now = new Date(), H = hourPx();
        const showsToday = !!grid.querySelector(".tg-col.today");
        const hour = showsToday ? Math.max(0, now.getHours() + now.getMinutes() / 60 - 1) : 8;
        sc.scrollTop = Math.max(0, hour * H - 12);
      }
      tg.key = key; tg.scroll = sc.scrollTop;
      sc.addEventListener("scroll", () => { tg.scroll = sc.scrollTop; }, { passive: true });
    },
  });

  F.on("cal-view", (el) => { setView(el.dataset.value); tg.key = ""; F.render(); });
  F.on("cal-step", (el) => {
    const dir = +el.dataset.dir, now = new Date(), { n } = gridRange(now);
    cursor = D.add(D.start(cursor || now), dir * n);
    if (D.same(cursor, now)) cursor = null;
    F.render();
  });
  F.on("cal-pickday", (el) => { cursor = D.parse(el.dataset.day); if (D.same(cursor, new Date())) cursor = null; setView("day"); F.render(); });
  // tap an empty slot → New event at that time (30-minute snap)
  document.addEventListener("click", (e) => {
    const col = e.target.closest?.(".tg-col"); if (!col || e.target.closest(".tg-ev")) return;
    const r = col.getBoundingClientRect(), H = r.height / 24;   // works under the text-size zoom too
    const mins = Math.max(0, Math.min(23.5 * 60, Math.floor(((e.clientY - r.top) / H) * 2) * 30));
    const d = D.parse(col.dataset.day);
    openEventEdit(null, { day: d, start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(mins / 60), mins % 60) });
  });
  // ←/→ step the Day / Week view (not while typing or with a sheet open)
  document.addEventListener("keydown", (e) => {
    if (F.S.tab !== "calendar" || calView === "agenda" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (document.querySelector("dialog[open]") || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    e.preventDefault();
    const { n } = gridRange(new Date());
    cursor = D.add(D.start(cursor || new Date()), (e.key === "ArrowLeft" ? -1 : 1) * n);
    if (D.same(cursor, new Date())) cursor = null;
    F.render();
  });
  // 7 ⇄ 3 days when the window crosses 900 px
  let wasWide = wideWeek();
  addEventListener("resize", () => { const w = wideWeek(); if (w !== wasWide && F.S.tab === "calendar") { wasWide = w; tg.key = ""; F.render(); } });

  F.on("cal-new", () => openEventEdit(null, { day: cursor || new Date() }));
  F.on("cal-add", (el) => { const day = D.parse(el.dataset.day); openEventEdit(null, { day: D.same(day, new Date()) ? new Date() : day }); });
  F.on("cal-earlier", () => { anchor = D.add(anchor ? D.start(anchor) : D.start(new Date()), -7); F.render(); });
  F.on("cal-today", () => { anchor = null; cursor = null; span = 30; tg.key = ""; F.render(); });
  F.on("cal-more", () => { span += 30; F.render(); });
  F.on("cal-goto", () => {
    let pick = D.key(anchor || new Date());
    F.sheet({
      title: "Go to date", id: "goto",
      leading: { label: "Cancel", act: "sheet-close" },
      trailing: { label: "Go", act: "cal-goto-go" },
      body: `<div class="narrow v g12"><label class="field"><span>Go to</span><input class="input" type="date" id="cal-goto-date" value="${pick}"></label></div>`,
    });
  });
  F.on("cal-goto-go", (el) => {
    const dlg = el.closest("dialog");
    const v = dlg.querySelector("#cal-goto-date")?.value;
    if (v) { const d = D.parse(v); anchor = D.same(d, new Date()) ? null : D.start(d); }
    dlg._api.close();
    F.render();
  });

  // TimelineView(.periodic(by: 60)): keep "Now", NOW tags and countdowns current
  setInterval(() => {
    if (document.visibilityState !== "visible" || document.querySelector("dialog[open]")) return;
    if (F.S.tab === "calendar" || F.S.tab === "brief") F.render();
  }, 60000);
})();
