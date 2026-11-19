// Mail — a port of CommsView.swift (stream, MessageRow, MessageView, ComposeView, MoveSheet) + EmailWebView.swift.
// Email is relayed by the iPhone: we read F.mail() (friday-mail.json) and ask the phone to act with mail_* commands.
// Every command shows up at once here (pending), and the iPhone carries it out the next time it syncs.
"use strict";
(() => {
  const { ui, esc, D } = F;
  const icon = F.icon;

  F.addIcons({
    "envelope.open": '<path d="M3 10l9-6 9 6v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z"/><path d="M3.5 10.5l8.5 6 8.5-6"/>',
    "tray.2": '<path d="M3 9l2.5-5h13L21 9v3H3zM3 9h5l1 2h6l1-2h5"/><path d="M3 12v8h18v-8M3 15h5l1 2h6l1-2h5"/>',
    paperplane: '<path d="M21 3L3 10.5l7 3 3 7z"/><path d="M21 3l-11 10.5"/>',
    "xmark.bin": '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10.5h14V9M10 12.5l4 4M14 12.5l-4 4"/>',
    "doc.text": '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h4"/>',
    "folder.badge.plus": '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h5l2 2.5h8A1.5 1.5 0 0 1 21 9v3M13 20H4.5A1.5 1.5 0 0 1 3 18.5z"/><path d="M18 14v6M15 17h6"/>',
    "chevron.up.chevron.down": '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
    "checkmark.circle.fill": '<circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none"/><path d="M7.5 12.3l3 3 6-6.3" stroke="#fff" stroke-width="2.2"/>',
    circle: '<circle cx="12" cy="12" r="9.5"/>',
    "tray.and.arrow.up": '<path d="M3 13h5l1 2h6l1-2h5v6.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z"/><path d="M12 3.5v8.5M8.5 7L12 3.5 15.5 7"/>',
    "hand.raised": '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-2.4 0-4-1.2-5.4-3.4l-2-3.4a1.4 1.4 0 0 1 2.3-1.6L8 14.5"/>',
    "hand.raised.slash": '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-2.4 0-4-1.2-5.4-3.4l-2-3.4a1.4 1.4 0 0 1 2.3-1.6L8 14.5"/><path d="M3 3l18 18"/>',
    "envelope.badge.shield.half.filled": '<path d="M13 19H4.5A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V11"/><path d="M3.5 6l8.5 6 8.5-6"/><path d="M18 13.5l3 1.2V17c0 2-1.3 3.4-3 4-1.7-.6-3-2-3-4v-2.3z"/><path d="M18 13.5V21" />',
    "arrow.up.right.square": '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9.5 14.5l6-6M10 8.5h5.5V14"/>',
    "line.3.horizontal.decrease": '<path d="M4 7h16M7 12h10M10 17h4"/>',
    "line.3.horizontal.decrease.circle.fill": '<circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none"/><path d="M7 9h10M9 12h6M11 15h2" stroke="#fff"/>',
    "tray.full": '<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1.5 2.5h5L16 13h5"/><path d="M8 8h8M7.5 10.5h9"/>',
    "checkmark.circle": '<circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.3l3 3 6-6.3"/>',
    "flag.slash": '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/><path d="M3 3l18 18"/>',
    minus: '<path d="M5 12h14"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 9.5h1M9.5 9.5h1M13 9.5h1M16.5 9.5h1M6 12.5h1M9.5 12.5h1M13 12.5h1M16.5 12.5h1M8 15.5h8"/>',
  });
  const MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

  // ------------------------------------------------------------ state (CommsView @State)
  const M = {
    acct: null, folder: "INBOX", lane: "All", query: "",
    selecting: false, picked: new Set(),
    show: "All mail",             // the ⋯ menu's filter: All mail · Unread only · Flagged only
    anchor: null, cursor: null, base: new Set(),   // Shift-click / Shift+arrow ranges grow from the anchor; base = what was picked before the range
    scrollTo: null,
    menu: null, menuAt: null, swipe: null,
    local: [],                    // commands being written right now (shown before GitHub confirms)
    asText: new Set(),   // the app opens email with images loaded (MessageView loadImages = true), so there is no Load images step
    autoSeen: new Set(), askedBody: new Set(), bodyAt: {},       // bodyAt: mailID → when this page last asked the iPhone for it
    listTop: 0, paneTop: 0, paneFor: null,
  };
  const BODY_WAIT = 45;           // seconds before "Couldn't get this email from your iPhone"

  // ------------------------------------------------------------ this browser's own memory (never synced)
  const LS = "friday.mail." + (F.DEMO ? "demo." : "");
  const lsGet = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || "null"); return v && typeof v === "object" ? v : fb; } catch { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch {} };
  /** Every mail command seen, kept until friday-mail.json is newer than it, so a row never flashes back
   *  between "the iPhone applied it" and "the iPhone's next email upload". (Demo starts fresh each load.) */
  const echo = F.DEMO ? {} : lsGet("echo", {});
  /** commandId → what it was about ({kind, subject, to, n, …}), so a failure can say what didn't happen. */
  const sentMeta = lsGet("sent", {});
  /** commandId → when he dismissed its failure. */
  const dismissed = lsGet("dismissed", {});
  {
    const now = Date.now() / 1000;
    for (const [k, v] of Object.entries(sentMeta)) if (now - (v.at || 0) > 3 * 86400) delete sentMeta[k];
    for (const [k, v] of Object.entries(dismissed)) if (now - v > 7 * 86400) delete dismissed[k];
    lsSet("sent", sentMeta); lsSet("dismissed", dismissed);
  }
  /** The mail commands to lay over friday-mail.json, oldest first: queued, being written, or applied but not yet in the
   *  mail file. A command withdrawn from the queue (Undo) or one the iPhone couldn't do (snapshot.failed) isn't laid over. */
  function mailCommands() {
    const raw = F.S.payload?.queue?.value || [], mailAt = F.mail()?.at || 0, now = F.nowSec();
    const s = F.snap(), applied = new Set(s?.applied || []), failed = s?.failed || {};
    const live = new Set([...raw, ...M.local].map((c) => c.id));
    let dirty = false;
    for (const c of [...raw, ...M.local]) if (c?.kind?.startsWith("mail_") && !echo[c.id]) { echo[c.id] = c.kind === "mail_send" ? { ...c, body: "" } : c; dirty = true; }
    for (const [id, c] of Object.entries(echo)) {
      const gone = !live.has(id) && !applied.has(id);                        // taken back before the iPhone ran it
      if (gone || (applied.has(id) && mailAt > (c.at || 0)) || now - (c.at || 0) > 2 * 86400) { delete echo[id]; dirty = true; }
    }
    if (dirty && !F.DEMO) lsSet("echo", echo);
    return Object.values(echo).filter((c) => !failed[c.id]).map((c) => ({ ...c, applied: applied.has(c.id) })).sort((a, b) => (a.at || 0) - (b.at || 0));
  }
  const ORDER = ["inbox", "sent", "drafts", "archive", "all", "flagged", "junk", "trash"];
  const order = (r) => { const i = ORDER.indexOf(r || ""); return i < 0 ? 99 : i; };
  const roleIcon = (r) => ({ sent: "paperplane", trash: "trash", archive: "archivebox", all: "archivebox", junk: "xmark.bin", drafts: "doc.text", flagged: "flag", inbox: "tray" })[r] || "folder";
  const wide = () => innerWidth >= 900;      // the list | message split (style.css .split) starts at 900px

  // ------------------------------------------------------------ the data, with pending commands laid over it
  function model() {
    const md = F.mail();
    if (!md) return null;
    const accounts = (md.accounts || []).map((a) => ({ ...a, color: F.accountColor(a.colorIndex) }));
    const folders = {};
    for (const a of accounts) folders[a.id] = (md.folders?.[a.id] || []).map((f) => ({ name: f.name, role: f.role || null }));
    const byId = new Map();
    for (const m of md.messages || []) byId.set(m.id, { ...m, subject: m.subject ?? "", date: D.fromEpoch(m.date), from: m.from || { name: "", email: "(unknown)" }, to: m.to || [], cc: m.cc || [], pending: false });
    const raw = new Map([...byId].map(([k, v]) => [k, { ...v }]));      // as the iPhone sent it: whose email a command was about
    const byMid = new Map(); for (const m of raw.values()) if (m.messageID && !byMid.has(m.messageID)) byMid.set(m.messageID, m.id);
    const roleName = (aid, role) => folders[aid]?.find((f) => f.role === role)?.name || null;
    const s = F.snap(), failed = s?.failed || {};
    const sending = [], askedFolder = new Set(), askedBody = new Map(), goneDrafts = new Set();
    const junkName = (aid) => roleName(aid, "junk") || "Junk";
    const toJunk = (m) => { if (m) { m.folder = junkName(m.accountID); m.junk = true; m.pending = true; } };
    const junkFolder = (m) => { const j = roleName(m.accountID, "junk"); return j ? m.folder === j : m.folder.toLowerCase() === "junk"; };
    for (const m of byId.values()) m.junk = m.junk === true || junkFolder(m);       // MailStore.isInJunk
    const inTrash = (m) => { const t = roleName(m.accountID, "trash"); return !!t && m.folder === t; };
    // the junk lists (prefs, written by the iPhone), with his pending changes laid over them
    const p = F.prefs();
    const lists = { blocked: listOf(p.mailBlocked), allowed: listOf(p.mailAllowed), unsub: mapOf(p.mailUnsubscribed),
      tally: mapOf(p.mailJunkTally), filter: mapOf(p.mailJunkFilter) };
    const own = new Set(accounts.map((a) => a.email.toLowerCase()));
    const lc = (e) => String(e || "").toLowerCase();
    const blockE = (e) => { e = lc(e); if (!e.includes("@") || own.has(e)) return; lists.allowed = lists.allowed.filter((x) => x !== e); if (!lists.blocked.includes(e)) lists.blocked.push(e); };
    const unblockE = (e) => { e = lc(e); lists.blocked = lists.blocked.filter((x) => x !== e); };
    // one email (mailID) or many (mailIDs[]); messageID(s) find it if it moved since (like WebBridge.findMail)
    const find = (c, map) => {
      const a = [...(c.mailIDs || []), ...(c.mailID != null ? [c.mailID] : [])], b = [...(c.messageIDs || []), ...(c.messageID != null ? [c.messageID] : [])];
      return a.map((id, i) => map.get(id) || (b[i] && byMid.has(b[i]) ? map.get(byMid.get(b[i])) : null)).filter(Boolean);
    };
    for (const c of mailCommands()) {
      const ms = find(c, byId), senders = find(c, raw).map((x) => lc(x.from.email));
      const pend = !c.applied;
      switch (c.kind) {
        case "mail_junk": for (const x of ms) toJunk(x); if (c.block) senders.forEach(blockE); break;
        case "mail_notjunk": for (const x of ms) { x.folder = "INBOX"; x.junk = false; x.pending = pend; }
          for (const e of senders) { unblockE(e); if (!lists.allowed.includes(e)) lists.allowed.push(e); } break;
        case "mail_unsubscribe": { const o = find(c, raw)[0]; if (!o) break;
          const e = lc(o.from.email);
          if (!(lists.unsub[e] > 0)) lists.unsub[e] = unsubscribePlan(o).kind === "page" ? -(c.at || F.nowSec()) : (c.at || F.nowSec());   // negative = their page opened, not confirmed
          if (c.block) blockE(e);
          if (c.alsoJunk) for (const x of byId.values()) if (lc(x.from.email) === e && !x.junk) toJunk(x);
        } break;
        case "mail_seen": for (const x of ms) x.seen = c.on !== false; break;
        case "mail_flag": for (const x of ms) { x.flagged = c.on !== false; x.pending = pend; } break;
        case "mail_archive": for (const x of ms) { const f = roleName(x.accountID, "archive"); if (f) { x.folder = f; x.junk = false; x.pending = pend; } else byId.delete(x.id); } break;
        case "mail_trash": case "mail_delete":
          for (const x of ms) { const f = roleName(x.accountID, "trash"); if (c.kind === "mail_trash" && f && f !== x.folder) { x.folder = f; x.junk = false; x.pending = pend; } else byId.delete(x.id); } break;
        case "mail_move": for (const x of ms) { if (!c.accountID || c.accountID === x.accountID) { x.folder = c.folder; x.junk = junkFolder(x); x.pending = pend; } else byId.delete(x.id); } break;
        case "mail_mark_all_read": { const f = c.folder || "INBOX";
          for (const x of byId.values()) if (!x.seen && x.folder === f && (!c.accountID || x.accountID === c.accountID)) x.seen = true; } break;
        case "mail_empty":
          for (const x of [...byId.values()]) if ((!c.accountID || x.accountID === c.accountID) && (c.role === "junk" ? x.junk : c.role === "trash" && inTrash(x))) byId.delete(x.id);
          break;
        case "mail_block": blockE(c.email); break;
        case "mail_unblock": unblockE(c.email); break;
        case "mail_allow_remove": lists.allowed = lists.allowed.filter((x) => x !== lc(c.email)); break;
        case "mail_unsub_confirm": lists.unsub[lc(c.email)] = c.at || F.nowSec(); break;
        case "mail_body": { const id = ms[0]?.id || c.mailID; askedBody.set(id, Math.max(askedBody.get(id) || 0, c.at || 0)); } break;
        case "mail_folder": if (pend) askedFolder.add(c.accountID + "|" + c.folder); break;
        case "mail_create_folder": if (folders[c.accountID] && !folders[c.accountID].some((f) => f.name === c.name)) folders[c.accountID].push({ name: c.name, role: null, pending: true }); break;
        case "mail_draft_delete": goneDrafts.add(c.draftID); break;
        case "mail_send": if (pend) sending.push(c); if (c.draftID) goneDrafts.add(c.draftID); if (c.replyingTo && byId.get(c.replyingTo)) byId.get(c.replyingTo).seen = true; break;
      }
    }
    // what the iPhone couldn't do (snapshot.failed), for the commands this browser queued, until he dismisses it
    const failures = Object.entries(failed).filter(([id]) => sentMeta[id] && !dismissed[id]).map(([id, msg]) => ({ ...sentMeta[id], id, msg: String(msg) }));
    const failedSends = failures.filter((f) => f.kind === "mail_send");
    const failedOther = failures.filter((f) => f.kind !== "mail_send" && f.kind !== "mail_body");
    const bodyFailed = {}; for (const f of failures) if (f.kind === "mail_body" && f.mailID) bodyFailed[f.mailID] = f;
    const messages = [...byId.values()].sort((a, b) => b.date - a.date);
    const drafts = (md.drafts || []).filter((d) => !goneDrafts.has(d.id));
    return { md, accounts, folders, messages, byId, bodies: md.bodies || {}, drafts, sending, failedSends, failedOther, bodyFailed, askedFolder, askedBody, roleName, lists };
  }

  // ------------------------------------------------------------ junk, blocked senders and unsubscribe (MailStore, bottom)
  // Lists live in prefs (written by the iPhone): mailBlocked / mailAllowed ("\n"-joined lowercase emails),
  // mailUnsubscribed (JSON {email: epochSeconds}; negative = their unsubscribe page was opened, not confirmed yet).
  // The website changes them only with commands (mail_block, mail_unblock, mail_allow_remove, mail_unsub_confirm).
  const listOf = (s) => (Array.isArray(s) ? s : String(s || "").split("\n")).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const mapOf = (s) => { try { const o = typeof s === "object" && s ? s : JSON.parse(s || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? { ...o } : {}; } catch { return {}; } };
  const blockedSenders = (X) => X.lists.blocked;
  const allowedSenders = (X) => X.lists.allowed;
  const isBlocked = (X, email) => { const e = (email || "").toLowerCase(); return !allowedSenders(X).includes(e) && blockedSenders(X).includes(e); };
  /** When he unsubscribed from a sender (confirmed only). */
  function unsubscribedOn(X, email) { const s = X.lists.unsub[(email || "").toLowerCase()]; return s > 0 ? new Date(s * 1000) : null; }
  /** He opened their unsubscribe page but hasn't said it's finished. */
  const pageOpened = (X, email) => X.lists.unsub[(email || "").toLowerCase()] < 0;
  /** Never block one of his own account addresses. */
  const blockable = (X, emails) => { const own = new Set(X.accounts.map((a) => a.email.toLowerCase())); return [...new Set(emails.map((e) => e.toLowerCase()))].filter((e) => e.includes("@") && !own.has(e)); };
  const block = (X, emails) => { const l = blockable(X, emails); if (l.length) return send(l.map((email) => ["mail_block", { email }]), l.length === 1 ? `Blocked ${l[0]}` : `Blocked ${l.length} senders`); };
  const unblock = (emails) => { const l = [...new Set(emails.map((e) => e.toLowerCase()))]; if (l.length) return send(l.map((email) => ["mail_unblock", { email }]), l.length === 1 ? `Unblocked ${l[0]}` : `Unblocked ${l.length} senders`); };
  const forgetAllowed = (email) => send([["mail_allow_remove", { email: email.toLowerCase() }]]);
  const isInJunk = (m) => !!m?.junk;
  const junkMessages = (X) => X.messages.filter(isInJunk);
  const senderName = (m) => m.from.name || m.from.email;

  /** Every sender that offers unsubscribe, most mail first. Opened = how many he has read. */
  function subscriptions(X) {
    const groups = new Map();
    for (const m of X.messages) {
      if (!(m.unsubscribe || "").trim()) continue;
      const e = m.from.email.toLowerCase();
      if (!groups.has(e)) groups.set(e, []);
      groups.get(e).push(m);
    }
    return [...groups.entries()].map(([email, ms]) => {
      const newest = ms.reduce((a, b) => (b.date > a.date ? b : a));
      return { email, name: newest.from.name || email, count: ms.length, opened: ms.filter((m) => m.seen).length, last: newest.date, sample: newest };
    }).sort((a, b) => b.count - a.count || b.last - a.last);
  }
  /** Mailing lists he gets a lot of and never opens: suggestions only. Nothing happens until he taps. */
  const junkSuggestions = (X) => subscriptions(X).filter((s) => s.count >= 3 && s.opened === 0 && !unsubscribedOn(X, s.email) && !isBlocked(X, s.email) && !allowedSenders(X).includes(s.email));

  /** The links in a List-Unsubscribe header: "<https://…>, <mailto:…>". Only https, http and mailto. */
  function unsubscribeLinks(header) {
    const out = [];
    for (const r of String(header || "").matchAll(/<([^>]*)>/g)) {
      try { const u = new URL(r[1].trim()); if (["https:", "http:", "mailto:"].includes(u.protocol)) out.push(u); } catch {}
    }
    return out;
  }
  /** How this email unsubscribes: the iPhone does one-click or the mailto email; otherwise only the sender's own page is left. */
  function unsubscribePlan(m) {
    const links = unsubscribeLinks(m.unsubscribe);
    if (!links.length) return { kind: "none" };
    const https = links.find((u) => u.protocol === "https:"), mailto = links.find((u) => u.protocol === "mailto:");
    if ((m.oneClick && https) || mailto) return { kind: "phone" };
    const page = https || links.find((u) => u.protocol === "http:");
    return page ? { kind: "page", url: page.href } : { kind: "none" };
  }
  /** Only ever opens a web page (https or http), in a new tab that can't reach back. */
  function openPage(url) {
    let u; try { u = new URL(url); } catch { return; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return;
    window.open(u.href, "_blank", "noopener,noreferrer");
  }

  const account = (X, id) => X.accounts.find((a) => a.id === id) || null;
  const display = (a) => (a?.name ? a.name : a?.email || "");
  const formatAddress = (a) => (!a.name ? a.email : `${a.name.includes(",") ? `"${a.name}"` : a.name} <${a.email}>`);
  const inboxOf = (X) => X.messages.filter((m) => m.folder === "INBOX");
  const isInTrash = (X, m) => { const t = X.roleName(m.accountID, "trash"); return !!t && m.folder === t; };
  const displayName = (name) => { const last = name.split("/").pop() || name; return last.toUpperCase() === "INBOX" ? "Inbox" : last; };

  /** MailStore.threadKey / threads / thread(of:) — exactly the app's rule:
   *  the first <…> in References (the conversation's root); else a Re:/Fw:/Fwd:/Aw: subject (optionally [n]) without the prefixes,
   *  unless that's empty or "(no subject)"; else the message's own Message-ID; else its id. Always per account. */
  function threadKey(m) {
    const acct = m.accountID + "|";
    const root = String(m.references || "").split(/[ \n\t]+/).find((t) => t.startsWith("<"));
    if (root) return acct + root.toLowerCase();
    const lower = String(m.subject || "").toLowerCase();
    if (/^\s*(re|fw|fwd|aw)(\[\d+\])?:/.test(lower)) {
      const subj = lower.replace(/^((re|fw|fwd|aw)(\[\d+\])?:\s*)+/, "").replace(/^[ \t]+|[ \t]+$/g, "");
      if (subj && subj !== "(no subject)") return acct + "s:" + subj;
    }
    if (m.messageID) return acct + String(m.messageID).toLowerCase();
    return acct + m.id;
  }
  function threads(list) {
    const order = [], groups = new Map();
    for (const m of [...list].sort((a, b) => b.date - a.date)) { const k = threadKey(m); if (!groups.has(k)) { order.push(k); groups.set(k, []); } groups.get(k).push(m); }
    return order.map((k) => groups.get(k));
  }
  const threadOf = (X, m) => { const k = threadKey(m); return X.messages.filter((x) => threadKey(x) === k).sort((a, b) => a.date - b.date); };

  function localSearch(X, q) {
    q = q.toLowerCase().trim();
    if (!q) return [];
    return X.messages.filter((m) => m.subject.toLowerCase().includes(q) || display(m.from).toLowerCase().includes(q) || m.from.email.toLowerCase().includes(q) || (m.preview || "").toLowerCase().includes(q));
  }
  function current(X) {
    if (M.query.trim()) return localSearch(X, M.query);
    let list = [];
    if (M.folder === "INBOX") {
      list = inboxOf(X).filter((m) => !M.acct || m.accountID === M.acct);
      if (M.lane === "Priority") list = list.filter((m) => !m.isUpdate);
      if (M.lane === "Updates") list = list.filter((m) => m.isUpdate);
    } else if (boxRole()) {
      list = roleMessages(X, boxRole()).filter((m) => !M.acct || m.accountID === M.acct);
    } else if (M.acct) list = X.messages.filter((m) => m.accountID === M.acct && m.folder === M.folder);
    if (M.show === "Unread only") list = list.filter((m) => !m.seen);
    if (M.show === "Flagged only") list = list.filter((m) => m.flagged);
    return list;
  }
  /** The rows on screen, top to bottom (one per conversation). */
  const visibleIds = (X) => threads(current(X)).map((t) => t[0].id);
  /** "@sent" / "@junk" / "@trash": that box in every account at once (CommsView.boxRole). */
  const boxRole = () => (M.folder.startsWith("@") ? M.folder.slice(1) : null);
  const BOX = { sent: "Sent", junk: "Junk", trash: "Trash" };
  function roleMessages(X, role) {
    if (role === "junk") return junkMessages(X);
    return X.messages.filter((m) => m.folder === X.roleName(m.accountID, role)).sort((a, b) => b.date - a.date);
  }
  function folderTitle(X) {
    if (M.folder === "INBOX") return "Mail";
    if (boxRole()) return BOX[boxRole()] || boxRole();
    for (const a of X.accounts) { const f = X.folders[a.id]?.find((x) => x.name === M.folder); if (f) return displayName(f.name); }
    return M.folder;
  }
  function knownAddresses(X) {
    const mine = new Set(X.accounts.map((a) => a.email.toLowerCase())), count = new Map();
    for (const m of X.messages) for (const a of [m.from, ...m.to, ...m.cc]) {
      const k = (a?.email || "").toLowerCase();
      if (!k.includes("@") || mine.has(k) || k.includes("noreply") || k.includes("no-reply")) continue;
      const cur = count.get(k);
      count.set(k, [cur && cur[0].name ? cur[0] : a, (cur?.[1] || 0) + 1]);
    }
    return [...count.values()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  }

  // ------------------------------------------------------------ commands (several in one write, like core's cmd)
  /** What a mail command is about, remembered in this browser so a failure can say so. */
  function remember(cs) {
    const X = model();
    for (const c of cs) {
      if (!c.kind.startsWith("mail_") || c.kind === "mail_refresh") continue;
      const idl = [...(c.mailIDs || []), ...(c.mailID ? [c.mailID] : [])], first = X?.byId.get(idl[0]);
      sentMeta[c.id] = { kind: c.kind, at: c.at, n: idl.length, mailID: idl[0] || null, on: c.on, folder: c.folder || null, email: c.email || null, role: c.role || null, name: c.name || null,
        subject: c.kind === "mail_send" ? c.subject || "" : first?.subject || "", to: c.kind === "mail_send" ? c.to || "" : first ? senderName(first) : "",
        ...(c.kind === "mail_send" ? { send: { accountID: c.accountID, to: c.to, cc: c.cc, subject: c.subject, body: c.body, inReplyTo: c.inReplyTo, references: c.references, replyingTo: c.replyingTo, byFriday: c.byFriday, draftID: c.draftID || null } } : {}) };
    }
    lsSet("sent", sentMeta);
  }
  async function send(list, toastText, undo) {
    const cs = list.map(([kind, p]) => ({ id: F.uuid(), at: F.nowSec(), kind, ...p }));
    remember(cs);
    M.local.push(...cs); M.menu = null; M.swipe = null;
    F.render();
    try {
      const applied = new Set(F.snap()?.applied || []);
      await F.writeSection("queue", (v) => [...(v || []).filter((x) => !applied.has(x.id)), ...cs]);
      if (toastText) F.toast(toastText, undo ? { undo: () => undo(cs) } : {});
    } catch (e) { F.toast("Couldn't do that: " + F.friendly(e.message)); throw e; }
    finally { M.local = M.local.filter((c) => !cs.includes(c)); F.render(); }
    return cs;
  }

  /** MailStore.markJunk: to each account's Junk; block = that sender's future mail goes there too. Undo like the app. */
  async function markJunk(X, ms, blockSender = false) {
    const list = ms.filter((m) => !isInJunk(m));
    if (!list.length) return;
    const senders = [...new Set(list.map((m) => m.from.email.toLowerCase()))];
    const from = new Map(list.map((m) => [m.id, m.folder]));
    // block = the iPhone also blocks the sender (mail_junk{block}); the screen shows it blocked right away
    await send([["mail_junk", { ...idsMany(list), block: !!blockSender }]], `Moved ${what(list)} to Junk` + (blockSender ? " · sender blocked" : ""), async (cs) => {
      const applied = new Set(F.snap()?.applied || []), waiting = cs.filter((c) => !applied.has(c.id)).map((c) => c.id);
      if (waiting.length) { await F.writeSection("queue", (v) => (v || []).filter((c) => !waiting.includes(c.id))); F.render(); return; }   // not done yet: take the request back (block too)
      // already moved: bring them back from Junk, and unblock
      const Y = model(), back = Y ? Y.messages.filter((m) => isInJunk(m) && list.some((o) => o.accountID === m.accountID && o.messageID && o.messageID === m.messageID)) : [];
      const cmds = back.map((m) => ["mail_move", { ...one(m), folder: from.get(list.find((o) => o.messageID === m.messageID)?.id) || "INBOX", accountID: m.accountID }]);
      if (blockSender) cmds.push(...senders.map((email) => ["mail_unblock", { email }]));
      if (cmds.length) await send(cmds);
      F.render();
    });
  }
  /** MailStore.notJunk: back to the inbox; the iPhone unblocks that sender and never treats them as junk again. */
  async function notJunk(ms) {
    if (!ms.length) return;
    await send([["mail_notjunk", idsMany(ms)]], ms.length === 1 ? "Moved back to your inbox" : `Moved ${ms.length} emails back to your inbox`);
  }

  /** UnsubscribeConfirm: the one confirmation, then it happens with no further steps. */
  async function confirmUnsubscribe(X, m) {
    const domain = m.from.email.split("@").pop() || "the sender";
    const r = await F.alert({ title: `Unsubscribe from ${senderName(m)}?`, message: `F.R.I.D.A.Y. asks ${domain} to stop sending you email.`,
      buttons: [{ label: "Unsubscribe", value: "plain" }, { label: "Unsubscribe and move their mail to Junk", value: "junk" }, { label: "Cancel", kind: "cancel" }] });
    if (r) await unsubscribe(X, m, r === "junk");
  }
  /** The iPhone does one-click or the mailto email (it records the date when it's done). A sender that only takes requests
   *  on its own page: that page opens here, and the command still goes to the iPhone, which records "page opened, not
   *  confirmed" (a negative stamp) and moves their mail if asked. */
  async function unsubscribe(X, m, alsoJunk) {
    const plan = unsubscribePlan(m), name = senderName(m);
    if (plan.kind === "none") { F.toast("Couldn't unsubscribe: This email doesn't offer an unsubscribe link."); return; }
    if (plan.kind === "page") {
      openPage(plan.url);
      await send([["mail_unsubscribe", { ...one(m), alsoJunk: !!alsoJunk }]], "Finish unsubscribing on their page");
      return;
    }
    await send([["mail_unsubscribe", { ...one(m), alsoJunk: !!alsoJunk }]], `Asking your iPhone to unsubscribe from ${name}…`);
  }
  const quietly = (p) => p.catch(() => {});
  const what = (ms) => (ms.length === 1 ? `“${ms[0].subject}”` : `${ms.length} emails`);
  /** "Your iPhone couldn't archive “Next steps”: <the iPhone's reason>" */
  function failText(f) {
    const VERB = { mail_archive: "archive", mail_trash: "delete", mail_delete: "delete forever", mail_move: "move", mail_junk: "move to Junk", mail_notjunk: "move back to your inbox",
      mail_flag: f.on === false ? "unflag" : "flag", mail_seen: f.on === false ? "mark as unread" : "mark as read", mail_unsubscribe: "unsubscribe from", mail_empty: "empty",
      mail_create_folder: "create the folder", mail_folder: "open", mail_mark_all_read: "mark all as read", mail_block: "block", mail_unblock: "unblock",
      mail_allow_remove: "take off the never-junk list:", mail_unsub_confirm: "record that you unsubscribed from", mail_draft_delete: "discard the draft" };
    const obj = f.kind === "mail_unsubscribe" ? f.to : ["mail_block", "mail_unblock", "mail_allow_remove", "mail_unsub_confirm"].includes(f.kind) ? f.email
      : f.kind === "mail_empty" ? (f.role === "junk" ? "Junk" : "Trash") : f.kind === "mail_create_folder" ? f.name : f.kind === "mail_folder" ? f.folder
      : f.n > 1 ? `${f.n} emails` : f.subject ? `“${f.subject}”` : "";
    return `Your iPhone couldn't ${VERB[f.kind] || "do that"}${obj ? " " + obj : ""}: ${f.msg}`;
  }
  const dismissFailure = (id) => { dismissed[id] = F.nowSec(); lsSet("dismissed", dismissed); };
  /** Every mail command carries the Message-ID too, so the iPhone finds an email that moved since (WebBridge.findMail). */
  const one = (m) => ({ mailID: m.id, messageID: m.messageID || "" });
  const idsMany = (ms) => ({ mailIDs: ms.map((m) => m.id), messageIDs: ms.map((m) => m.messageID || "") });
  /** One email → {mailID, messageID}; several → {mailIDs[], messageIDs[]} (parallel) so the iPhone does them all in ONE command. */
  const ids = (ms) => (ms.length === 1 ? one(ms[0]) : idsMany(ms));
  const archiveAll = async (ms) => { if (ms.length) return send([["mail_archive", ids(ms)]], `Archived ${what(ms)}`); };
  async function trashAll(X, ms) {
    if (!ms.length) return;
    const permanent = ms.every((m) => isInTrash(X, m));
    return send([[permanent ? "mail_delete" : "mail_trash", ids(ms)]], `${permanent ? "Deleted forever" : "Deleted"} ${what(ms)}`);
  }
  const setSeen = async (ms, on) => { if (ms.length) return send([["mail_seen", { ...ids(ms), on }]]); };
  const setFlag = (m, on) => send([["mail_flag", { ...one(m), on }]]);
  const setFlagMany = async (ms, on) => { if (ms.length) return send([["mail_flag", { ...ids(ms), on }]]); };
  /** Delete from Trash is forever, so it asks first; anywhere else it goes to Trash. */
  async function deleteThread(X, th) {
    if (th.every((m) => isInTrash(X, m))) {
      const ok = await F.alert({ title: "Delete forever?", message: "This email is already in Trash. Deleting it here can't be undone.", buttons: [{ label: "Delete forever", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
      if (ok) await trashAll(X, th);
    } else await trashAll(X, th);
  }
  function openFolder(X, aid, f) {
    M.acct = aid; M.folder = f; M.menu = null; M.picked.clear();
    F.render();
    if (f !== "INBOX" && !X.askedFolder.has(aid + "|" + f)) quietly(send([["mail_folder", { accountID: aid, folder: f }]]));
  }
  const selectedId = () => { const p = location.hash.slice(1).split("/"); return p[0] === "mail" && p[1] ? decodeURIComponent(p[1]) : null; };
  const openId = (id) => { location.hash = "mail/" + encodeURIComponent(id); };
  const closeMessage = () => { if (selectedId()) location.hash = "mail"; };

  // ------------------------------------------------------------ drafts (MailStore.replyDraft / forwardDraft)
  const two = (n) => String(n).padStart(2, "0");
  const quoteDate = (d) => `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.getFullYear()} at ${D.time(d)}`;
  const plainDate = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}, ${D.time(d)}`;
  function replyDraft(X, m, all, { body = "", byFriday = false, quote = "" } = {}) {
    const q = quote.trim();
    if (q) {
      const who = m.from.name || m.from.email;
      body += `\n\nOn ${quoteDate(m.date)}, ${who} wrote:\n` + q.split("\n").slice(0, 200).map((l) => "> " + l).join("\n");
    }
    const me = (account(X, m.accountID)?.email || "").toLowerCase();
    let to = [m.replyTo || m.from];
    if (all) to = to.concat([...m.to, ...m.cc].filter((a) => a.email.toLowerCase() !== me));
    const seen = new Set();
    const toList = to.filter((a) => { const k = a.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).map(formatAddress);
    const subject = m.subject.toLowerCase().startsWith("re:") ? m.subject : "Re: " + m.subject;
    return { accountID: m.accountID, to: toList.join(", "), cc: "", subject, body, inReplyTo: m.messageID || "", references: ((m.references || "") + " " + (m.messageID || "")).trim(), replyingTo: m.id, byFriday };
  }
  function forwardDraft(m, text, attachments = []) {
    const header = `\n\n---------- Forwarded message ----------\nFrom: ${formatAddress(m.from)}\nDate: ${plainDate(m.date)}\nSubject: ${m.subject}\n\n`;
    const subject = m.subject.toLowerCase().startsWith("fwd:") ? m.subject : "Fwd: " + m.subject;
    return { accountID: m.accountID, to: "", cc: "", subject, body: header + text, attachmentsLeft: attachments };
  }

  // ------------------------------------------------------------ menus (SwiftUI Menu / contextMenu)
  const mi = (label, act, o = {}) => ({ label, act, ...o });
  function menuHTML(items) {
    return items.map((it) => {
      if (it.divider) return '<div class="mm-div" role="separator"></div>';
      if (it.header) return `<div class="mm-head">${it.dot ? `<i class="dot d8" style="background:${it.dot}"></i>` : ""}${esc(it.header)}</div>`;
      return `<button type="button" role="menuitem" class="mm-item ${it.destructive ? "destructive" : ""}" data-act="${esc(it.act)}" ${Object.entries(it.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")} ${it.disabled ? "disabled" : ""}>
        <span class="ell">${esc(it.label)}</span>${it.icon ? icon(it.icon) : ""}</button>`;
    }).join("");
  }
  const trigger = (key, inner, cls = "", aria = "") => `<button type="button" class="mtrig ${cls}" data-act="mail-menu" data-menu="${esc(key)}" aria-haspopup="menu" aria-expanded="${M.menu === key}" ${aria ? `aria-label="${esc(aria)}"` : ""}>${inner}</button>`;

  function menuItems(X, key) {
    if (key === "acct") {
      return [mi("All accounts", "mail-acct", { icon: M.acct ? "tray.2" : "checkmark", data: { id: "" } }),
        ...X.accounts.map((a) => { const n = inboxOf(X).filter((m) => m.accountID === a.id && !m.seen).length; return mi(a.label + (n ? ` (${n} unread)` : ""), "mail-acct", { icon: M.acct === a.id ? "checkmark" : "envelope", data: { id: a.id } }); })];
    }
    if (key === "boxes") {
      // on top: Inbox, Sent, Junk, Trash for every account at once (or the one picked); then each account's folders
      const one = account(X, M.acct);
      const out = [{ header: one ? `In ${one.label}` : "Every account" },
        ...[["INBOX", "Inbox", "tray"], ["@sent", "Sent", "paperplane"], ["@junk", "Junk", "xmark.bin"], ["@trash", "Trash", "trash"]]
          .map(([b, t, ic]) => mi(t, "mail-box", { icon: M.folder === b ? "checkmark" : ic, data: { box: b } })),
        { divider: true }];
      if (one) out.push(mi("New folder…", "mail-new-folder", { icon: "folder.badge.plus", data: { acct: one.id } }));
      out.push(mi("Unsubscribe & block", "mail-subs", { icon: "envelope.badge.shield.half.filled" }), { divider: true });
      for (const a of X.accounts) {
        if (one && a.id !== one.id) continue;
        const fl = X.folders[a.id] || [];
        out.push({ header: a.label, dot: a.color });
        out.push(mi("Inbox", "mail-folder", { icon: "tray", data: { acct: a.id, folder: "INBOX" } }));
        for (const f of fl.filter((f) => f.role && f.role !== "inbox").sort((x, y) => order(x.role) - order(y.role))) out.push(mi(displayName(f.name), "mail-folder", { icon: roleIcon(f.role), data: { acct: a.id, folder: f.name } }));
        for (const f of fl.filter((f) => !f.role && f.name.toUpperCase() !== "INBOX").sort((x, y) => x.name.localeCompare(y.name))) out.push(mi(f.name, "mail-folder", { icon: "folder", data: { acct: a.id, folder: f.name } }));
      }
      return out;
    }
    if (key === "more") {
      const m = X.byId.get(selectedId()); if (!m) return [];
      const b = X.bodies[m.id];
      const e = m.from.email.toLowerCase();
      const junk = [...(isInJunk(m) ? [mi("Not Junk", "mail-notjunk", { icon: "tray.and.arrow.up", data: { id: m.id } })]
          : [mi("Mark as Junk", "mail-junk", { icon: "xmark.bin", data: { id: m.id } }), mi("Junk and block sender", "mail-junk", { icon: "hand.raised", data: { id: m.id, block: 1 } })]),
        ...(blockedSenders(X).includes(e) ? [mi(`Unblock ${m.from.email}`, "mail-unblock", { icon: "hand.raised.slash", data: { email: e } })] : []),
        ...((m.unsubscribe || "").trim() ? [mi("Unsubscribe", "mail-unsub", { icon: "envelope.badge.shield.half.filled", data: { id: m.id } })] : [])];
      return [...(innerWidth / F.zoomScale() < 380 ? [mi("Reply all", "mail-reply", { icon: "arrowshape.turn.up.left.2", data: { all: 1 } })] : []),
        ...junk, { divider: true },
        mi(m.flagged ? "Unflag" : "Flag", "mail-flag", { icon: "flag", data: { id: m.id } }),
        mi("Mark unread", "mail-unread", { icon: "envelope.badge" }),
        mi("Move to…", "mail-move", { icon: "folder", data: { id: m.id } }),
        mi("Make a task", "mail-task", { icon: "checklist", data: { id: m.id } }),
        ...(b?.html ? [mi(M.asText.has(m.id) ? "Show formatted" : "Show plain text", "mail-astext", { icon: "doc.plaintext" })] : [])];
    }
    if (key === "filter") {      // CommsView.moreMenu: Apple Mail's filter button + mailbox actions
      const showIcon = (o) => (M.show === o ? "checkmark" : o === "Unread only" ? "envelope.badge" : o === "Flagged only" ? "flag" : "tray.full");
      return [{ header: "Show" }, ...["All mail", "Unread only", "Flagged only"].map((o) => mi(o, "mail-show", { icon: showIcon(o), data: { value: o } })),
        { divider: true },
        mi("Mark all as read", "mail-mark-all-read", { icon: "envelope.open" }),
        mi("Select emails", "mail-select-on", { icon: "checkmark.circle" }),
        mi("Keyboard shortcuts", "mail-shortcuts", { icon: "keyboard" }),
        { divider: true },
        mi("Empty Junk…", "mail-empty", { icon: "xmark.bin", destructive: true, data: { role: "junk" } }),
        mi("Empty Trash…", "mail-empty", { icon: "trash", destructive: true, data: { role: "trash" } })];
    }
    if (key === "bulk-more") {   // bulkBar's "…" menu
      if (!M.picked.size) return [];
      return [mi(M.picked.size === 1 ? "Make a task" : `Make ${M.picked.size} tasks`, "mail-bulk-task", { icon: "checklist" }), { divider: true },
        mi("Mark unread", "mail-bulk-unread", { icon: "envelope.badge" }),
        mi("Flag", "mail-bulk-flag", { icon: "flag", data: { on: 1 } }),
        mi("Unflag", "mail-bulk-flag", { icon: "flag.slash", data: { on: 0 } }),
        ...(boxRole() === "junk" ? [] : [mi("Junk and block senders", "mail-bulk-junkblock", { icon: "hand.raised" })])];
    }
    if (key.startsWith("row:")) {
      const m = X.byId.get(key.slice(4)); if (!m) return [];
      const th = threadFor(X, m.id);            // like swipe: the whole conversation
      return [mi("Reply", "mail-row-reply", { data: { id: m.id } }), mi(th.some((x) => !x.seen) ? "Mark read" : "Mark unread", "mail-row-seen", { data: { id: m.id } }),
        mi(th.some((x) => x.flagged) ? "Unflag" : "Flag", "mail-row-flag", { data: { id: m.id } }), mi("Move…", "mail-move", { data: { id: m.id, thread: 1 } }),
        mi("Archive", "mail-row-archive", { data: { id: m.id } }), mi("Make a task", "mail-task", { icon: "checklist", data: { id: m.id, row: 1 } }), { divider: true },
        ...(isInJunk(m) ? [mi("Not Junk", "mail-row-notjunk", { icon: "tray.and.arrow.up", data: { id: m.id } })]
          : [mi("Mark as Junk", "mail-row-junk", { icon: "xmark.bin", data: { id: m.id } }), mi("Junk and block sender", "mail-row-junk", { icon: "hand.raised", data: { id: m.id, block: 1 } })]),
        ...((m.unsubscribe || "").trim() ? [mi("Unsubscribe", "mail-unsub", { icon: "envelope.badge.shield.half.filled", data: { id: m.id } })] : []),
        mi("Delete", "mail-row-delete", { destructive: true, data: { id: m.id } })];
    }
    return [];
  }

  // ------------------------------------------------------------ the stream (left column)
  function timeLabel(d) {
    const today = new Date();
    if (D.same(d, today)) return D.time(d);
    if (D.same(d, D.add(today, -1))) return "Yesterday";
    return D.md(d);
  }
  /** Sent box: who it went TO (CommsView.MessageRow.sent). */
  function sentTo(m) {
    const names = [...(m.to || []), ...(m.cc || [])].map((a) => a.name || a.email);
    return "To: " + (names.length ? names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "") : "(no recipient)");
  }
  function initials(m) {
    const first = boxRole() === "sent" && m.to?.[0] ? { name: m.to[0].name, email: m.to[0].email } : m.from;
    const parts = display(first).split(/[^\p{L}]+/u).filter(Boolean).slice(0, 2);
    return parts.map((p) => p[0]).join("").toUpperCase() || "?";
  }
  // account: a neutral tag; the account colour only as the 8px dot
  const accountTag = (a) => `<span class="tag acct"><i class="dot d8" style="background:${a.color}"></i>${esc(a.label)}</span>`;
  const pendingTag = () => ui.tag("Waiting for iPhone");

  function rowHTML(X, th, sel) {
    const m = th[0], a = account(X, m.accountID), unread = th.some((x) => !x.seen), picked = M.picked.has(m.id);
    const showAccount = !M.acct || !!M.query.trim();
    const open = M.swipe?.id === m.id ? "open-" + M.swipe.side : "";
    const sw = (act, label, ic, cls) => `<button type="button" class="sw ${cls}" data-act="${act}" data-id="${esc(m.id)}">${icon(ic)}<span>${esc(label)}</span></button>`;
    return `<div class="mrow-wrap ${sel || picked ? "sel" : ""} ${open}" data-id="${esc(m.id)}">
      <div class="swipe l">${sw("mail-row-seen", unread ? "Read" : "Unread", unread ? "envelope.open" : "envelope.badge", "action")}${sw("mail-row-archive", "Archive", "archivebox", "ink2")}</div>
      <div class="swipe r">${sw("mail-move", "Move", "folder", "ink2")}${sw("mail-row-flag", th.some((x) => x.flagged) ? "Unflag" : "Flag", "flag", "ink2")}${isInJunk(m) ? sw("mail-row-notjunk", "Not Junk", "tray.and.arrow.up", "action") : sw("mail-row-junk", "Junk", "xmark.bin", "ink2")}${sw("mail-row-delete", "Delete", "trash", "danger")}</div>
      <button type="button" class="mrow" data-act="mail-row" data-id="${esc(m.id)}" ${M.selecting ? `aria-pressed="${picked}"` : ""}
        aria-label="${esc(`${m.seen ? "" : "Unread. "}From ${display(m.from)}. ${m.subject}. ${timeLabel(m.date)}`)}">
        ${M.selecting ? `<span class="mpickcol" aria-hidden="true"></span><span class="pick ${picked ? "on" : ""}">${icon(picked ? "checkmark.circle.fill" : "circle")}</span>` : ""}
        <span class="av">${esc(initials(m))}</span>
        <span class="v g2 grow">
          <span class="h g8"><span class="from ell ${unread ? "w6" : ""}">${esc(boxRole() === "sent" ? sentTo(m) : display(m.from))}</span>
            ${th.length > 1 ? `<span class="cnt">${th.length}</span>` : ""}${m.flagged ? `<span class="flag">${icon("flag.fill")}</span>` : ""}
            <span class="sp"></span><span class="time nowrap">${esc(timeLabel(m.date))}</span>${unread ? '<i class="udot"></i>' : ""}</span>
          <span class="subj ${m.seen ? "ink2" : "ink"}">${esc(m.subject)}</span>
          ${(showAccount && a) || th.some((x) => x.pending) ? `<span class="flow g4">${showAccount && a ? accountTag(a) : ""}${th.some((x) => x.pending) ? pendingTag() : ""}</span>` : ""}
        </span>
      </button></div>`;
  }

  function listHTML(X) {
    const cur = current(X), ths = threads(cur), sel = selectedId();
    let h = "";
    // what the iPhone couldn't do (snapshot.failed) stays on top, wherever he is, until he dismisses it
    if (!M.query.trim()) {
      for (const f of X.failedOther.slice(-3)) h += `<div class="mfail h g8 top"><div class="grow">${ui.errorText(failText(f))}</div>${ui.btn({ label: "Dismiss", kind: "small", act: "mail-fail-dismiss", data: { id: f.id } })}</div>`;
      for (const f of X.failedSends) h += `<div class="mcard attention-edge v g8"><div class="h g8">${icon("exclamationmark.triangle.fill", 'class="mwarn"')}${ui.label2("Not sent", "c-attention")}<span class="sp"></span><span class="t12 muted">${esc(account(X, f.send?.accountID)?.label || "")}</span></div>
        <p class="t15 w5 ell">To: ${esc(f.to)}</p><p class="t15 ink2 ell">${esc(f.subject || "(no subject)")}</p><p class="t13 c-attention">${esc(f.msg)}</p>
        ${ui.actbar([ui.btn({ label: "Dismiss", kind: "small", act: "mail-fail-dismiss", data: { id: f.id } }), f.send?.body != null ? ui.btn({ label: "Edit and try again", kind: "small", cls: "tinted", act: "mail-retry", data: { id: f.id } }) : ""])}</div>`;
    }
    if (M.folder === "INBOX" && !M.query.trim()) {
      for (const c of X.sending) h += `<div class="mcard v g8"><div class="h g8">${ui.spinner()}${ui.label2("Sending from your iPhone…")}<span class="sp"></span><span class="t12 muted">${esc(account(X, c.accountID)?.label || "")}</span></div>
        <p class="t15 w5 ell">To: ${esc(c.to)}</p><p class="t15 ink2 ell">${esc(c.subject)}</p></div>`;
      for (const d of X.drafts) h += `<div class="mcard v g8 ${d.byFriday ? "friday" : ""}"><div class="h g8">${d.byFriday ? ui.fmark(18) : ""}${ui.label2(d.byFriday ? "Friday's draft · not sent" : "Draft · not sent", d.byFriday ? "friday" : "")}<span class="sp"></span><span class="t12 muted">${esc(account(X, d.accountID)?.label || "")}</span></div>
        <p class="t15 w5 ell">To: ${esc(d.to)}</p><p class="t15 ink2 ell">${esc(d.subject)}</p>
        ${ui.actbar([ui.btn({ label: "Discard", kind: "small", act: "mail-draft-discard", data: { id: d.id }, aria: `Discard the draft ${d.subject || ""}` }), ui.btn({ label: "Review & send", kind: "small", cls: "tinted", act: "mail-draft-open", data: { id: d.id } })])}</div>`;
      if (M.lane !== "Priority") h += junkHelperHTML(X);
    }
    if (!M.query.trim() && (boxRole() === "junk" || boxRole() === "trash")) h += boxCardHTML(X, boxRole(), cur.length);
    h += ths.map((th) => rowHTML(X, th, th[0].id === sel)).join("");
    if (!cur.length) {
      const q = M.query.trim();
      const asked = boxRole() ? X.accounts.some((a) => { const f = X.roleName(a.id, boxRole()); return f && X.askedFolder.has(a.id + "|" + f); })
        : M.acct && X.askedFolder.has(M.acct + "|" + M.folder);
      const t = q ? `No mail matches “${q}”.`
        : asked ? `Asking your iPhone for ${folderTitle(X)}… It will show here once your iPhone fetches it.`
        : M.lane === "Priority" && M.folder === "INBOX" ? "Nothing from people waiting. Tap All to see everything."
        : M.lane === "Updates" && M.folder === "INBOX" ? "No newsletters or updates right now."
        : boxRole() === "junk" ? "No junk right now."
        : boxRole() === "trash" ? "Trash is empty."
        : `No emails in ${folderTitle(X)}.`;
      h += `<p class="mempty t13 muted ${asked && !q ? "h g8" : ""}">${asked && !q ? ui.spinner() : ""}<span>${esc(t)}</span></p>`;
    }
    return h;
  }

  /** Top of Junk and Trash (CommsView.boxCard): a visible Empty button; Junk adds the shield (JunkShieldCard):
   *  what was kept out of the inbox (mailJunkTally, real counts) and how far Friday's filter has learned (mailJunkFilter). */
  function boxCardHTML(X, role, n) {
    const a = account(X, M.acct);
    const empty = n ? ui.btn({ label: `Empty ${BOX[role]}`, kind: "destructive", act: "mail-empty", data: { role } }) : "";
    if (role === "trash") {
      if (!n) return "";
      return `<div class="mcard v g8 sec-mail"><div class="h g8">${ui.label2("Trash")}<span class="sp"></span><span class="t12 muted">${n} email${n === 1 ? "" : "s"}</span></div>
        <p class="t15 ink2">Emptying deletes these for good on the server${a ? ` for ${esc(a.label)}` : ", in every account"}.</p>${ui.actbar([empty])}</div>`;
    }
    const t = X.lists.tally || {}, days = t.days || {}, f = X.lists.filter || {};
    const cut = new Date(); cut.setHours(0, 0, 0, 0); cut.setDate(cut.getDate() - 6);
    let ws = 0, wf = 0, as = 0, af = 0;
    for (const [k, d] of Object.entries(days)) {
      const [y, mo, da] = k.split("-").map(Number), dt = new Date(y, mo - 1, da);
      as += d.service || 0; af += d.friday || 0;
      if (dt >= cut) { ws += d.service || 0; wf += d.friday || 0; }
    }
    const since = t.since ? new Date(t.since * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "today";
    const nS = f.nSpam || 0, nH = f.nHam || 0, ready = nS >= 15 && nH >= 25;
    const learn = ready ? "Friday's filter is on: it moves junk it's sure about, never mail from people you've written to. It keeps learning from every Junk and Not Junk you tap."
      : `Friday's filter is learning: ${nS} junk and ${nH} real emails so far. It starts moving junk on its own after 15 and 25. Tap Junk or Not Junk to teach it.`;
    return `<div class="mcard v g8 sec-mail jshield"><div class="h g8">${ui.label2("Junk shield")}<span class="sp"></span><span class="t12 muted">Since ${esc(since)}</span></div>
      <p class="h g8 base"><span class="t-stat ink tnum">${ws + wf}</span><span class="t15 ink2">kept out of your inbox this week</span></p>
      <p class="flow g12 t13 ink2"><span class="h g4"><i class="dot d8" style="background:var(--sec)"></i><b class="ink tnum">${as}</b> by your mail services</span>
        <span class="h g4"><i class="dot d8" style="background:var(--action)"></i><b class="ink tnum">${af}</b> by Friday</span></p>
      <p class="t13 muted">${esc(learn)}</p>
      ${ui.actbar([ui.btn({ label: "Blocked senders", act: "mail-subs" }), empty])}</div>`;
  }

  /** Top of Updates / All / Junk: the mailing lists he never opens (a suggestion, nothing pre-picked), and the way in to manage them. */
  function junkHelperHTML(X) {
    const sugg = junkSuggestions(X);
    if (sugg.length) {
      return `<div class="mcard v g8">${ui.label2("Clean up")}
        <p class="t15 w6 ink">${sugg.length} mailing list${sugg.length === 1 ? "" : "s"} you never open</p>
        <p class="t13 muted mclamp2">${esc(sugg.slice(0, 3).map((s) => s.name).join(", ") + (sugg.length > 3 ? " and more" : ""))}</p>
        ${ui.actbar([ui.btn({ label: "Review and unsubscribe", kind: "small", cls: "tinted", act: "mail-subs" })])}</div>`;
    }
    if (M.lane !== "All") return `<div class="mjlink">${ui.btn({ label: "Unsubscribe & block", icon: "envelope.badge.shield.half.filled", kind: "link", act: "mail-subs" })}</div>`;
    return "";
  }

  function bulkBar(X) {
    const all = threads(current(X)).map((t) => t[0].id), n = M.picked.size, none = !n;
    // grid-snap: a full-width count row, then ONE row of equal columns, all the same button style (Delete in red)
    return `<div class="bulk v g8"><div class="h bulk-top"><span class="t13 w6 ink tnum bcount">${n} selected</span><span class="sp"></span>
        <button type="button" class="btn link t13" style="min-height:24px;padding:0" data-act="mail-pick-all">${n === all.length && n ? "Select none" : "Select all"}</button></div>
      <div class="bulk-row">
      ${ui.btn({ label: "Read", icon: "envelope.open", kind: "small", act: "mail-bulk-read", disabled: none })}
      ${ui.btn({ label: "Move", icon: "folder", kind: "small", act: "mail-bulk-move", disabled: none })}
      ${ui.btn({ label: "Archive", icon: "archivebox", kind: "small", act: "mail-bulk-archive", disabled: none })}
      ${boxRole() === "junk" ? ui.btn({ label: "Not Junk", icon: "tray.and.arrow.up", kind: "small", act: "mail-bulk-notjunk", disabled: none })
        : ui.btn({ label: "Junk", icon: "xmark.bin", kind: "small", act: "mail-bulk-junk", disabled: none })}
      <button type="button" class="btn small mbmore" data-act="mail-menu" data-menu="bulk-more" aria-haspopup="menu" aria-expanded="${M.menu === "bulk-more"}" aria-label="More actions for the selected emails" ${none ? "disabled" : ""}>${icon("ellipsis.circle")}</button>
      ${ui.btn({ label: "Delete", icon: "trash", kind: "destructive", cls: "small", act: "mail-bulk-delete", disabled: none })}</div></div>`;
  }

  function streamHTML(X) {
    const unread = X ? inboxOf(X).filter((m) => !m.seen).length : 0;
    const hasAccounts = X && X.accounts.length;
    // icon buttons sit beside the title; labelled buttons make the 2-column row under it (grid-snap)
    const boxN = X && boxRole() ? current(X).length : 0;
    const head = (extraTool = "") => ui.header({ eyebrow: ui.label2(boxRole() ? `${boxN} email${boxN === 1 ? "" : "s"}` : `${unread} unread`), title: X ? folderTitle(X) : "Mail",
      tools: ui.btn({ icon: "gearshape", kind: "icon", filled: true, act: "mail-settings", aria: "Settings: email accounts and signature" })
        + F.syncButton() + extraTool
        // phones: Compose as a 44 px icon here too, so the labelled row (Select · Compose) can step aside; Select stays in the filter menu
        + (hasAccounts ? ui.btn({ icon: "square.and.pencil", kind: "icon", cls: "primary-ic m-ph-compose", act: "mail-compose", aria: "Compose a new email", title: "Compose" }) : ""),
      actions: (hasAccounts ? ui.btn({ label: M.selecting ? "Done" : "Select", act: "mail-select" }) : "")
        + ui.btn({ label: "Compose", icon: "square.and.pencil", kind: "primary", act: "mail-compose", aria: "Compose a new email" }) });
    const header = head();
    if (!hasAccounts) {
      return `<div class="mhead">${header}</div><div class="mnone v g16">
        <canvas class="mcore" data-core width="140" height="140" style="width:140px;height:140px"></canvas>
        <h2 class="t24 w6 ink">${X ? "No email connected yet" : "No email from your iPhone yet"}</h2>
        <p class="t15 ink2">${X ? "Connect iCloud, Gmail or your Bluehost mailbox on your iPhone and F.R.I.D.A.Y. can read, sort, draft and send for you."
          : (F.snap() && !F.snap().access) ? "Your iPhone has just been updated. Open F.R.I.D.A.Y. on your iPhone once; it sends your recent email here a minute later, and anything you do here is carried out by your iPhone."
          : "Open F.R.I.D.A.Y. on your iPhone; it sends your recent email here a minute later, and anything you do here is carried out by your iPhone."}</p>
        ${ui.actbar([ui.btn({ label: "Email settings", icon: "gearshape", act: "mail-settings" })], false, "center")}</div>`;
    }
    const a = account(X, M.acct);
    const acctLabel = `<span class="h g4">${(a ? [a] : X.accounts).map((x) => `<i class="dot d8" style="background:${x.color}"></i>`).join("")}</span><span class="ell">${esc(a?.label || "All accounts")}</span>${icon("chevron.down", 'class="cd"')}`;
    const boxTitle = M.folder === "INBOX" ? "Inbox" : folderTitle(X);
    const chan = `${icon(boxRole() ? roleIcon(boxRole()) : M.folder === "INBOX" ? "tray" : "folder")}<span class="ell">${esc(boxTitle)}</span>${icon("chevron.down", 'class="cd"')}`;
    const filtered = M.show !== "All mail";
    const filterTrigger = trigger("filter", `${icon(filtered ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease")}${filtered ? `<span class="ell">${M.show === "Unread only" ? "Unread" : "Flagged"}</span>` : ""}`,
      "mfilter", "Filter and mailbox actions" + (filtered ? `: showing ${M.show.toLowerCase()}` : ""));
    const controls = `<div class="mctl v g8">
      ${ui.search("mail-q", "Search all mail", M.query, "mail-q")}
      ${M.folder === "INBOX" && !M.query.trim() ? ui.seg("mail-lane", ["Priority", "Updates", "All"], M.lane) : ""}
      <div class="flow">${trigger("acct", acctLabel, "", `Account: ${a?.label || "All accounts"}`)}<span class="mpair">${trigger("boxes", chan, "", `Mailbox: ${boxTitle}. Inbox, Sent, Junk, Trash and folders`)}</span></div></div>`;
    return `<div class="mhead ${M.selecting ? "selecting" : ""}">${head(filterTrigger)}</div>${controls}<div class="mlist" id="mail-list">${listHTML(X)}</div>${M.selecting ? bulkBar(X) : ""}`;
  }

  // ------------------------------------------------------------ one email (MessageView)
  /** "//cdn.example.com/logo.png" has no website to borrow "https:" from here, so give it one. */
  const fixLinks = (h) => h.replace(/((?:src|srcset|background|href)\s*=\s*["']?\s*)\/\//gi, "$1https://").replace(/(url\(\s*["']?\s*)\/\//gi, "$1https://");
  /** EmailWebView.page(): scripts never run; remote images stay blocked until "Load images"; links open in a new tab. */
  function page(html, text, loadImages) {
    const remote = loadImages ? " https: http:" : "";
    const csp = `default-src 'none'; img-src data: cid:${remote}; style-src 'unsafe-inline'${remote}; font-src data:${remote}; media-src 'none'`;
    const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#171A1F;color-scheme:light only;-webkit-text-size-adjust:100%}
  body{padding:14px;font:16px -apple-system,Helvetica,Arial,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}
  img{max-width:100%!important;height:auto!important}
  table{max-width:100%!important}
  pre{white-space:pre-wrap;font:16px -apple-system,Helvetica,Arial,sans-serif;margin:0}
  a{color:#2F56C8}
</style>` + (loadImages ? "" : `<style>img[src^="http" i],img[src^="//"]{visibility:hidden}</style>`);
    if (html) {
      // the first copy of an attribute wins, so ours opens every link in a new tab without the sender's page knowing who we are
      const h = fixLinks(html).replace(/<a(?=[\s>])/gi, '<a target="_blank" rel="noopener noreferrer"');
      const r = /<head[^>]*>/i.exec(h);
      if (r) return h.slice(0, r.index + r[0].length) + head + h.slice(r.index + r[0].length);
      return `<html><head>${head}</head><body>${h}</body></html>`;
    }
    return `<html><head>${head}</head><body><pre>${esc(text)}</pre></body></html>`;
  }

  /** UnsubscribeBanner: "This message is from a mailing list. Unsubscribe", like Apple Mail. */
  function unsubscribeBanner(X, m) {
    if (!(m.unsubscribe || "").trim()) return "";
    const d = unsubscribedOn(X, m.from.email);
    if (!d && pageOpened(X, m.from.email)) {
      const plan = unsubscribePlan(m);
      return `<div class="munsub v g8"><div class="h g8">${icon("envelope.badge.shield.half.filled", 'class="mu-ic"')}<span class="t13 ink2 grow">You opened their unsubscribe page — finished there?</span></div>
        <div class="h g8 mu-acts">${ui.btn({ label: "Yes, done", kind: "small", act: "mail-unsub-done", data: { email: m.from.email.toLowerCase() } })}
          ${plan.kind === "page" ? ui.btn({ label: "Open it again", icon: "arrow.up.right.square", kind: "small", act: "mail-unsub-page", data: { id: m.id } }) : ""}</div></div>`;
    }
    return `<div class="munsub h g8">${icon("envelope.badge.shield.half.filled", 'class="mu-ic"')}
      ${d ? `<span class="t13 ink2 grow">You unsubscribed ${esc(D.md(d))}. It can take a few days for their mail to stop.</span>`
        : `<span class="t13 ink2 grow">This message is from a mailing list.</span>${ui.btn({ label: "Unsubscribe", kind: "small", act: "mail-unsub", data: { id: m.id } })}`}</div>`;
  }

  /** EM-19: asked the iPhone for this body and nothing came in 45 s (or the iPhone said it couldn't). */
  function bodyWait(X, id) {
    const f = X.bodyFailed[id];
    if (f) return { failed: true, why: f.msg, ids: [f.id] };
    const at = Math.max(X.askedBody.get(id) || 0, M.bodyAt[id] || 0);
    if (!at) return { failed: false, left: 0 };
    const left = BODY_WAIT - (F.nowSec() - at);
    return left <= 0 ? { failed: true, why: "" } : { failed: false, left };
  }
  function messageHTML(X, m) {
    const a = account(X, m.accountID), b = X.bodies[m.id], asked = X.askedBody.has(m.id) || M.askedBody.has(m.id);
    const wait = bodyWait(X, m.id);
    const narrow = innerWidth / F.zoomScale() < 380;   // the width the page really has under the text-size dial
    const tile = (label, ic, act, extra = {}) => `<button type="button" class="tile ${extra.destructive ? "destructive" : ""}" data-act="${act}" ${extra.data ? Object.entries(extra.data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ") : ""} aria-label="${esc(extra.aria || label)}" ${extra.menu ? `data-menu="more" aria-haspopup="menu" aria-expanded="${M.menu === "more"}"` : ""}>${extra.inner || icon(ic)}<span>${esc(label)}</span></button>`;
    const actions = `<div class="tiles">${tile("Reply", "arrowshape.turn.up.left", "mail-reply")}${narrow ? "" : tile("Reply all", "arrowshape.turn.up.left.2", "mail-reply", { data: { all: 1 } })}
      ${tile("Forward", "arrowshape.turn.up.right", "mail-forward")}${tile("Archive", "archivebox", "mail-archive")}${tile("Delete", "trash", "mail-delete", { destructive: true })}
      ${tile("More", "ellipsis.circle", "mail-menu", { menu: true, aria: "More actions" })}</div>`;
    const meta = (k, v) => `<div class="meta"><span class="k">${k}</span><span class="v2">${esc(v)}</span></div>`;
    const convo = threadOf(X, m);
    const convoHTML = convo.length > 1 ? `<div class="card edge p16 v g8">${ui.label2(`${convo.length} messages in this conversation`)}
      ${convo.map((c) => `<button type="button" class="convo h g8" data-act="mail-open-id" data-id="${esc(c.id)}" ${c.id === m.id ? "disabled" : ""}><i class="convo-dot ${c.id === m.id ? "on" : ""}"></i>
        <span class="ell t15 ${c.id === m.id ? "w6" : ""}">${esc(display(c.from))}</span><span class="sp"></span><span class="t12 muted nowrap">${esc(D.md(c.date) + ", " + D.time(c.date))}</span></button>`).join("")}</div>` : "";
    let bodyHTML;
    if (b) {
      const src = page(M.asText.has(m.id) ? null : b.html, b.text ? b.text : "(This message has no text.)", true);
      const partial = !b.partial ? "" : asked && wait.failed
        ? `<div class="mbodyfail h g8">${ui.errorText("Couldn't get the rest of this email from your iPhone" + (wait.why ? ": " + wait.why : "."))}${ui.btn({ label: "Try again", kind: "small", act: "mail-full" })}</div>`
        : `<p class="t12 muted h g8">${asked ? ui.spinner() : ""}<span>${asked ? "Showing the start of this email. The rest will appear once your iPhone downloads it." : "Showing the start of this email."}</span>${asked ? "" : `<button type="button" class="btn link t12" style="min-height:32px" data-act="mail-full">Get the whole email</button>`}</p>`;
      bodyHTML = `${partial}
        <iframe class="mbody" title="Email from ${esc(display(m.from))}" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" srcdoc="${esc(src)}"></iframe>`;
    } else {
      bodyHTML = wait.failed
        ? `<div class="mwait mbodyfail v g8"><p class="t15 w6 ink">Couldn't get this email from your iPhone</p>
            <p class="t13 muted">${esc(wait.why || "Your iPhone didn't send it. Open F.R.I.D.A.Y. on your iPhone so it can sync, then try again.")}</p>
            <div>${ui.btn({ label: "Try again", kind: "primary", act: "mail-full" })}</div></div>`
        : `<div class="mwait h g8">${ui.spinner()}<span class="t15 muted">${asked ? "Asking your iPhone for this email… It will appear here once your iPhone downloads it." : "Opening message…"}</span></div>`;
    }
    return `<div class="mview">
      <div class="h g8 mtop">${ui.btn({ label: "Mail", icon: "chevron.left", act: "mail-close" })}<span class="sp"></span>${m.pending ? pendingTag() : ""}${a ? accountTag(a) : ""}</div>
      <div class="mact">${actions}</div>
      <div class="mhdr v g8">
        <h2 class="t20 w6 ink wrap msubj">${esc(m.subject)}</h2>
        ${meta("From", formatAddress(m.from))}${meta("To", m.to.map(display).join(", "))}${m.cc.length ? meta("Cc", m.cc.map(display).join(", ")) : ""}
        ${meta("Date", `${m.date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${D.time(m.date)}`)}
        ${unsubscribeBanner(X, m)}
        ${b?.attachments?.length ? `<div class="atts" title="Attachments stay on your iPhone">${b.attachments.map((n) => `<span class="att">${icon("paperclip")}<span class="ell">${esc(n)}</span></span>`).join("")}</div>` : ""}
        ${convoHTML}
      </div>
      <div class="mbodywrap">${bodyHTML}</div></div>`;
  }

  // ------------------------------------------------------------ the screen
  F.view("mail", {
    render() {
      const X = model();
      const selId = selectedId();
      const m = X && selId ? X.byId.get(selId) : null;
      const menu = X && M.menu ? menuItems(X, M.menu) : [];
      const menuEl = menu.length ? `<div class="mmenu" role="menu" data-for="${esc(M.menu)}">${menuHTML(menu)}</div>` : "";
      if (wide()) {
        const pane = m ? messageHTML(X, m)
          : `<div class="mplace v g16">${selId && X ? `<p class="t15 muted">That email isn't here anymore.</p>` : `<canvas data-core width="120" height="120" style="width:120px;height:120px"></canvas><p class="t15 muted">Select a message</p>`}</div>`;
        return `<div class="split msplit"><div class="split-col mcol" id="mail-col">${streamHTML(X)}</div><div class="split-col mpane" id="mail-pane">${pane}</div></div>${menuEl}`;
      }
      if (selId && X) return (m ? messageHTML(X, m) : `<div class="mview"><div class="h g8 mtop">${ui.btn({ label: "Mail", icon: "chevron.left", act: "mail-close" })}</div><p class="t15 muted px16">That email isn't here anymore.</p></div>`) + menuEl;
      return `<div class="mstream">${streamHTML(X)}</div>${menuEl}`;
    },
    after(root) {
      for (const c of root.querySelectorAll("canvas[data-core]")) F.core(c, { compact: true, mode: "idle" });
      const col = root.querySelector("#mail-col"), pane = root.querySelector("#mail-pane");
      if (col) { col.scrollTop = M.listTop; col.addEventListener("scroll", () => { M.listTop = col.scrollTop; closeMenuOnScroll(); }, { passive: true }); }
      if (pane) {
        const sid = selectedId();
        pane.scrollTop = M.paneFor === sid ? M.paneTop : 0; M.paneFor = sid;
        pane.addEventListener("scroll", () => { M.paneTop = pane.scrollTop; closeMenuOnScroll(); }, { passive: true });
      }
      placeMenu(root);
      if (M.scrollTo) { root.querySelector(`#mail-list .mrow-wrap[data-id="${CSS.escape(M.scrollTo)}"]`)?.scrollIntoView({ block: "nearest" }); M.scrollTo = null; }
      // opening a message marks it read and asks the iPhone for its body if it isn't here yet
      const X = model(), id = selectedId(), m = X && id ? X.byId.get(id) : null;
      if (m) {
        const list = [];
        if (!m.seen && !M.autoSeen.has(id)) { M.autoSeen.add(id); list.push(["mail_seen", { ...one(m), on: true }]); }
        if (!X.bodies[id] && !X.askedBody.has(id) && !M.askedBody.has(id)) { M.askedBody.add(id); M.bodyAt[id] = F.nowSec(); list.push(["mail_body", one(m)]); }
        if (list.length) quietly(send(list));
        // still waiting for the body: look again when the 45 s are up so "Couldn't get this email" shows on time
        const w = bodyWait(X, id);
        clearTimeout(M.bodyTimer);
        if ((!X.bodies[id] || (X.bodies[id].partial && (X.askedBody.has(id) || M.askedBody.has(id)))) && !w.failed && w.left > 0)
          M.bodyTimer = setTimeout(() => { if (F.S.tab === "mail" && selectedId() === id) F.render(); }, w.left * 1000 + 250);
      }
    },
  });

  function placeMenu(root) {
    const el = root.querySelector(".mmenu"); if (!el) return;
    let r;
    if (M.menu.startsWith("row:") && M.menuAt) r = { left: M.menuAt.x, right: M.menuAt.x, top: M.menuAt.y, bottom: M.menuAt.y };
    else { const t = root.querySelector(`[data-menu="${CSS.escape(M.menu)}"]:not(.mmenu)`); if (!t) return; r = t.getBoundingClientRect(); }
    // measured in screen pixels; written back in CSS pixels (the text-size zoom scales both)
    const z = F.zoomScale(), w = el.offsetWidth * z, sh = el.scrollHeight * z, vh = innerHeight, vw = innerWidth;
    const tabbar = document.querySelector(".tabbar")?.getBoundingClientRect().top || vh;
    const below = tabbar - r.bottom - 8, above = r.top - 8;
    const h = Math.min(sh, Math.max(below, above));
    el.style.maxHeight = (h + 2) / z + "px";
    el.style.top = (below >= Math.min(sh, 240) || below >= above ? r.bottom + 4 : r.top - 4 - h) / z + "px";
    const alignRight = M.menu === "more";
    let left = alignRight ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    el.style.left = left / z + "px";
    el.querySelector("[role=menuitem]")?.focus({ preventScroll: true });
  }
  function closeMenuOnScroll() { if (M.menu) { M.menu = null; F.render(); } }

  // close menus / swipes on outside click, Escape
  document.addEventListener("click", (e) => {
    if (M.menu && !e.target.closest?.(".mmenu,[data-act='mail-menu']")) { M.menu = null; F.render(); }
    else if (M.swipe && !e.target.closest?.(".swipe,.mrow")) { M.swipe = null; F.render(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && M.menu && !document.querySelector("dialog[open]")) { e.preventDefault(); const k = M.menu; M.menu = null; F.render(); F.$(`[data-menu="${CSS.escape(k)}"]`)?.focus(); }
  });
  let lastWide = wide();
  addEventListener("resize", () => { if (wide() !== lastWide) { lastWide = wide(); if (F.S.tab === "mail") F.render(); } else if (M.menu) closeMenuOnScroll(); });

  // ------------------------------------------------------------ swipe actions (touch) · long press = select mode · finger sweep down the check column · right click = context menu
  let drag = null, sweep = null, suppressClick = false;
  const OPEN = { l: 148, r: 296 };
  const holdClick = (ms) => { suppressClick = true; setTimeout(() => (suppressClick = false), ms); };
  /** Long press (like iPhone Mail's list): select mode with this row picked; then taps toggle and a sweep picks a run. */
  function longPress(id) { M.swipe = null; M.menu = null; M.selecting = true; M.picked = new Set([id]); setAnchor(id); holdClick(700); F.render(); }
  document.addEventListener("pointerdown", (e) => {
    const row = e.target.closest?.("#mail-list .mrow");
    if (!row) return;
    if (M.selecting) {
      if (e.button > 0 || e.shiftKey || e.metaKey || e.ctrlKey) return;
      const r = row.getBoundingClientRect();
      if (e.target.closest(".mpickcol,.pick") || e.clientX - r.left < 56) startSweep(row.dataset.id, e);
      return;
    }
    if (e.pointerType === "mouse") return;
    const wrap = row.parentElement, base = M.swipe?.id === row.dataset.id ? (M.swipe.side === "l" ? OPEN.l : -OPEN.r) : 0;
    drag = { row, wrap, id: row.dataset.id, x0: e.clientX, y0: e.clientY, base, dx: base, on: false, pid: e.pointerId };
    drag.lp = setTimeout(() => { if (drag && !drag.on) { const d = drag; drag = null; longPress(d.id); } }, 550);
  });
  // shift-click shouldn't select page text
  document.addEventListener("mousedown", (e) => { if (e.shiftKey && e.target.closest?.("#mail-list .mrow")) e.preventDefault(); });

  /** Sweep: the first row decides (pick or un-pick); every row between it and the finger follows. Painted in place so the gesture never loses its element. */
  function startSweep(id, e) {
    const X = model(); if (!X) return;
    const list = visibleIds(X), i = list.indexOf(id); if (i < 0) return;
    sweep = { pid: e.pointerId, list, start: i, last: i, base: new Set(M.picked), on: !M.picked.has(id) };
    suppressClick = true;
    applySweep();
  }
  function applySweep() {
    const s = sweep, a = Math.min(s.start, s.last), b = Math.max(s.start, s.last), p = new Set(s.base);
    for (const id of s.list.slice(a, b + 1)) { if (s.on) p.add(id); else p.delete(id); }
    M.picked = p; M.anchor = s.list[s.start]; M.cursor = s.list[s.last]; M.base = s.base;
    paintPicks();
  }
  function paintPicks() {
    const sel = selectedId();
    for (const w of document.querySelectorAll("#mail-list .mrow-wrap")) {
      const on = M.picked.has(w.dataset.id), p = w.querySelector(".pick");
      w.classList.toggle("sel", on || w.dataset.id === sel);
      w.querySelector(".mrow")?.setAttribute("aria-pressed", String(on));
      if (p && p.classList.contains("on") !== on) { p.classList.toggle("on", on); p.innerHTML = icon(on ? "checkmark.circle.fill" : "circle"); }
    }
    const n = document.querySelector(".bulk .bcount"); if (n) n.textContent = `${M.picked.size} selected`;
  }
  document.addEventListener("pointermove", (e) => {
    if (sweep && e.pointerId === sweep.pid) {
      e.preventDefault();
      const w = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("#mail-list .mrow-wrap");
      const i = w ? sweep.list.indexOf(w.dataset.id) : -1;
      if (i >= 0 && i !== sweep.last) { sweep.last = i; applySweep(); }
      // near the top or bottom edge of the list, keep scrolling so a long sweep can reach rows off screen
      const sc = document.getElementById("mail-col") || document.getElementById("screen");
      if (sc) { const r = sc.getBoundingClientRect(); if (e.clientY > r.bottom - 48) sc.scrollTop += 12; else if (e.clientY < r.top + 48) sc.scrollTop -= 12; }
      return;
    }
    if (!drag || e.pointerId !== drag.pid) return;
    const mx = e.clientX - drag.x0, my = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { drag.on = true; clearTimeout(drag.lp); try { drag.row.setPointerCapture(e.pointerId); } catch {} drag.wrap.classList.add("dragging"); }
      else if (Math.abs(my) > 8) { clearTimeout(drag.lp); drag = null; return; }
      else return;
    }
    const W = drag.wrap.clientWidth;
    drag.dx = Math.max(-W, Math.min(W, drag.base + mx));
    drag.wrap.dataset.dir = drag.dx > 0 ? "l" : "r";
    drag.row.style.transform = `translateX(${drag.dx}px)`;
  });
  const endDrag = async (e) => {
    if (sweep && e && e.pointerId === sweep.pid) { sweep = null; holdClick(400); F.render(); return; }
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    clearTimeout(drag.lp);
    const d = drag; drag = null;
    if (!d.on) return;
    suppressClick = true; setTimeout(() => (suppressClick = false), 400);
    const W = d.wrap.clientWidth, X = model(), m = X?.byId.get(d.id);
    d.row.style.transform = ""; d.wrap.classList.remove("dragging");
    if (!m) return;
    const th = threads(current(X)).find((t) => t[0].id === d.id) || [m];
    if (d.dx > W * 0.6) { M.swipe = null; await quietly(setSeen(th, th.some((x) => !x.seen))); return; }            // full swipe right = Read/Unread
    if (d.dx < -W * 0.6) { M.swipe = null; await deleteThread(X, th).catch(() => {}); return; }    // full swipe left = Delete
    M.swipe = d.dx > 60 ? { id: d.id, side: "l" } : d.dx < -60 ? { id: d.id, side: "r" } : null;
    F.render();
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  document.addEventListener("click", (e) => { if (suppressClick && e.target.closest?.("#mail-list")) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
  document.addEventListener("contextmenu", (e) => {
    const row = e.target.closest?.("#mail-list .mrow");
    if (!row) return;
    if (sweep) { e.preventDefault(); return; }
    // Android fires contextmenu for a finger long press: that's select mode, same as our own timer
    if (drag && !drag.on && drag.id === row.dataset.id) { e.preventDefault(); clearTimeout(drag.lp); const id = drag.id; drag = null; longPress(id); return; }
    if (M.selecting) return;
    e.preventDefault();
    let { clientX: x, clientY: y } = e;
    if (!x && !y) { const r = row.getBoundingClientRect(); x = r.left + 24; y = r.bottom; }
    openRowMenu(row.dataset.id, x, y);
  });
  function openRowMenu(id, x, y) { M.swipe = null; M.menu = "row:" + id; M.menuAt = { x, y }; F.render(); }

  // ------------------------------------------------------------ actions: stream
  const X0 = () => model();
  const threadFor = (X, id) => threads(current(X)).find((t) => t[0].id === id) || [X.byId.get(id)].filter(Boolean);

  F.on("mail-menu", (el) => { const k = el.dataset.menu; M.swipe = null; M.menu = M.menu === k ? null : k; F.render(); });
  F.on("mail-settings", () => { if (F.openSettings) F.openSettings("mail"); else F.toast("Email accounts and your signature are set up in F.R.I.D.A.Y. on your iPhone."); });
  F.on("mail-select", () => { if (M.selecting) endSelect(); else { M.picked.clear(); startSelecting(); } F.render(); });
  F.on("mail-compose", () => {
    const X = X0(), a = M.acct || X?.accounts[0]?.id;
    if (!a) { F.toast("Sign in to your email in F.R.I.D.A.Y. on your iPhone first."); return; }
    openCompose({ accountID: a, to: "", subject: "", body: "" });
  });
  F.onInput("mail-q", (el) => {
    const was = !!M.query.trim(); M.query = el.value;
    if (was !== !!M.query.trim()) return F.render();
    const X = X0(), list = document.getElementById("mail-list");
    if (X && list) list.innerHTML = listHTML(X);
  });
  F.on("mail-lane", (el) => { M.lane = el.dataset.value; F.render(); });
  F.on("mail-acct", (el) => { M.acct = el.dataset.id || null; if (!boxRole()) M.folder = "INBOX"; M.menu = null; M.picked.clear(); F.render(); });
  /** A box for every account (Sent / Junk / Trash): asks his iPhone/Mac for each account's folder it hasn't sent yet. */
  F.on("mail-box", (el) => {
    const X = X0(); M.folder = el.dataset.box; M.menu = null; M.picked.clear(); F.render();
    const r = boxRole(); if (!r || !X) return;
    const ask = X.accounts.map((a) => [a.id, X.roleName(a.id, r)]).filter(([id, f]) => f && !X.askedFolder.has(id + "|" + f));
    if (ask.length) quietly(send(ask.map(([accountID, folder]) => ["mail_folder", { accountID, folder }])));
  });
  F.on("mail-folder", (el) => { const X = X0(); M.menu = null; if (el.dataset.folder === "INBOX") { M.acct = el.dataset.acct; M.folder = "INBOX"; F.render(); } else openFolder(X, el.dataset.acct, el.dataset.folder); });
  F.on("mail-new-folder", async (el) => {
    const X = X0(), a = account(X, el.dataset.acct); M.menu = null; F.render();
    const r = await F.alert({ title: "New folder", message: `In ${a?.label || ""}`, input: { placeholder: "Folder name" }, buttons: [{ label: "Create", value: true }, { label: "Cancel", kind: "cancel" }] });
    const n = r?.text?.trim(); if (!n) return;
    await send([["mail_create_folder", { accountID: a.id, name: n }]], `Your iPhone will create the folder ${n}`);
  });
  // ------------------------------------------------------------ picking emails like a desktop mail client
  /** Ranges start here; base = what was already picked, kept when the range grows or shrinks. */
  function setAnchor(id) { M.anchor = id; M.cursor = id; M.base = new Set(M.picked); }
  function startSelecting() { if (!M.selecting) { M.selecting = true; M.swipe = null; } }
  /** Cmd-click (Mac) / Ctrl-click (Windows): this row in or out. The open email joins the first pick, like Mail. */
  function togglePick(X, id) {
    const list = visibleIds(X), open = selectedId();
    if (!M.picked.size && open && open !== id && list.includes(open)) M.picked.add(open);
    startSelecting();
    if (M.picked.has(id)) M.picked.delete(id); else M.picked.add(id);
    setAnchor(id);
  }
  /** Shift-click / Shift+arrow: everything from the anchor to this row (plus what was picked before). */
  function pickRange(X, id) {
    const list = visibleIds(X);
    if (!M.anchor || !list.includes(M.anchor)) { const open = selectedId(); setAnchor(list.includes(open) ? open : list[0]); }
    const i = list.indexOf(M.anchor), j = list.indexOf(id);
    if (i < 0 || j < 0) return;
    startSelecting();
    M.picked = new Set([...M.base, ...list.slice(Math.min(i, j), Math.max(i, j) + 1)]);
    M.cursor = id;
  }
  F.on("mail-row", (el, e) => {
    const id = el.dataset.id, X = X0();
    if (M.swipe) { M.swipe = null; F.render(); return; }
    if (e?.shiftKey && X) { pickRange(X, id); F.render(); return; }
    if ((e?.metaKey || e?.ctrlKey) && X) { togglePick(X, id); F.render(); return; }
    if (M.selecting) { if (M.picked.has(id)) M.picked.delete(id); else M.picked.add(id); setAnchor(id); F.render(); return; }
    setAnchor(id);
    openId(id);
  });
  // the row's swipe and context menu act on the whole conversation (like the app's swipe)
  F.on("mail-row-seen", (el) => { const X = X0(), m = X.byId.get(el.dataset.id); if (!m) return; const th = threadFor(X, m.id), on = th.some((x) => !x.seen); if (!on) th.forEach((x) => M.autoSeen.add(x.id)); return setSeen(th, on); });
  F.on("mail-row-flag", (el) => { const X = X0(), m = X.byId.get(el.dataset.id); if (!m) return; const th = threadFor(X, m.id); return setFlagMany(th, !th.some((x) => x.flagged)); });
  F.on("mail-row-archive", (el) => { const X = X0(); return archiveAll(threadFor(X, el.dataset.id)); });
  F.on("mail-row-delete", (el) => { const X = X0(); M.menu = null; M.swipe = null; F.render(); return deleteThread(X, threadFor(X, el.dataset.id)); });
  F.on("mail-row-reply", (el) => { const X = X0(), m = X.byId.get(el.dataset.id); M.menu = null; F.render(); if (m) openCompose(replyDraft(X, m, false)); });
  F.on("mail-flag", (el) => { const X = X0(), m = X.byId.get(el.dataset.id); if (m) return setFlag(m, !m.flagged); });
  F.on("mail-move", (el) => {
    const X = X0(), id = el.dataset.id || selectedId(), m = X.byId.get(id); M.menu = null; M.swipe = null; F.render();
    if (!m) return;
    openMove(selectedId() === id && !el.dataset.thread && !el.closest(".swipe") ? [m] : threadFor(X, id), selectedId() === id ? closeMessage : null);
  });
  F.on("mail-draft-open", (el) => { const X = X0(), d = X.drafts.find((x) => x.id === el.dataset.id); if (d) openCompose({ ...d, draftID: d.id }); });
  /** Discard a draft: it's deleted on the iPhone too (mail_draft_delete). */
  async function discardDraft(id, subject) {
    const ok = await F.alert({ title: "Discard this draft?", message: `${subject ? `“${subject}” ` : "It "}is deleted from your iPhone too. This can't be undone.`,
      buttons: [{ label: "Discard draft", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
    if (ok) await send([["mail_draft_delete", { draftID: id }]], "Draft discarded");
    return !!ok;
  }
  F.on("mail-draft-discard", (el) => { const X = X0(), d = X?.drafts.find((x) => x.id === el.dataset.id); if (d) return discardDraft(d.id, d.subject); });
  F.on("mail-retry", (el) => {
    const f = X0()?.failedSends.find((x) => x.id === el.dataset.id); if (!f?.send) return;
    openCompose({ ...f.send, retryOf: f.id });
  });
  F.on("mail-fail-dismiss", (el) => { dismissFailure(el.dataset.id); F.render(); });
  // bulk (edit mode, like iPhone Mail)
  const pickedMessages = (X) => threads(current(X)).filter((t) => M.picked.has(t[0].id)).flat();
  const endSelect = () => { M.picked.clear(); M.selecting = false; M.menu = null; M.anchor = M.cursor = null; M.base = new Set(); };
  F.on("mail-pick-all", () => { const all = threads(current(X0())).map((t) => t[0].id); M.picked = M.picked.size === all.length ? new Set() : new Set(all); F.render(); });
  F.on("mail-bulk-unread", () => { const ms = pickedMessages(X0()); ms.forEach((m) => M.autoSeen.add(m.id)); endSelect(); return setSeen(ms, false); });
  F.on("mail-bulk-flag", (el) => { const ms = pickedMessages(X0()); endSelect(); return setFlagMany(ms, el.dataset.on === "1"); });
  F.on("mail-bulk-junkblock", () => { const X = X0(), ms = pickedMessages(X); endSelect(); return markJunk(X, ms, true); });
  F.on("mail-bulk-read", () => { const ms = pickedMessages(X0()); endSelect(); return setSeen(ms, true); });
  F.on("mail-bulk-archive", () => { const ms = pickedMessages(X0()); endSelect(); return archiveAll(ms); });
  F.on("mail-bulk-move", () => openMove(pickedMessages(X0()), endSelect));
  F.on("mail-bulk-delete", async () => {
    const X = X0(), ms = pickedMessages(X), inTrash = ms.every((m) => isInTrash(X, m));
    const ok = await F.alert({ title: inTrash ? `Delete ${ms.length} emails forever?` : `Move ${ms.length} emails to Trash?`, message: inTrash ? "They're already in Trash. This can't be undone." : "",
      buttons: [{ label: inTrash ? "Delete forever" : "Move to Trash", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
    if (!ok) return;
    endSelect(); await trashAll(X, ms);
  });
  F.on("mail-bulk-junk", () => { const X = X0(), ms = pickedMessages(X); endSelect(); return markJunk(X, ms); });
  F.on("mail-bulk-notjunk", () => { const ms = pickedMessages(X0()); endSelect(); return notJunk(ms); });

  // junk, blocked senders and unsubscribe
  const closeMenus = () => { M.menu = null; M.swipe = null; F.render(); };
  F.on("mail-row-junk", (el) => { const X = X0(); closeMenus(); return markJunk(X, threadFor(X, el.dataset.id), !!el.dataset.block); });
  F.on("mail-row-notjunk", (el) => { const X = X0(); closeMenus(); return notJunk(threadFor(X, el.dataset.id)); });
  F.on("mail-junk", (el) => { const X = X0(), m = X.byId.get(el.dataset.id); closeMenus(); if (!m) return; closeMessage(); return markJunk(X, [m], !!el.dataset.block); });
  F.on("mail-notjunk", (el) => { const X = X0(), m = X.byId.get(el.dataset.id); closeMenus(); if (!m) return; closeMessage(); return notJunk([m]); });
  F.on("mail-unblock", (el) => { closeMenus(); return unblock([el.dataset.email]); });
  F.on("mail-unsub", (el) => { const X = X0(), m = X.byId.get(el.dataset.id); closeMenus(); if (m) return confirmUnsubscribe(X, m); });
  /** "You opened their unsubscribe page — finished there?" */
  F.on("mail-unsub-done", (el) => send([["mail_unsub_confirm", { email: el.dataset.email }]], "Marked as unsubscribed"));
  F.on("mail-unsub-page", (el) => { const m = X0()?.byId.get(el.dataset.id), plan = m && unsubscribePlan(m); if (plan?.kind === "page") openPage(plan.url); });
  F.on("mail-subs", () => { closeMenus(); openSubscriptions(); });

  // ------------------------------------------------------------ the "⋯" menu (CommsView.moreMenu)
  F.on("mail-show", (el) => {
    M.show = el.dataset.value; M.menu = null;
    const X = X0(); if (X) { const vis = new Set(visibleIds(X)); M.picked = new Set([...M.picked].filter((id) => vis.has(id))); }   // nothing hidden stays picked
    F.render();
  });
  F.on("mail-select-on", () => { M.menu = null; startSelecting(); F.render(); });
  F.on("mail-shortcuts", () => { M.menu = null; F.render(); openShortcuts(); });
  /** Mark all as read: exactly what's on screen (this lane, filter, folder and account), with Undo for the same emails. */
  F.on("mail-mark-all-read", () => {
    const X = X0(); M.menu = null; if (!X) return F.render();
    const list = current(X).filter((m) => !m.seen);
    if (!list.length) { F.toast("Nothing unread here"); return F.render(); }
    return send([["mail_seen", { ...idsMany(list), on: true }]], `Marked ${list.length} email${list.length === 1 ? "" : "s"} as read`,
      () => { list.forEach((m) => M.autoSeen.add(m.id)); return send([["mail_seen", { ...idsMany(list), on: false }]]); });
  });
  /** Empty Junk… / Empty Trash…: permanent, so it asks first (the app's confirmationDialog wording). */
  F.on("mail-empty", async (el) => {
    const X = X0(), role = el.dataset.role, a = M.acct ? account(X, M.acct) : null, word = role === "junk" ? "Junk" : "Trash";
    M.menu = null; F.render();
    const ok = await F.alert({ title: `Empty ${word}` + (a ? ` in ${a.label}` : " in every account") + "?", message: "Everything in it is deleted forever on the server. This can't be undone.",
      buttons: [{ label: `Empty ${word}`, kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
    if (!ok) return;
    await send([["mail_empty", { ...(a ? { accountID: a.id } : {}), role }]], `${word} emptied`);
  });

  /** The shortcuts, listed like the app's Form rows. */
  function openShortcuts() {
    const cmd = MAC ? "⌘" : "Ctrl+", sh = MAC ? "⇧" : "Shift+", ctl = MAC ? "⌃" : "";
    const k = (...keys) => keys.map((x) => `<kbd>${esc(x)}</kbd>`).join('<span class="t13 muted"> or </span>');
    const row = (label, keys) => `<div class="frow"><span class="lbl">${esc(label)}</span><span class="mkeys">${keys}</span></div>`;
    const sec = (title, rows, foot = "") => `<div class="fsec"><div class="fhead">${esc(title)}</div><div class="fgroup">${rows.join("")}</div>${foot ? `<p class="ffoot">${esc(foot)}</p>` : ""}</div>`;
    const body = `<div class="narrow form">
      ${sec("Move around", [row("Next email", k("↓", "J")), row("Previous email", k("↑", "K")), row("Search", k("/", cmd + "F")), row("Close email or clear selection", k("Esc"))])}
      ${sec("Pick emails", [row("Pick one more", k(`${MAC ? "⌘" : "Ctrl"}-click`)), row("Pick a range", k("Shift-click")), row("Grow the selection", k(sh + "↓", sh + "↑")), row("Select all", k(cmd + "A"))],
        "On a phone or tablet: press and hold an email, then tap or drag a finger down the circles.")}
      ${sec("Act on the open or picked emails", [row("Delete", k(MAC ? "⌫" : "Delete")), row("Archive", MAC ? k("E", ctl + cmd + "A") : k("E")), row("Mark read or unread", k("U", sh + cmd + "U")),
        row("Flag or unflag", k("L", sh + cmd + "L")), row("Junk", k("!", sh + cmd + "J"))])}
      ${sec("Write", [row("Reply", k("R")), row("Reply all", k("A")), row("Forward", k("F")), row("New email", k("C", cmd + "N"))])}</div>`;
    return F.sheet({ title: "Keyboard shortcuts", trailing: { label: "Done", act: "sheet-close" }, body, id: "mail-keys" });
  }

  // ------------------------------------------------------------ keyboard (CommsView.keyboardShortcuts) — never while typing
  function keyTargets(X) {
    if (M.selecting && M.picked.size) return pickedMessages(X);
    const id = selectedId(), m = id && X.byId.get(id);
    return m ? threadFor(X, id) : [];
  }
  /** After acting on the emails: nothing picked, no email open (as in the app). */
  const doneActing = () => { endSelect(); closeMessage(); F.render(); };
  function moveOpen(X, step) {
    const list = visibleIds(X); if (!list.length) return;
    const i = list.indexOf(selectedId()), j = i < 0 ? (step > 0 ? 0 : list.length - 1) : i + step;
    if (j < 0 || j >= list.length) return;
    setAnchor(list[j]); M.scrollTo = list[j]; openId(list[j]);
  }
  function growPick(X, step) {
    const list = visibleIds(X); if (!list.length) return;
    if (!M.anchor || !list.includes(M.anchor)) {
      const open = selectedId();
      if (!list.includes(open)) { setAnchor(list[0]); pickRange(X, list[0]); M.scrollTo = list[0]; F.render(); return; }
      setAnchor(open);
    }
    const from = list.includes(M.cursor) ? M.cursor : M.anchor, j = list.indexOf(from) + step;
    if (j < 0 || j >= list.length) { pickRange(X, from); F.render(); return; }
    pickRange(X, list[j]); M.scrollTo = list[j];
    if (wide()) openId(list[j]); else F.render();      // on a phone the list stays in view
  }
  const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  document.addEventListener("keydown", async (e) => {
    if (e.defaultPrevented || F.S.tab !== "mail" || M.menu || document.querySelector("dialog[open]") || typing(e.target) || e.isComposing) return;
    const X = model(); if (!X || !X.accounts.length) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key, mod = e.metaKey || e.ctrlKey, open = X.byId.get(selectedId());
    const act = (fn) => { e.preventDefault(); return fn(); };
    const onTargets = (fn) => act(() => { const t = keyTargets(X); if (t.length) return fn(t); });
    const toggleRead = () => onTargets((t) => { const on = !t[0].seen; if (!on) t.forEach((m) => M.autoSeen.add(m.id)); return quietly(setSeen(t, on)); });
    const toggleFlag = () => onTargets((t) => quietly(setFlagMany(t, !t[0].flagged)));
    const junk = () => onTargets((t) => { doneActing(); return markJunk(X, t); });
    const archive = () => onTargets((t) => { doneActing(); return archiveAll(t); });
    const compose = () => act(() => { const a = M.acct || X.accounts[0]?.id; if (a) openCompose({ accountID: a, to: "", subject: "", body: "" }); });
    const search = () => act(() => { const s = document.getElementById("mail-q"); s?.focus(); s?.select?.(); });
    if (mod && !e.altKey) {
      if (key === "a" && e.metaKey && e.ctrlKey) return archive();
      if (key === "a" && !e.shiftKey) return act(() => { const all = visibleIds(X); if (!all.length) return; startSelecting(); M.picked = new Set(all); setAnchor(all[0]); M.cursor = all[all.length - 1]; F.render(); });
      if (key === "n" && !e.shiftKey) return compose();
      if (key === "f" && !e.shiftKey) return search();
      if (key === "u" && e.shiftKey) return toggleRead();
      if (key === "l" && e.shiftKey) return toggleFlag();
      if (key === "j" && e.shiftKey) return junk();
      if ((key === "Backspace" || key === "Delete") && !e.shiftKey) return onTargets((t) => { doneActing(); return deleteThread(X, t); });
      return;
    }
    if (e.altKey) return;
    if (key === "ArrowDown" || key === "ArrowUp") { const step = key === "ArrowDown" ? 1 : -1; return act(() => (e.shiftKey ? growPick(X, step) : moveOpen(X, step))); }
    if (key === "!") return junk();
    if (e.shiftKey) return;
    switch (key) {
      case "j": return act(() => moveOpen(X, 1));
      case "k": return act(() => moveOpen(X, -1));
      case "Backspace": case "Delete": return onTargets((t) => { doneActing(); return deleteThread(X, t); });
      case "e": return archive();
      case "u": return toggleRead();
      case "l": return toggleFlag();
      case "r": case "a": if (open) return act(() => openCompose(replyDraft(X, open, key === "a", { quote: X.bodies[open.id]?.text || "" }))); return;
      case "f": if (open) return act(() => { const b = X.bodies[open.id]; openCompose(forwardDraft(open, b?.text || "", b?.attachments || [])); }); return;
      case "c": return compose();
      case "/": return search();
      case "Escape":
        if (M.selecting) return act(() => { endSelect(); F.render(); });
        if (open || selectedId()) return act(() => { M.menu = null; closeMessage(); });
        return;
    }
  });

  // ------------------------------------------------------------ actions: one email
  const selected = () => { const X = X0(); return { X, m: X?.byId.get(selectedId()) }; };
  F.on("mail-close", () => { M.menu = null; closeMessage(); });
  F.on("mail-open-id", (el) => openMessage(el.dataset.id));
  F.on("mail-reply", (el) => { const { X, m } = selected(); M.menu = null; F.render(); if (m) openCompose(replyDraft(X, m, !!el.dataset.all, { quote: X.bodies[m.id]?.text || "" })); });
  F.on("mail-forward", () => { const { X, m } = selected(); if (m) { const b = X.bodies[m.id]; openCompose(forwardDraft(m, b?.text || "", b?.attachments || [])); } });
  F.on("mail-archive", () => { const { m } = selected(); if (!m) return; closeMessage(); return archiveAll([m]); });
  F.on("mail-delete", async () => {
    const { X, m } = selected(); if (!m) return;
    if (isInTrash(X, m)) {
      const ok = await F.alert({ title: "Delete this email forever?", message: "It's already in Trash. This can't be undone.", buttons: [{ label: "Delete forever", kind: "destructive", value: true }, { label: "Cancel", kind: "cancel" }] });
      if (!ok) return;
    }
    closeMessage(); await trashAll(X, [m]);
  });
  F.on("mail-unread", () => { const { m } = selected(); if (!m) return; M.autoSeen.add(m.id); closeMessage(); return setSeen([m], false); });
  F.on("mail-astext", () => { const id = selectedId(); M.menu = null; if (M.asText.has(id)) M.asText.delete(id); else M.asText.add(id); F.render(); });
  /** Get the whole email / Try again: ask the iPhone (again); an old failure for it is set aside. */
  F.on("mail-full", () => {
    const { X, m } = selected(); if (!m) return;
    const f = X.bodyFailed[m.id]; if (f) dismissFailure(f.id);
    M.askedBody.add(m.id); M.bodyAt[m.id] = F.nowSec();
    return send([["mail_body", one(m)]]);
  });

  /** Open one email from anywhere (Brief, Friday…). A message outside the current view resets to All accounts › Inbox › All. */
  function openMessage(id) {
    const X = X0();
    if (X && !current(X).some((m) => m.id === id)) { M.acct = null; M.folder = "INBOX"; M.lane = "All"; M.query = ""; }
    M.selecting = false; M.menu = null;
    openId(id);
  }

  // ------------------------------------------------------------ Email → Task (styled like the app's TodoEditSheet)
  // F.openTodoEdit(null, opts) only takes a title and due date, so mail has its own sheet with the email's notes prefilled.
  const QUADS = { 1: "Q1 · Urgent & important", 2: "Q2 · Important, not urgent", 3: "Q3 · Urgent, not important", 4: "Q4 · Neither" };
  const taskNotes = (m) => `Email from ${senderName(m)} — ${m.subject || "(no subject)"}\n${m.messageID || ""}`.trim();
  /** rows: [{m, archive:[messages]}] — one task per row; archive = what "Archive the email after" archives. */
  function openTaskSheet(rows) {
    rows = rows.filter((r) => r?.m);
    if (!rows.length) return;
    const many = rows.length > 1, m0 = rows[0].m;
    const ls = F.lists(), roles = (F.planner()?.roles || []).map((r) => r.name).filter(Boolean);
    const d = { title: m0.subject || "(no subject)", list: F.defaultList(), hasDue: true, due: D.key(new Date()), letter: null, number: 1, quadrant: null, role: null,
      bigRock: false, status: "Open", delegate: "", notes: taskNotes(m0), archive: false };
    if (ls.length && !ls.some((l) => l.title === d.list)) d.list = ls[0].title;
    const trim = (x) => String(x || "").trim();
    const ok = () => (many || trim(d.title)) && (d.status !== "Delegated" || trim(d.delegate));
    const sw = (id, f, on) => `<span class="switch"><input id="${id}" type="checkbox" role="switch" data-f="${f}" ${on ? "checked" : ""}></span>`;
    const body = () => `<div class="narrow form te mtask">
      ${many ? `<div class="fsec"><div class="fhead">${rows.length} tasks, one per email</div><div class="fgroup">${rows.map((r) => `<div class="frow"><span class="lbl t15 ell">${esc(r.m.subject || "(no subject)")}</span><span class="t13 muted ell mt-from">${esc(senderName(r.m))}</span></div>`).join("")}</div>
          <p class="ffoot">Each task is named after its email, with the sender in its notes. Everything below applies to all of them.</p></div>`
        : `<div class="fsec"><div class="fgroup"><div class="frow"><input id="mt-title" class="bare" placeholder="Task" value="${esc(d.title)}" data-f="title" aria-label="Task" autocomplete="off"></div></div></div>`}
      <div class="fsec"><div class="fhead">Priority</div><div class="fgroup">
        <div class="frow seg-row">${ui.seg("", ["None", "A", "B", "C"], d.letter || "None").replace(/data-act=""/g, 'data-x="letter"')}</div>
        ${d.letter ? `<div class="frow"><span class="lbl">Order: ${esc(d.letter + d.number)}${many ? ` to ${esc(d.letter + (d.number + rows.length - 1))}` : ""}</span><div class="stepper"><button type="button" data-x="num" data-d="-1" aria-label="Decrease" ${d.number <= 1 ? "disabled" : ""}>${icon("minus")}</button><span></span><button type="button" data-x="num" data-d="1" aria-label="Increase" ${d.number >= 30 ? "disabled" : ""}>${icon("plus")}</button></div></div>` : ""}
        <div class="frow"><label class="lbl" for="mt-q">Quadrant</label><select id="mt-q" class="bare" data-f="quadrant"><option value="0">Not set</option>${[1, 2, 3, 4].map((q) => `<option value="${q}" ${d.quadrant === q ? "selected" : ""}>${esc(QUADS[q])}</option>`).join("")}</select></div>
        <div class="frow"><label class="lbl" for="mt-role">Role</label><select id="mt-role" class="bare" data-f="role"><option value="">None</option>${roles.map((r) => `<option ${d.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>
        <div class="frow"><label class="lbl" for="mt-rock">Big Rock</label>${sw("mt-rock", "bigRock", d.bigRock)}</div></div>
        <p class="ffoot">A = vital, must do today · B = important, should do · C = optional.</p></div>
      <div class="fsec"><div class="fgroup">
        <div class="frow"><label class="lbl" for="mt-hasdue">Due date</label>${sw("mt-hasdue", "hasDue", d.hasDue)}</div>
        ${d.hasDue ? `<div class="frow"><label class="lbl" for="mt-due">Date</label><input id="mt-due" class="bare right" type="date" value="${esc(d.due)}" data-f="due" required></div>` : ""}
        <div class="frow"><label class="lbl" for="mt-list">List</label><select id="mt-list" class="bare" data-f="list">${(ls.length ? ls : [{ title: d.list }]).map((l) => `<option ${l.title === d.list ? "selected" : ""}>${esc(l.title)}</option>`).join("")}</select></div></div></div>
      <div class="fsec"><div class="fhead">Status</div><div class="fgroup">
        <div class="frow seg-row">${ui.seg("", ["Open", "In progress", "Delegated"], d.status).replace(/data-act=""/g, 'data-x="status"')}</div>
        ${d.status === "Delegated" ? `<div class="frow"><input id="mt-del" class="bare" placeholder="Delegated to…" value="${esc(d.delegate)}" data-f="delegate" aria-label="Delegated to" autocomplete="off"></div>` : ""}</div>
        <p class="ffoot">In progress shows as • and Delegated as D, like the paper planner.</p></div>
      ${many ? "" : `<div class="fsec"><div class="fhead">Notes</div><div class="fgroup"><div class="frow"><textarea id="mt-notes" class="bare" rows="3" data-f="notes" aria-label="Notes">${esc(d.notes)}</textarea></div></div></div>`}
      <div class="fsec"><div class="fgroup"><div class="frow"><label class="lbl" for="mt-arch">${many ? "Archive the emails after" : "Archive the email after"}</label>${sw("mt-arch", "archive", d.archive)}</div></div></div>
    </div>`;
    const s = F.sheet({ title: many ? `Make ${rows.length} tasks` : "Make a task", leading: { label: "Cancel" },
      trailing: () => ({ label: "Add", act: "mail-task-save", disabled: !ok() }), body, id: "mail-task" });
    const primary = () => s.el.querySelector('[data-act="mail-task-save"]');
    if (!many) s.el.querySelector("#mt-title")?.focus();
    s.el.addEventListener("input", (e) => {
      const f = e.target.dataset?.f; if (!f) return;
      if (f === "title" || f === "delegate" || f === "notes") { d[f] = e.target.value; const b = primary(); if (b) b.disabled = !ok(); }
    });
    s.el.addEventListener("change", (e) => {
      const f = e.target.dataset?.f; if (!f) return;
      const el = e.target, v = el.value;
      if (f === "quadrant") d.quadrant = +v || null;
      else if (f === "role") d.role = v || null;
      else if (f === "list") d.list = v;
      else if (f === "due") { if (v) d.due = v; }
      else if (["bigRock", "hasDue", "archive"].includes(f)) { d[f] = el.checked; if (f === "hasDue") s.update(); }
    });
    s.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-x]"); if (!b || b.disabled) return;
      if (b.dataset.x === "letter") { d.letter = b.dataset.value === "None" ? null : b.dataset.value; s.update(); }
      if (b.dataset.x === "num") { d.number = Math.min(30, Math.max(1, d.number + +b.dataset.d)); s.update(); }
      if (b.dataset.x === "status") { d.status = b.dataset.value; s.update(); if (d.status === "Delegated") s.el.querySelector("#mt-del")?.focus(); }
    });
    s.el._task = async () => {
      if (!ok()) return;
      // add_todo carries inProgress / delegate too (the "•" and "D" status), since a follow-up needs the new to-do's id
      const cmds = rows.map((r, i) => ["add_todo", { title: many ? r.m.subject || "(no subject)" : trim(d.title), list: d.list, ...(d.hasDue ? { due: d.due } : {}),
        letter: d.letter, number: d.letter ? Math.min(99, d.number + i) : null, quadrant: d.quadrant, role: d.role, bigRock: d.bigRock,
        inProgress: d.status === "In progress", delegate: d.status === "Delegated" ? trim(d.delegate) : null, notes: many ? taskNotes(r.m) : d.notes }]);
      const archive = d.archive ? [...new Map(rows.flatMap((r) => r.archive || [r.m]).map((x) => [x.id, x])).values()] : [];
      if (archive.length) cmds.push(["mail_archive", ids(archive)]);
      s.close();
      if (archive.some((x) => x.id === selectedId())) closeMessage();
      try { await send(cmds, (many ? `${rows.length} tasks added` : "Task added") + (archive.length ? " · email archived" : "")); } catch {}
    };
    return s;
  }
  F.on("mail-task-save", (el) => el.closest("dialog")?._task?.());
  /** "Make a task": from the open email (that one), a row (its newest email; archive = the conversation), or the picked rows (one task each). */
  F.on("mail-task", (el) => {
    const X = X0(), m = X?.byId.get(el.dataset.id); M.menu = null; M.swipe = null; F.render();
    if (m) openTaskSheet([{ m, archive: el.dataset.row ? threadFor(X, m.id) : [m] }]);
  });
  F.on("mail-bulk-task", () => {
    const X = X0(); if (!X) return;
    const rows = threads(current(X)).filter((t) => M.picked.has(t[0].id)).map((t) => ({ m: t[0], archive: t }));
    endSelect(); F.render();
    openTaskSheet(rows);
  });

  // ------------------------------------------------------------ MoveSheet
  function openMove(messages, done) {
    if (!messages.length) return;
    let working = false;
    const X = X0();
    const folders = (aid) => {
      const fl = X.folders[aid] || [];
      return [{ name: "INBOX", role: "inbox" }, ...fl.filter((f) => f.name.toUpperCase() !== "INBOX").sort((a, b) => ((a.role || "~") + a.name < (b.role || "~") + b.name ? -1 : 1))];
    };
    const body = () => `<div class="narrow form">${X.accounts.map((a) => `<div class="fsec"><div class="fhead h g8"><i class="dot d8" style="background:${a.color}"></i>${esc(a.label)}</div><div class="fgroup">
      ${folders(a.id).map((f) => `<button type="button" class="frow mvrow" data-act="mail-move-to" data-acct="${esc(a.id)}" data-folder="${esc(f.name)}" ${working ? "disabled" : ""}>
        <span class="mvic">${icon(roleIcon(f.role))}</span><span class="lbl ell">${esc(f.name === "INBOX" ? "Inbox" : displayName(f.name))}</span>
        ${messages.every((m) => m.accountID === a.id && m.folder === f.name) ? '<span class="t13 muted">Current</span>' : ""}</button>`).join("")}
      <button type="button" class="frow mvrow c-action" data-act="mail-move-new" data-acct="${esc(a.id)}" ${working ? "disabled" : ""}><span class="mvic c-action">${icon("folder.badge.plus")}</span><span class="lbl">New folder…</span></button></div></div>`).join("")}</div>`;
    const sh = F.sheet({ title: messages.length === 1 ? "Move email" : `Move ${messages.length} emails`, leading: { label: "Cancel" }, body, id: "mail-move" });
    const go = async (aid, folder) => {
      working = true; sh.update();
      const dest = account(X, aid), same = messages.every((m) => m.accountID === aid);
      try {
        await send([["mail_move", { ...ids(messages), folder, accountID: aid }]],
          `Moved ${what(messages)} to ${folder === "INBOX" ? "Inbox" : folder}` + (same ? "" : ` in ${dest?.label || ""}`));
        sh.close(); done?.();
        F.render();
      } catch { working = false; sh.update(); }
    };
    sh.el._mailGo = go;
    sh.el._mailX = X;
  }
  F.on("mail-move-to", (el) => el.closest("dialog")?._mailGo?.(el.dataset.acct, el.dataset.folder));
  F.on("mail-move-new", async (el) => {
    const d = el.closest("dialog");
    const r = await F.alert({ title: "New folder", input: { placeholder: "Folder name" }, buttons: [{ label: "Create and move", value: true }, { label: "Cancel", kind: "cancel" }] });
    const n = r?.text?.trim(); if (!n) return;
    await send([["mail_create_folder", { accountID: el.dataset.acct, name: n }]]);
    d?._mailGo?.(el.dataset.acct, n);
  });

  // ------------------------------------------------------------ SubscriptionsView (every mailing list, mass unsubscribe; blocked senders)
  function openSubscriptions() {
    if (!X0()) { F.toast("Open F.R.I.D.A.Y. on your iPhone first; it sends your email here."); return; }
    const st = { page: "Subscriptions", query: "", picked: new Set(), alsoJunk: false, alsoBlock: false, running: false, progress: 0, total: 0, results: [] };
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const subs = (X) => { const q = st.query.trim().toLowerCase(); return subscriptions(X).filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.includes(q)); };
    const subRow = (X, s) => {
      const on = st.picked.has(s.email), done = unsubscribedOn(X, s.email), opened = !done && pageOpened(X, s.email), blocked = isBlocked(X, s.email);
      return `<div class="frow subrow">
        <button type="button" class="subpick" data-act="subs-pick" data-email="${esc(s.email)}" aria-pressed="${on}">
          <span class="pick ${on ? "on" : ""}">${icon(on ? "checkmark.circle.fill" : "circle")}</span>
          <span class="v g2 grow">
            <span class="t15 w6 ink ell">${esc(s.name)}</span>
            <span class="t12 muted ell">${esc(s.email)}</span>
            <span class="t12 ink2">${plural(s.count, "email")} · ${s.opened === 0 ? "never opened" : `${s.opened} opened`} · last ${esc(D.md(s.last))}</span>
            ${done || opened || blocked ? `<span class="flow g4">${done ? ui.tag(`Unsubscribed ${D.md(done)}`) : ""}${opened ? ui.tag("Unsubscribe page opened, not confirmed") : ""}${blocked ? ui.tag("Blocked") : ""}</span>` : ""}
          </span>
        </button>
        ${opened ? ui.btn({ label: "Yes, done", kind: "small", act: "mail-unsub-done", data: { email: s.email }, aria: `I finished unsubscribing from ${s.email}` }) : ""}
        ${ui.btn({ label: blocked ? "Unblock" : "Block", icon: blocked ? "hand.raised.slash" : "hand.raised", kind: "small", act: blocked ? "subs-unblock" : "subs-block", data: { email: s.email }, aria: `${blocked ? "Unblock" : "Block"} ${s.email}` })}
      </div>`;
    };
    const listHTML = (X) => {
      const list = subs(X), never = list.filter((s) => s.opened === 0 && !unsubscribedOn(X, s.email));
      const all = never.length && never.every((s) => st.picked.has(s.email));
      return `<div class="fsec"><div class="fhead h g8"><span class="grow">${plural(list.length, "sender")} · most mail first</span>
          ${never.length ? `<button type="button" class="btn link t13 w6 subnever" data-act="subs-never">${all ? "Clear" : `Pick the ${never.length} never opened`}</button>` : ""}</div>
        <div class="fgroup">${list.length ? list.map((s) => subRow(X, s)).join("")
          : `<div class="frow"><span class="t15 muted">${esc(st.query.trim() ? `No sender matches “${st.query.trim()}”.` : "No mailing lists in your recent mail.")}</span></div>`}</div>
        <p class="ffoot">Only senders that offer an unsubscribe are listed. Nothing is picked for you; tap the ones you want gone.</p></div>`;
    };
    const blockedHTML = (X) => {
      const bl = blockedSenders(X), al = allowedSenders(X);
      const row = (e, label, act) => `<div class="frow"><span class="lbl t15 ink ell">${esc(e)}</span>${ui.btn({ label, kind: "small", act, data: { email: e } })}</div>`;
      return `<div class="fsec"><div class="fgroup">${bl.length ? bl.map((e) => row(e, "Unblock", "subs-unblock")).join("")
          : `<div class="frow"><span class="t15 muted">Nobody is blocked. Use Junk and block sender on an email, or block a sender in Subscriptions.</span></div>`}</div>
        <p class="ffoot">Mail from blocked senders goes straight to Junk on every device. "Not Junk" on any of their emails unblocks them.</p></div>
        ${al.length ? `<div class="fsec"><div class="fhead">Never junk</div><div class="fgroup">${al.map((e) => row(e, "Remove", "subs-forget")).join("")}</div>
          <p class="ffoot">Senders you marked Not Junk. They are never blocked.</p></div>` : ""}`;
    };
    const body = () => {
      const X = X0(); if (!X) return "";
      return `<div class="narrow v g16">
        <div class="v g8">${ui.seg("subs-page", ["Subscriptions", "Blocked"], st.page)}
          ${st.page === "Subscriptions" ? ui.search("subs-q", "Search senders", st.query, "subs-q") : ""}</div>
        <div class="form" id="subs-list">${st.page === "Subscriptions" ? listHTML(X) : blockedHTML(X)}</div></div>`;
    };
    const resultsHTML = () => {
      const ok = st.results.filter((r) => r.kind === "done"), pages = st.results.filter((r) => r.kind === "page"), failed = st.results.filter((r) => r.kind === "failed");
      return `<div class="v g8"><p class="t17 w6 ink">Asked your iPhone to unsubscribe from ${ok.length}</p>
        ${pages.length ? `<p class="t13 ink2">${plural(pages.length, "sender")} only take${pages.length === 1 ? "s" : ""} requests on their own page. Open each one to finish:</p>
          <div class="flow">${pages.map((r) => ui.btn({ label: `Finish: ${r.name}`, icon: "arrow.up.right.square", kind: "small", act: "subs-finish", data: { url: r.url } })).join("")}</div>` : ""}
        ${failed.map((r) => ui.errorText(`${r.name}: ${r.why}`)).join("")}
        <div>${ui.btn({ label: "Done", act: "subs-results-done" })}</div></div>`;
    };
    const foot = () => {
      if (st.page !== "Subscriptions" || (!st.picked.size && !st.running && !st.results.length)) return "";
      if (st.running) return `<div class="h g8">${ui.spinner()}<span class="t15 ink">Unsubscribing ${st.progress} of ${st.total}…</span></div>`;
      if (st.results.length) return resultsHTML();
      return `<div class="v g8 subfoot">
        <label class="h g8 subtog"><span class="t15 ink grow">Also move their mail to Junk</span>${ui.switch("", st.alsoJunk, "subs-alsojunk")}</label>
        <label class="h g8 subtog"><span class="t15 ink grow">Send anything they mail later to Junk</span>${ui.switch("", st.alsoBlock, "subs-alsoblock")}</label>
        ${ui.btn({ label: `Unsubscribe from ${st.picked.size}`, kind: "primary", wide: true, act: "subs-run" })}</div>`;
    };
    const sh = F.sheet({ title: "Subscriptions & junk", trailing: { label: "Done", act: "sheet-close" }, body, foot, id: "mail-subs" });
    sh.refresh = () => { if (!st.running) sh.update(); };
    const redraw = () => sh.update();

    async function runAll() {
      const X = X0(); if (!X) return;
      const chosen = subscriptions(X).filter((s) => st.picked.has(s.email));
      st.running = true; st.progress = 0; st.total = chosen.length; st.results = []; redraw();
      const cmds = [], junkMs = [], blockNow = [];
      for (const s of chosen) {
        st.progress += 1;
        const name = s.name;
        if (unsubscribedOn(X, s.email)) {
          st.results.push({ name, kind: "done" });
          if (st.alsoJunk) junkMs.push(...X.messages.filter((m) => m.from.email.toLowerCase() === s.email && !isInJunk(m)));
          if (st.alsoBlock) blockNow.push(s.email);
          continue;
        }
        const plan = unsubscribePlan(s.sample);
        if (plan.kind === "none") { st.results.push({ name, kind: "failed", why: "This email doesn't offer an unsubscribe link." }); continue; }
        // the iPhone records a page-only sender as "page opened, not confirmed" and blocks / junks as asked
        cmds.push(["mail_unsubscribe", { ...one(s.sample), alsoJunk: st.alsoJunk, block: st.alsoBlock }]);
        if (plan.kind === "page") st.results.push({ name, kind: "page", url: plan.url });
        else st.results.push({ name, kind: "done" });
      }
      if (junkMs.length) cmds.push(["mail_junk", idsMany(junkMs)]);
      for (const email of blockable(X, blockNow)) cmds.push(["mail_block", { email }]);
      redraw();
      try { if (cmds.length) await send(cmds); }
      catch { st.results = st.results.map((r) => (r.kind === "failed" ? r : { ...r, kind: "failed", why: "Couldn't reach your iPhone's sync. Try again." })); }
      st.running = false;
      if (!st.results.length) st.picked.clear();
      redraw();
    }

    sh.el._subs = {
      page(el) { st.page = el.dataset.value; redraw(); },
      query(el) { st.query = el.value; const X = X0(), l = sh.el.querySelector("#subs-list"); if (X && l) l.innerHTML = listHTML(X); },
      pick(el) { const e = el.dataset.email; if (st.picked.has(e)) st.picked.delete(e); else st.picked.add(e); redraw(); },
      never() {
        const X = X0(), never = subs(X).filter((s) => s.opened === 0 && !unsubscribedOn(X, s.email)).map((s) => s.email);
        if (never.every((e) => st.picked.has(e))) never.forEach((e) => st.picked.delete(e)); else never.forEach((e) => st.picked.add(e));
        redraw();
      },
      alsoJunk(el) { st.alsoJunk = el.checked; },
      alsoBlock(el) { st.alsoBlock = el.checked; },
      async run() {
        const n = st.picked.size;
        const ok = await F.alert({ title: `Unsubscribe from ${n} sender${n === 1 ? "" : "s"}?`,
          message: "F.R.I.D.A.Y. asks each one to stop sending you email." + (st.alsoJunk ? " Their mail moves to Junk." : "") + (st.alsoBlock ? " Anything they send later goes to Junk." : ""),
          buttons: [{ label: "Unsubscribe", value: true }, { label: "Cancel", kind: "cancel" }] });
        if (ok) await runAll();
      },
      resultsDone() { st.results = []; st.picked.clear(); redraw(); },
    };
    return sh;
  }
  const SB = (el) => el.closest("dialog")?._subs;
  F.on("subs-page", (el) => SB(el)?.page(el));
  F.onInput("subs-q", (el) => SB(el)?.query(el));
  F.on("subs-pick", (el) => SB(el)?.pick(el));
  F.on("subs-never", (el) => SB(el)?.never());
  F.onChange("subs-alsojunk", (el) => SB(el)?.alsoJunk(el));
  F.onChange("subs-alsoblock", (el) => SB(el)?.alsoBlock(el));
  F.on("subs-run", (el) => SB(el)?.run());
  F.on("subs-results-done", (el) => SB(el)?.resultsDone());
  F.on("subs-finish", (el) => openPage(el.dataset.url));
  F.on("subs-block", (el) => { const X = X0(); if (X) return block(X, [el.dataset.email]); });
  F.on("subs-unblock", (el) => unblock([el.dataset.email]));
  F.on("subs-forget", (el) => forgetAllowed(el.dataset.email));

  // ------------------------------------------------------------ ComposeView ("Nothing is sent until you tap Send")
  function openCompose(input = {}) {
    const X = X0();
    if (!X || !X.accounts.length) { F.toast("Sign in to your email in F.R.I.D.A.Y. on your iPhone first."); return; }
    const d = { accountID: input.accountID || M.acct || X.accounts[0].id, to: input.to || "", cc: input.cc || "", subject: input.subject || "", body: input.body || "",
      inReplyTo: input.inReplyTo || "", references: input.references || "", replyingTo: input.replyingTo || null, byFriday: !!input.byFriday, attachmentsLeft: input.attachmentsLeft || [],
      draftID: input.draftID || null,          // sending a draft: the iPhone deletes that draft (mail_send{draftID})
      retryOf: input.retryOf || null };        // a "Not sent" being tried again: its failure is set aside once this one is queued
    if (!X.accounts.some((a) => a.id === d.accountID)) d.accountID = X.accounts[0].id;
    // signature: only look above any quoted original ("Hi <name>" in the quote isn't his signature)
    const p = F.prefs().mailSignature;
    const sig = (p != null ? p : (X.md.signature || F.firstName())).trim();
    const mine = d.body.split("\n\nOn ")[0];
    if (sig && !d.byFriday && !d.draftID && !d.retryOf && !mine.includes(sig)) d.body = !d.body ? "\n\n" + sig : "\n\n" + sig + "\n" + d.body;
    const startBody = d.body;
    let sending = false, error = null;
    const known = knownAddresses(X);
    const start = { to: d.to, cc: d.cc, subject: d.subject, accountID: d.accountID };
    const isUntouched = () => (d.draftID || d.retryOf
      ? d.to === start.to && d.cc === start.cc && d.subject === start.subject && d.accountID === start.accountID
      : !d.to.trim() && !d.cc.trim() && !d.subject.trim()) && d.body === startBody;
    const fromRow = () => {
      const a = account(X, d.accountID);
      return `<div class="crow"><span class="clbl">From</span><span class="cfrom h g8 grow"><span class="t16 ink ell">${esc(a?.label || "Choose")}</span><span class="t13 muted ell">${esc(a?.email || "")}</span><span class="sp"></span>${icon("chevron.up.chevron.down", 'class="cd"')}
        <select data-change="mail-c-from" aria-label="From ${esc(a?.label || "")}">${X.accounts.map((x) => `<option value="${esc(x.id)}" ${x.id === d.accountID ? "selected" : ""}>${esc(x.label)} · ${esc(x.email)}</option>`).join("")}</select></span></div>`;
    };
    const sugg = (field) => {
      const parts = d[field].split(","), last = (parts[parts.length - 1] || "").trim().toLowerCase();
      if (last.length < 2 || (last.includes("@") && last.includes("."))) return "";
      const hits = known.filter((a) => a.email.toLowerCase().includes(last) || (a.name || "").toLowerCase().includes(last)).slice(0, 4);
      return hits.map((a) => `<button type="button" class="csug press" data-act="mail-c-sugg" data-field="${field}" data-addr="${esc(formatAddress(a))}"><span class="t13 w6 ink ell">${esc(a.name || a.email)}</span>${a.name ? `<span class="t11 muted ell">${esc(a.email)}</span>` : ""}</button>`).join("");
    };
    const fieldIn = (field, ph, type = "text") => `<textarea class="cin" rows="1" id="mail-c-${field}" data-input="mail-c-field" data-field="${field}" placeholder="${esc(ph)}" ${type === "email" ? 'inputmode="email" autocapitalize="none" autocomplete="off" spellcheck="false"' : ""}>
${esc(d[field])}</textarea>`;
    const body = () => `<div class="compose v g16">
      ${error ? `<div class="cerr">${ui.errorText("Not sent: " + error)}</div>` : ""}
      <div class="card ccard">
        <div class="crow"><label class="clbl" for="mail-c-to">To</label>${fieldIn("to", "Name or email", "email")}</div><div class="csugs" data-sugg="to">${sugg("to")}</div>
        <div class="cdiv"></div>
        <div class="crow"><label class="clbl" for="mail-c-cc">Cc</label>${fieldIn("cc", "Optional", "email")}</div><div class="csugs" data-sugg="cc">${sugg("cc")}</div>
        <div class="cdiv"></div>${fromRow()}<div class="cdiv"></div>
        <div class="crow"><label class="clbl" for="mail-c-subject">Subject</label>${fieldIn("subject", "Subject")}</div>
      </div>
      ${d.attachmentsLeft.length ? `<p class="t13 muted h g8">${icon("paperclip", 'style="width:14px;height:14px;flex:none"')}<span>${esc(d.attachmentsLeft.join(", "))} stay${d.attachmentsLeft.length === 1 ? "s" : ""} on your iPhone and won't be forwarded from here.</span></p>` : ""}
      <div class="card cbodycard"><textarea class="cbody" id="mail-c-body" data-input="mail-c-field" data-field="body" aria-label="Message">
${esc(d.body)}</textarea></div>
      ${d.draftID ? `<div>${ui.btn({ label: "Discard draft", icon: "trash", kind: "destructive", act: "mail-c-discard" })}</div>` : ""}
    </div>`;
    const title = () => d.subject.trim() ? d.subject : "New message";
    const sh = F.sheet({ title, leading: { label: "Cancel", act: "mail-c-cancel" }, trailing: () => ({ label: "Send", act: "mail-c-send", disabled: !d.to.trim(), busy: sending }), body, size: "", id: "mail-compose" });
    const grow = () => sh.el.querySelectorAll("textarea.cin").forEach((t) => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 96) + "px"; });
    const redraw = () => { sh.update(); grow(); };
    grow();
    sh.el.querySelector(d.to ? "#mail-c-body" : "#mail-c-to")?.focus();
    if (d.to) { const b = sh.el.querySelector("#mail-c-body"); try { b.setSelectionRange(0, 0); } catch {} }
    // There's no "save draft" command, so Cancel offers Discard / Keep editing (as before). A draft from the iPhone stays
    // there as it was unless he chooses Discard draft (mail_draft_delete).
    const cancel = async () => {
      if (isUntouched()) return sh.close();
      const r = await F.alert({ title: "Keep this message?", message: d.draftID ? "Nothing has been sent. Your changes here aren't saved; the draft stays on your iPhone as it was." : "Nothing has been sent.",
        buttons: [{ label: d.draftID ? "Close without saving changes" : "Discard", kind: "destructive", value: "discard" },
          ...(d.draftID ? [{ label: "Discard draft", kind: "destructive", value: "delete" }] : []), { label: "Keep editing", kind: "cancel" }] });
      if (r === "discard") sh.close();
      if (r === "delete") { sh.close(); await send([["mail_draft_delete", { draftID: d.draftID }]], "Draft discarded"); }
    };
    const discard = async () => { if (await discardDraft(d.draftID, d.subject)) sh.close(); };
    sh.el.addEventListener("cancel", (e) => { e.preventDefault(); cancel(); });
    sh.el._mail = {
      cancel, discard,
      field(el) {
        const f = el.dataset.field; d[f] = el.value;
        if (f === "to" || f === "cc") { const s = sh.el.querySelector(`[data-sugg="${f}"]`); if (s) s.innerHTML = sugg(f); grow(); }
        if (f === "subject") { const t = sh.el.querySelector(".sheetbar .title"); if (t) t.textContent = title(); grow(); }
        if (f === "to") { const b = sh.el.querySelector('[data-act="mail-c-send"]'); if (b && !sending) b.disabled = !d.to.trim(); }
      },
      from(el) { d.accountID = el.value; redraw(); },
      sugg(el) {
        const f = el.dataset.field, p = d[f].split(",").slice(0, -1).map((x) => x.trim()).filter(Boolean);
        p.push(el.dataset.addr); d[f] = p.join(", ") + ", "; redraw();
        const t = sh.el.querySelector("#mail-c-" + f); t?.focus(); try { t.setSelectionRange(t.value.length, t.value.length); } catch {}
      },
      async send() {
        error = null;
        const addrs = (s) => s.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (/<([^>]+)>/.exec(x)?.[1] || x).trim());
        const to = addrs(d.to), cc = addrs(d.cc);
        if (!to.length || !to.every((x) => x.includes("@")) || !cc.every((x) => x.includes("@"))) { error = "Add at least one valid recipient."; redraw(); return; }
        sending = true; redraw();
        const first = d.to.split(",")[0].trim().replace(/\s*<[^>]+>/, "") || to[0];
        try {
          await send([["mail_send", { accountID: d.accountID, to: d.to.trim().replace(/,\s*$/, ""), cc: d.cc.trim().replace(/,\s*$/, ""), subject: d.subject, body: d.body,
            inReplyTo: d.inReplyTo, references: d.references, replyingTo: d.replyingTo, byFriday: d.byFriday, ...(d.draftID ? { draftID: d.draftID } : {}) }]],
            `Sending to ${first}${to.length + cc.length > 1 ? ` and ${to.length + cc.length - 1} more` : ""} from your iPhone…`);
          if (d.retryOf) dismissFailure(d.retryOf);
          sh.close();
        } catch (e) { sending = false; error = F.friendly(e.message); redraw(); }
      },
    };
    return sh;
  }
  const C = (el) => el.closest("dialog")?._mail;
  F.on("mail-c-cancel", (el) => C(el)?.cancel());
  F.on("mail-c-send", (el) => C(el)?.send());
  F.on("mail-c-discard", (el) => C(el)?.discard());
  F.on("mail-c-sugg", (el) => C(el)?.sugg(el));
  F.onInput("mail-c-field", (el) => C(el)?.field(el));
  F.onChange("mail-c-from", (el) => C(el)?.from(el));

  F.openCompose = (draft) => openCompose(draft || {});
  F.openSubscriptions = () => openSubscriptions();
  F.openMessage = (id) => { location.hash = "mail"; openMessage(id); };
})();
