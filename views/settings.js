// Settings — a port of ConnectionsView.swift (non-onboarding), SettingsView.swift ("Friday settings") and
// SyncSetupView.swift ("Sync across devices"), told honestly for the website: the connections themselves live on the iPhone.
// Plus the website's own "Update the app on your iPhone and iPad" button (ported from legacy syncView/requestUpdate).
"use strict";
(() => {
  const { ui, esc, D } = F;
  const PALETTE = ["#6D28D9", "#57534E", "#9D174D", "#3F3F46", "#86198F", "#475569"];   // MailAccount.palette
  F.addIcons({
    iphone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5.5h3"/>',
    "arrow.down.circle": '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v8.5M8.5 12.5L12 16l3.5-3.5"/>',
  });
  const MODELS = () => F.claudeModels || [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 — smartest" }, { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — balanced" }, { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 — cheapest" }];
  const keySaved = () => { const k = F.S.payload?.claude?.value; return typeof k === "string" && !!k.trim(); };
  const later = (what) => F.toast(`${what} isn't on the website yet. Open F.R.I.D.A.Y. on your iPhone.`);
  const U = { requested: null, polling: false };

  // ------------------------------------------------------------ Settings (ConnectionsView)
  F.openSettings = () => {
    const s = F.sheet({ title: "Settings", trailing: { label: "Done", act: "sheet-close" }, body: settingsBody, id: "settings" });
    s.el.classList.add("settings");
    s.refresh = () => s.update();
    return s;
  };
  F.on("open-settings", () => F.openSettings());

  function card({ icon, title, status, ok, tag, content = "" }) {
    return `<section class="card set-card">
      <div class="h g16">
        <span class="set-ic" aria-hidden="true">${F.icon(icon)}</span>
        <div class="v g2 grow"><span class="t17 w6 ink">${esc(title)}</span><span class="t13 ${ok ? "ink2" : "muted"}">${esc(status)}</span></div>
        <span class="tag ${ok ? "ink" : "set-off"}">${esc(tag || (ok ? "Connected" : "Not set up"))}</span>
      </div>${content}</section>`;
  }

  function plannerSection() {
    const p = F.planner();
    const setUp = !!(p && (p.values || []).length && (p.roles || []).length);
    return `<section class="card set-card set-planner">
      ${ui.label2("Your planner")}
      <p class="t15 ink2">${esc(setUp ? "Values, roles, goals and focus time live in the Organizer." : "Your planner isn't set up yet. Six quick questions, about three minutes.")}</p>
      <div class="flow">
        ${ui.btn({ label: setUp ? "Redo the 6 questions" : "Set up my planner", kind: setUp ? "" : "primary", act: "set-setup", data: { mode: "diagnostic" } })}
        ${ui.btn({ label: "Pick a starter profile", act: "set-setup", data: { mode: "starter" } })}
        ${ui.btn({ label: "Organizer", icon: "target", act: "set-organizer" })}
      </div>
      ${setUp ? `<hr class="set-div">
        <div class="flow">${ui.btn({ label: "Start from zero", kind: "destructive", act: "set-reset" })}</div>
        <p class="t13 muted">Clears values, roles, goals, Big Rocks and setup answers, including anything a starter profile added. Your to-dos and calendar events stay. A backup is saved first.</p>` : ""}
    </section>`;
  }

  function settingsBody() {
    const s = F.snap(), mail = F.mail(), accts = mail?.accounts || [];
    // older iPhone versions didn't report access; if its tasks and calendar arrive, they're connected
    const access = { calendar: s?.access ? s.access.calendar : (s?.events || []).length > 0, reminders: s?.access ? s.access.reminders : (s?.todos || []).length + (s?.done || []).length > 0 };
    const cals = F.calendars(), hidden = new Set(F.prefsHiddenCalendars()), shown = cals.filter((c) => !hidden.has(c.id)).length;
    const lists = F.lists().length;
    const from = s ? `${esc(s.device || "your iPhone")}` : "";
    const iphoneNote = (t) => `<p class="t13 muted">${esc(t)}</p>`;
    const synced = F.S.lastLoad ? D.time(new Date(F.S.lastLoad)) : null;
    return `<div class="set-col">
      ${!s ? `<div class="card attention set-warn h top g8">${F.icon("exclamationmark.triangle.fill")}<p class="t15 ink">Your iPhone hasn't sent anything yet. Open F.R.I.D.A.Y. on your iPhone and sign in to sync.</p></div>` : ""}
      ${plannerSection()}
      ${card({ icon: "calendar", title: "Calendar", ok: !!access.calendar, status: access.calendar ? "Connected · all your Apple calendars" : "Not connected",
        content: access.calendar
          ? `<div class="flow">${ui.btn({ labelHTML: `${F.icon("calendar")}Choose calendars${shown < cals.length ? ` <span class="set-count">${shown}/${cals.length}</span>` : ""}`, act: "set-calendars", aria: `Choose calendars, ${shown} of ${cals.length} shown` })}</div>`
          : iphoneNote("Allow calendar access in F.R.I.D.A.Y. on your iPhone.") })}
      ${card({ icon: "checklist", title: "To-dos (Reminders)", ok: !!access.reminders, status: access.reminders ? `Connected · ${lists} list${lists === 1 ? "" : "s"}` : "Not connected",
        content: access.reminders ? "" : iphoneNote("Allow reminders access in F.R.I.D.A.Y. on your iPhone.") })}
      ${card({ icon: "envelope", title: "Email", ok: accts.length > 0, status: accts.length ? `${accts.length} account${accts.length === 1 ? "" : "s"} connected` : "No accounts yet",
        content: `<div class="v g8">${accts.map((a) => `<div class="h g8 set-acct"><span class="set-dot" style="background:${PALETTE[(a.colorIndex || 0) % PALETTE.length]}"></span>
            <div class="v g2 grow"><span class="t15 w6 ink ell">${esc(a.label)}</span><span class="t13 muted ell">${esc(a.email)}</span></div></div>`).join("")}
          ${iphoneNote("Connect, fix or remove email accounts on your iPhone. Passwords stay in its Keychain.")}</div>` })}
      ${card({ icon: "waveform", title: "Voice (microphone)", ok: false, tag: "iPhone only", status: "iPhone only · the website is text only" })}
      ${card({ icon: "cpu", title: "Friday: dates, signature, memory", ok: true, tag: "iPhone and iPad",
        status: "Talking with Friday is on your iPhone and iPad", content: `<div class="flow">${ui.btn({ label: "Friday settings", act: "set-friday" })}</div>` })}
      ${card({ icon: "arrow.triangle.2.circlepath", title: "Sync: iPhone, iPad and website", ok: true,
        status: `Signed in · ${synced ? "synced " + synced : "waiting"}${from ? " · from " + from : ""}`,
        content: `<div class="flow">${ui.btn({ label: "Sync settings", act: "set-sync" })}</div>` })}
      ${updateCard()}
    </div>`;
  }

  F.on("set-setup", (el) => (F.openSetup ? F.openSetup(el.dataset.mode) : later("The planner setup")));
  F.on("set-organizer", () => (F.openOrganizer ? F.openOrganizer() : later("The Organizer")));
  F.on("set-reset", () => (F.openPlannerReset ? F.openPlannerReset() : later("Start from zero")));
  F.on("set-calendars", () => (F.openCalendarFilter ? F.openCalendarFilter() : later("Choosing calendars")));
  F.on("set-friday", () => F.openFridaySettings());
  F.on("set-sync", () => openSync());

  // ------------------------------------------------------------ Update the app (legacy syncView / statusHTML / requestUpdate)
  function updateCard() {
    const d = F.devices(), st = F.status();
    const hb = d?.at ? new Date(d.at) : null;
    const macOn = F.DEMO || (hb && Date.now() - hb.getTime() < 12 * 60 * 1000);
    const working = (st && st.state === "working" && (!U.requested || st.id === U.requested)) || !!U.requested;
    const devs = d?.devices || [];
    return `<section class="card set-card">
      <div class="h g16">
        <span class="set-ic" aria-hidden="true">${F.icon("iphone")}</span>
        <div class="v g2 grow"><span class="t17 w6 ink">Update the app on your iPhone and iPad</span>
          <span class="t13 muted">Your Mac rebuilds F.R.I.D.A.Y. and installs it on every iPhone and iPad it can reach, over Wi-Fi or a cable. It takes about two minutes.</span></div>
      </div>
      ${ui.btn({ kind: "primary", wide: true, act: "set-update", disabled: working || !macOn, labelHTML: working ? `${ui.spinner()}Updating…` : `${F.icon("arrow.triangle.2.circlepath")}Sync`, cls: "set-syncbtn" })}
      ${!macOn ? `<div class="card attention set-banner h top g8">${F.icon("exclamationmark.triangle.fill")}<p class="t13 ink"><b>Your Mac isn't answering${hb ? ` (last heard ${esc(D.ago(hb))})` : ""}.</b> Turn on your Mac mini, plug in the external drive, and sign in. The Sync button wakes up within a minute.</p></div>` : ""}
      ${statusHTML(st)}
      <div class="v">
        ${ui.label2("Devices your Mac can see")}
        ${hb ? `<p class="t13 muted">${esc(d.mac || "Mac")}, checked ${esc(D.ago(hb))}</p>` : ""}
        <div class="rows">${devs.map((x) => `<div class="row"><div class="v g2 grow"><span class="t15 w6 ink ell">${esc(x.name)}</span><span class="t13 muted ell">${esc(x.model || "")}</span></div>
            ${ui.tag(x.reachable ? "Ready" : "Not reachable", x.reachable ? "ink" : "")}</div>`).join("") || '<p class="t13 muted set-empty">No devices yet.</p>'}</div>
      </div>
      <div class="v g4 t13 muted">
        <p><b class="ink2">Not reachable?</b> Unlock it and keep it on the same Wi-Fi as your Mac, or plug it into the Mac with a cable, then tap Sync again.</p>
        <p><b class="ink2">iPad not listed?</b> Plug it into the Mac with a cable once, tap Trust on the iPad, and turn on Settings › Privacy &amp; Security › Developer Mode. After that it updates over Wi-Fi.</p>
      </div>
    </section>`;
  }
  function statusHTML(st) {
    if (U.requested && (!st || st.id !== U.requested)) return `<div class="card secondary set-banner h g8">${ui.spinner()}<p class="t13 ink">Waiting for your Mac to pick this up (within 30 seconds)…</p></div>`;
    if (!st) return "";
    if (st.state === "working") return `<div class="card secondary set-banner h g8">${ui.spinner()}<p class="t13 ink">${esc(st.message || "Updating…")}</p></div>`;
    const lines = (st.lines || []).filter((l) => /INSTALLED|FAIL|SKIP/.test(l));
    const names = Object.fromEntries((st.devices || []).map((x) => [x.udid, x.name]));
    const pretty = (l) => l.replace(/[0-9A-Fa-f-]{20,}/, (u) => names[u] || names[u.slice(-6)] || "device").replace(/^INSTALLED on/, "Updated").replace(/^FAIL: /, "").replace(/^SKIP: /, "");
    const ok = st.state === "done";
    return `<div class="card ${ok ? "done" : "attention"} set-banner v g4"><p class="t13 ink"><b class="${ok ? "c-done" : "c-attention"}">${ok ? "Updated" : "Didn't finish"}</b> · ${esc(D.ago(new Date(st.at)))}</p>
      ${lines.length ? `<p class="t13 ink2">${lines.map((l) => esc(pretty(l))).join("<br>")}</p>` : ""}</div>`;
  }
  F.on("set-update", async () => {
    const id = F.uuid();
    U.requested = id; F.refreshSheets();
    if (F.DEMO) {
      setTimeout(() => { F.S.status = { id, state: "working", at: new Date().toISOString(), message: "Your Mac is building the app. This takes about 2 minutes." }; F.refreshSheets(); }, 1200);
      setTimeout(() => { F.S.status = { id, state: "done", at: new Date().toISOString(), lines: ["INSTALLED on AAAAAA"], devices: F.devices()?.devices || [] }; U.requested = null; F.refreshSheets(); }, 4000);
      return;
    }
    try {
      const cur = await F.getFile(F.CONFIG.syncRepo, "update/request.json").catch(() => null);
      await F.putFile(F.CONFIG.syncRepo, "update/request.json", JSON.stringify({ id, at: new Date().toISOString(), from: "website" }), cur?.sha, "Update requested from the website");
    } catch (e) { U.requested = null; F.toast("Couldn't send that: " + F.friendly(e.message)); F.refreshSheets(); return; }
    const started = Date.now();
    const poll = async () => {
      try {
        const f = await F.getFile(F.CONFIG.syncRepo, "update/status.json");
        F.S.status = f ? JSON.parse(f.text) : null;
        if (F.S.status?.id === id && F.S.status.state !== "working") { U.requested = null; F.refreshSheets(); F.refresh(); return; }
      } catch {}
      F.refreshSheets();
      if (Date.now() - started < 10 * 60 * 1000) setTimeout(poll, 5000); else { U.requested = null; F.refreshSheets(); }
    };
    setTimeout(poll, 4000);
  });

  // ------------------------------------------------------------ Sync across devices (SyncSetupView, the signed-in half)
  function openSync() {
    const s = F.sheet({ title: "Sync across devices", trailing: { label: "Done", act: "sheet-close" }, body: syncBody, id: "sync" });
    s.refresh = () => s.update();
  }
  function syncBody() {
    const snap = F.snap();
    const last = F.S.lastLoad ? new Date(F.S.lastLoad).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Not yet";
    const fails = Object.entries(snap?.failed || {});
    return `<div class="narrow form">
      <div class="fsec"><div class="fhead">Your iPhone, iPad and website</div>
        <div class="fgroup">
          <div class="frow"><span class="lbl">Signed in as</span><span class="val">${F.DEMO ? "Demo" : "This browser"}</span></div>
          <div class="frow"><span class="lbl">Last sync</span><span class="val">${esc(last)}</span></div>
          <div class="frow"><span class="lbl">From your phone</span><span class="val">${snap ? esc(`${snap.device || "iPhone"}, ${D.ago(new Date(snap.at * 1000))}`) : "Not yet"}</span></div>
          ${F.S.error ? `<div class="frow">${ui.errorText(F.friendly(F.S.error))}</div>` : ""}
          <div class="frow"><button type="button" class="rowlink" data-act="sync-now" ${F.S.loading ? "disabled" : ""}>${F.S.loading ? "Syncing…" : "Sync now"}</button></div>
          <div class="frow"><button type="button" class="rowlink destructive" data-act="sync-signout">Sign out on this device</button></div>
        </div>
        <p class="ffoot">Tasks, calendar, planner, Friday's memory, settings and your Claude key stay in step with your iPhone and iPad, every minute while the app is open there. Everything is scrambled with your password before it leaves a device.</p>
      </div>
      ${fails.length ? `<div class="fsec"><div class="fhead">Your iPhone couldn't do these</div>
        <div class="fgroup">${fails.map(([, m]) => `<div class="frow"><span class="lbl t15">${esc(m)}</span></div>`).join("")}</div></div>` : ""}
    </div>`;
  }
  F.on("sync-now", async () => { F.S.loading = true; F.refreshSheets(); await F.refresh(); F.refreshSheets(); });
  F.on("sync-signout", async () => {
    const ok = await F.alert({ title: "Sign out on this device?", message: "This browser forgets your sign-in. Your iPhone, iPad and their data are not affected.",
      buttons: [{ label: "Sign out", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
    if (!ok) return;
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    F.signOut();
  });

  // ------------------------------------------------------------ Friday settings (SettingsView)
  F.openFridaySettings = () => {
    const s = F.sheet({ title: "Friday settings", trailing: { label: "Done", act: "sheet-close" }, body: fridayBody, id: "friday-settings" });
    s.refresh = () => { if (!s.el.contains(document.activeElement) || document.activeElement.tagName === "BUTTON") s.update(); };
    return s;
  };
  function mdRow(title, key) {
    const v = F.prefs()[key] || "";
    if (!v) return `<div class="frow"><span class="lbl">${esc(title)}</span>${ui.btn({ label: "Add", kind: "link", act: "fs-md-add", data: { key } })}</div>`;
    return `<div class="frow"><label class="lbl" for="fs-${key}">${esc(title)}</label>
      <input id="fs-${key}" class="bare fs-date" type="date" value="2000-${esc(v)}" min="2000-01-01" max="2000-12-31" data-change="fs-md" data-key="${key}">
      ${ui.btn({ kind: "icon", icon: "xmark.circle.fill", act: "fs-md-clear", data: { key }, aria: "Remove " + title, cls: "fs-clear" })}</div>`;
  }
  function fridayBody() {
    const p = F.prefs(), cur = p.claudeModel || "claude-opus-5-5";
    const facts = F.S.payload?.friday?.value?.facts || [];
    return `<div class="narrow form">
      <div class="fsec"><div class="fhead">Special dates</div>
        <div class="fgroup">${mdRow("Your birthday", "birthday")}${mdRow("Anniversary", "anniversary")}
          ${p.anniversary ? `<div class="frow"><label class="sr" for="fs-annlabel">What it's for</label><input id="fs-annlabel" class="bare" type="text" placeholder="What it's for (e.g. wedding anniversary)" value="${esc(p.anniversaryLabel || "")}" data-change="fs-text" data-key="anniversaryLabel"></div>` : ""}</div>
        <p class="ffoot">Friday wishes you a happy birthday, congratulates you on anniversaries, and gives you a heads-up on holidays and birthdays from your calendars.</p></div>
      <div class="fsec"><div class="fhead">Email signature</div>
        <div class="fgroup"><div class="frow"><label class="sr" for="fs-sig">Signature</label><textarea id="fs-sig" class="bare" rows="3" placeholder="Signature" data-change="fs-text" data-key="mailSignature">${esc(p.mailSignature ?? "Jose")}</textarea></div></div>
        <p class="ffoot">Added to the end of every email you write. Leave it empty for none.</p></div>
      <div class="fsec"><div class="fhead">What F.R.I.D.A.Y. remembers</div>
        <div class="fgroup">
          ${facts.length ? facts.map((f) => `<div class="frow"><span class="lbl t15">${esc(f.fact)}</span></div>`).join("") : '<div class="frow"><span class="lbl muted">Nothing yet.</span></div>'}
          
        </div>
        <p class="ffoot">Stored privately on your iPhone. To forget a fact or erase everything, use Friday settings there.</p></div>
    </div>`;
  }
  const save = async (key, value, msg) => { try { await F.setPref(key, value); if (msg) F.toast(msg); } catch (e) { F.toast("Couldn't save that: " + F.friendly(e.message)); } F.refreshSheets(); };
  F.onChange("fs-model", (el) => save("claudeModel", el.value, "Friday uses " + (MODELS().find((m) => m.id === el.value)?.label.split(" — ")[0] || "that model") + " now."));
  F.onChange("fs-text", (el) => save(el.dataset.key, el.value));
  F.onChange("fs-md", (el) => { const m = /^\d{4}-(\d{2}-\d{2})$/.exec(el.value); if (m) save(el.dataset.key, m[1]); });
  F.on("fs-md-add", (el) => { const d = new Date(); return save(el.dataset.key, `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`); });
  F.on("fs-md-clear", (el) => save(el.dataset.key, null));
  F.on("fs-newconv", () => { if (F.newConversation) { F.newConversation(); F.toast("New conversation started."); } });

  // Claude key (SettingsView "Claude" section): saved into the synced, encrypted claude section; the iPhone puts it in its Keychain.
  F.onInput("fs-key", (el) => { const b = document.getElementById("fs-key-save"); if (b) b.disabled = !el.value.trim(); });
  F.on("fs-key-save", async () => {
    const v = document.getElementById("fs-key")?.value.trim();
    if (!v) return;
    await F.writeSection("claude", () => v);
    F.toast("Key saved. Friday uses Claude now.");
    F.render(); F.refreshSheets();
  });
  F.on("fs-key-remove", async () => {
    const ok = await F.alert({ title: "Remove your Claude key?", message: "Friday on the website stops working until you add a key again. Your iPhone falls back to its built-in brain.",
      buttons: [{ label: "Remove key", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
    if (!ok) return;
    await F.writeSection("claude", () => "");
    F.toast("Key removed.");
    F.render(); F.refreshSheets();
  });
})();
