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
    return `<button type="button" class="plain press evrow ${past ? "past" : ""}" data-act="cal-open-event" data-id="${esc(e.id)}"
        style="background:${hexRGBA(col, past ? 0.03 : 0.07)}" aria-label="${esc(`${e.title}, ${start} to ${end}${sub ? ", " + sub : ""}`)}">
      <span class="evrow-in">
        <span class="evtime"><span class="s">${esc(start)}</span><span class="e">${esc(end)}</span></span>
        <span class="evbar" style="background:${past ? hexRGBA(col, 0.35) : esc(col)}"></span>
        <span class="evmain">
          <span class="evstack">${esc(start + " – " + end)}</span>
          <span class="evtitle"><span class="t">${esc(e.title)}</span>${past ? ui.tag("Ended") : ""}${live ? ui.tag("NOW", "warm") : ""}${e.pending && failedMap()[e.id] ? ui.tag("Not added", "attention") : ""}</span>
          <span class="evsub">${esc(sub)}</span>
        </span>
        ${F.icon("chevron.right", 'class="chev"')}
      </span>
    </button>`;
  }
  /** AllDayChips */
  function allDayChips(events) {
    if (!events.length) return "";
    return `<div class="v g8">${events.map((e) => { const col = evColor(e); return `<button type="button" class="plain press allday" data-act="cal-open-event" data-id="${esc(e.id)}" style="background:${hexRGBA(col, 0.1)}">
      <span class="bar" style="background:${esc(col)}"></span><span class="t13 muted">All day</span><span class="t15 w6 ink ell">${esc(e.title)}</span></button>`; }).join("")}</div>`;
  }
  /** CalendarFilterButton: "Calendars" (+ "2/5" when some are hidden; amber then). */
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
    const d = { title: "", location: "", allDay: false, start: new Date(), end: new Date(), calendar: "Jose", notes: "", recurring: false, writable: true, links: [] };
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
      d.start = start; d.end = new Date(start.getTime() + 3600000);
      if (opts.title) d.title = opts.title;
      if (!writableCals.some((c) => c.title === "Jose") && writableCals[0]) d.calendar = writableCals[0].title;
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
    if (!event && d.title.trim()) api.el.dataset.noEscape = "1";
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
      ${readOnly ? `<div class="fsec"><div class="fgroup"><div class="frow"><span class="h g8 top t15 ink2" style="padding:6px 0">${F.icon("lock", 'class="wi"')}<span>This calendar is read-only (holidays, birthdays and subscribed calendars can't be changed here).</span></span></div></div></div>` : ""}
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
      if (!ev.event) { if (el.value.trim()) ev.api.el.dataset.noEscape = "1"; else delete ev.api.el.dataset.noEscape; }
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
        await F.cmd("add_event", { title: d.title, start: sec(start), end: sec(end), allDay: d.allDay, location: d.location, notes: d.notes || undefined, calendar: d.calendar }, toastText);
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

  // ------------------------------------------------------------ CalendarTab
  let anchor = null;   // first day shown; null = today
  let span = 30;

  function dayBlock(day, events, now, isToday) {
    const allDay = events.filter((e) => e.allDay), timed = events.filter((e) => !e.allDay);
    const dk = D.key(day);
    return `<section class="card p16 v g8 calday">
      <div class="h g8">
        <div class="calday-name">
          <span class="h g8 nowrap"><span class="t15 w6 ink">${isToday ? "Today" : esc(D.wd(day))}</span><span class="t13 muted">${esc(D.md(day))}</span></span>
          ${isToday ? ui.tag("Now " + D.time(now)) : ""}
        </div>
        <span class="sp"></span>
        ${ui.btn({ icon: "plus", kind: "small", cls: "plusbtn", act: "cal-add", data: { day: dk }, aria: "Add event on " + D.md(day) })}
      </div>
      ${allDayChips(allDay)}
      ${timed.map((e) => eventRow(e, now, isToday)).join("")}
      ${events.length ? "" : `<div class="freeday h"><span class="t15 w5 ink2">Free day</span><span class="sp"></span>${ui.btn({ label: "Add", icon: "plus", kind: "small", act: "cal-add", data: { day: dk }, aria: "Add an event on " + D.wide(day) })}</div>`}
    </section>`;
  }

  F.view("calendar", {
    render() {
      const now = new Date();
      const start = anchor ? D.start(anchor) : D.start(now);
      const all = F.events();
      const eyebrow = ui.label2((anchor || now).toLocaleDateString([], { month: "long", year: "numeric" }));
      let days = "";
      for (let i = 0; i < span; i++) {
        const day = D.add(start, i);
        days += dayBlock(day, eventsOn(day, all), now, D.same(day, now));
      }
      return `${ui.header({ eyebrow, title: "Calendar", actions: filterButton() + ui.btn({ label: "Event", icon: "plus", kind: "primary", act: "cal-new" }) })}
        ${calendarAccess() ? "" : accessOffRow("Calendar")}
        ${failedCard(EVENT_KINDS)}
        <div class="h g8">
          ${ui.btn({ label: "Earlier", icon: "chevron.up", kind: "small", act: "cal-earlier" })}
          ${ui.btn({ label: "Go to date", icon: "calendar", kind: "small", act: "cal-goto" })}
          <span class="sp"></span>
          ${anchor ? ui.btn({ label: "Today", kind: "small", act: "cal-today" }) : ""}
        </div>
        <div class="caldays">${days}</div>
        <div>${ui.btn({ label: "Show 30 more days", act: "cal-more" })}</div>`;
    },
  });

  F.on("cal-new", () => openEventEdit(null, { day: new Date() }));
  F.on("cal-add", (el) => { const day = D.parse(el.dataset.day); openEventEdit(null, { day: D.same(day, new Date()) ? new Date() : day }); });
  F.on("cal-earlier", () => { anchor = D.add(anchor ? D.start(anchor) : D.start(new Date()), -7); F.render(); });
  F.on("cal-today", () => { anchor = null; span = 30; F.render(); });
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
