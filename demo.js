// Sample data for ?demo (generic; nothing personal). Shapes follow CONTRACT.md exactly.
"use strict";
window.FDemo = (() => {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const at = (d, h = 0, m = 0) => new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + d, h, m).getTime() / 1000;
  const key = (d) => { const x = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const ws = (() => { const x = new Date(t0); x.setDate(x.getDate() - x.getDay()); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
  const roles = [["R1", "Self-Renewal"], ["R2", "Professional"], ["R3", "Parent"], ["R4", "Partner"], ["R5", "Home & Finances"]].map(([id, name]) => ({ id, name }));
  const planner = {
    mission: "I do honest work, grow every year, and keep my family at the center.",
    actAs: "I act as a calm, focused professional who finishes what matters first.",
    values: [{ id: "V1", title: "Family comes first", detail: "" }, { id: "V2", title: "Integrity", detail: "Say what I'll do, do what I say" }, { id: "V3", title: "Keep learning", detail: "" }, { id: "V4", title: "Health and energy", detail: "" }],
    longGoals: [{ id: "G1", title: "Grow into a senior role", valueID: "V3", target: "2028", done: false }],
    midGoals: [{ id: "G2", title: "Ship the planning tool pilot", parentID: "G1", target: "by Feb 16", done: false }],
    roles,
    weeks: { [ws]: { rocks: [{ id: "K1", roleID: "R2", title: "Finish the quarterly plan draft", done: false, scheduled: true }, { id: "K2", roleID: "R1", title: "Exercise three times", done: true, scheduled: false }, { id: "K3", roleID: "R3", title: "One-on-one time with each kid", done: false, scheduled: false }],
                     saw: { Physical: "Three walks", Mental: "Read two chapters" }, sawDone: { Physical: true } } },
    days: { [key(0)]: { record: [{ id: "D1", time: at(0, 9, 10) - 978307200, text: "Called the insurance company; claim filed." }], planned: true, closed: false,
      marks: [{ id: "M1", title: "Draft the vendor brief", kind: "forward", to: key(1), code: "B1", time: 0 },
              { id: "M2", title: "Order new business cards", kind: "delete", code: "C2", time: 0 }] } },
    profile: { peakHour: 9, peakMinute: 0, peakMinutes: 120, slumpHour: 15, bufferMinutes: 90, batchTimes: ["11:30", "16:30"], traps: ["Last-minute messages & emails"], keystone: "Exercise three times", needleGoalID: "G2", milestones: ["Outline", "Draft", "Review"], completedDiagnostic: true },
  };
  const td = (id, title, d, letter, number, extra = {}) => ({ id, title, list: "Task Dump", listColor: "#767E8A", due: d == null ? null : at(d), dueHasTime: false, notes: "", letter, number, quadrant: null, role: null, bigRock: false, inProgress: false, delegate: null, goal: null, important: false, repeats: false, repeatRule: "never", ...extra });
  const todos = [
    td("T1", "Draft the quarterly plan", 0, "A", 1, { quadrant: 2, bigRock: true, role: "Professional", list: "Work", listColor: "#2F56C8" }),
    td("T2", "Call the insurance company", 0, "A", 2, { quadrant: 1, inProgress: true }),
    td("T3", "Reply to the team about the review", -2, "B", 1, { list: "Work", listColor: "#2F56C8" }),
    td("T4", "Pick up the shirts", 0, "C", 1, { delegate: "Alex", list: "Home", listColor: "#16A34A", due: at(0, 17, 30), dueHasTime: true }),
    td("T5", "Renew the car registration", 1, null, null, { important: true }),
    td("T6", "Plan this week's meals", 2, "B", 2, { list: "Home", listColor: "#16A34A", quadrant: 2 }),
    td("T7", "Clean up the shared drive", 3, "C", 1, { list: "Work", listColor: "#2F56C8", quadrant: 4 }),
    td("T8", "Book the dentist", null, null, null, { notes: "Ask about Saturday slots" }),
    td("T9", "Weekly review", 4, "B", 1, { repeats: true, repeatRule: "weekly", quadrant: 2 }),
  ];
  const done = [td("T10", "Morning walk", 0, "B", 2, { quadrant: 2, role: "Self-Renewal" })];
  const ev = (id, title, d, h, m, mins, extra = {}) => ({ id: id + "@" + at(d, h, m), itemID: id, title, start: at(d, h, m), end: at(d, h, m) + mins * 60, allDay: false, calendar: "Personal", calendarID: "C1", color: "#2F56C8", location: "", notes: "", repeats: false, ...extra });
  const events = [
    ev("E1", "Deep work · A1 & Big Rocks (Quadrant II)", 0, 9, 0, 120, { calendar: "Personal", repeats: true }),
    ev("E2", "Lunch with a friend", 0, 12, 30, 60, { location: "Downtown" }),
    ev("E3", "Team check-in", 0, 15, 0, 30, { calendar: "Work", calendarID: "C2", color: "#C2410C" }),
    ev("E4", "Kids' soccer practice", 1, 17, 0, 90, { calendar: "Family", calendarID: "C3", color: "#16A34A" }),
    ev("E5", "Project review", 2, 10, 0, 60, { calendar: "Work", calendarID: "C2", color: "#C2410C" }),
    { id: "E6@x", itemID: "E6", title: "Holiday", start: at(8), end: at(9), allDay: true, calendar: "Holidays", calendarID: "C4", color: "#9AA1AC", location: "", notes: "", repeats: false },
  ];
  const capacity = {};
  for (let i = 0; i < 14; i++) capacity[key(i)] = i === 0 ? { n: 6, fits: 4, room: 0, free: 210, needed: 290, aCount: 2, basis: "profile", reasons: ["3h 30m of meetings", "1h 30m crisis buffer", "1h for home and family"] } : { n: todos.filter((t) => t.due && key(Math.round((t.due - at(0)) / 86400)) === key(i)).length, fits: 6, room: 240, free: 300, needed: 60, aCount: 0, basis: "profile", reasons: [] };
  const payload = () => ({
    version: 1, device: "iPhone",
    prefs: { stamp: Date.now() / 1000, value: { franklinPlanner: JSON.stringify(planner), claudeModel: "claude-sonnet-5-5", plannerSetupDone: "1", fromName: "Sample User" } },
    claude: { stamp: 1, value: "" },
    friday: { stamp: 1, value: { facts: [{ id: "F1", fact: "Sample memory.", date: 0 }], lines: [] } },
    snapshot: { stamp: Date.now() / 1000, value: { at: Date.now() / 1000 - 240, device: "iPhone", access: { calendar: true, reminders: true },
      todos, done, history: { [key(-1)]: [td("H1", "Sent the invoice", -1, "A", 1)] }, events,
      lists: [{ title: "Task Dump", color: "#767E8A" }, { title: "Work", color: "#2F56C8" }, { title: "Home", color: "#16A34A" }],
      calendars: [{ id: "C1", title: "Personal", source: "iCloud", color: "#2F56C8", writable: true }, { id: "C2", title: "Work", source: "iCloud", color: "#C2410C", writable: true },
                  { id: "C3", title: "Family", source: "iCloud", color: "#16A34A", writable: true }, { id: "C4", title: "Holidays", source: "Other", color: "#9AA1AC", writable: false }],
      capacity, defense: { focus: true, buffer: true, batch0: true, batch1: false, slump: false }, applied: [], failed: {} } },
    queue: { stamp: 1, value: [] }, webchat: { stamp: 1, value: [] },
  });
  const msg = (i, from, email, subject, mins, extra = {}) => ({ id: "M" + i, accountID: "A1", folder: "INBOX", uid: 100 + i, from: { name: from, email }, to: [{ name: "Sample User", email: "me@example.com" }], cc: [], replyTo: null,
    subject, date: Date.now() / 1000 - mins * 60, seen: false, flagged: false, isUpdate: false, size: 4000, preview: "Hi, quick note about " + subject.toLowerCase() + ". Let me know what works.", messageID: "<m" + i + "@example.com>", references: "", ...extra });
  const mail = () => ({
    at: Date.now() / 1000 - 300,
    accounts: [{ id: "A1", label: "Personal", email: "me@example.com", fullName: "Sample User", colorIndex: 0 }, { id: "A2", label: "Work", email: "me@work.example", fullName: "Sample User", colorIndex: 2 }],
    folders: { A1: [{ name: "INBOX", role: "inbox" }, { name: "Archive", role: "archive" }, { name: "Sent", role: "sent" }, { name: "Trash", role: "trash" }, { name: "Junk", role: "junk" }, { name: "Receipts", role: "" }], A2: [{ name: "INBOX", role: "inbox" }, { name: "Trash", role: "trash" }] },
    messages: [msg(1, "Sample Recruiter", "recruiter@example.com", "Next steps", 20), msg(2, "Sample Newsletter", "news@example.com", "This week in product", 90, { isUpdate: true, unsubscribe: "<https://news.example.com/unsub?u=1>, <mailto:unsubscribe@news.example.com?subject=unsubscribe>", oneClick: true }),
               msg(3, "Sample Friend", "friend@example.com", "Dinner Saturday?", 200, { seen: true }), msg(4, "Sample Store", "noreply@example.com", "Your order has shipped", 300, { isUpdate: true, seen: true, unsubscribe: "<https://store.example.com/email-preferences>", oneClick: false }),
               msg(5, "Sample Colleague", "colleague@example.com", "Notes from today's sync", 420, { accountID: "A2", flagged: true }), msg(6, "Sample Bank", "alerts@example.com", "Statement ready", 900, { isUpdate: true, unsubscribe: "<mailto:optout@example.com?subject=stop>", oneClick: false }),
               msg(7, "Sample Newsletter", "news@example.com", "Last week in product", 1440 * 7, { isUpdate: true, unsubscribe: "<https://news.example.com/unsub?u=1>, <mailto:unsubscribe@news.example.com?subject=unsubscribe>", oneClick: true }),
               msg(8, "Sample Newsletter", "news@example.com", "Two weeks in product", 1440 * 14, { isUpdate: true, unsubscribe: "<https://news.example.com/unsub?u=1>, <mailto:unsubscribe@news.example.com?subject=unsubscribe>", oneClick: true }),
               msg(9, "Sample Promotions", "deals@promo.example", "You won a prize!!!", 600, { folder: "Junk", junk: true, isUpdate: true, unsubscribe: "<https://promo.example/stop>", oneClick: true }),
               // conversations (MailStore.threadKey): M10/M11 join M1 through References; M12/M13 join by their "Re:" subject; M3 (no "Re:") stays its own
               msg(10, "Sample User", "me@example.com", "Re: Next steps", 15, { folder: "Sent", seen: true, to: [{ name: "Sample Recruiter", email: "recruiter@example.com" }], references: "<m1@example.com>" }),
               msg(11, "Sample Recruiter", "recruiter@example.com", "Re: Next steps", 5, { references: "<m1@example.com> <m10@example.com>" }),
               msg(12, "Sample Friend", "friend@example.com", "RE: Dinner Saturday?", 180),
               msg(13, "Another Friend", "friend2@example.com", "Re: Dinner Saturday?", 170, { seen: true })],
    bodies: { M1: { text: "Hi,\n\nThanks for your time today. Could you send two times that work next week?\n\nThanks!", html: "<p>Hi,</p><p>Thanks for your time today. Could you send <b>two times</b> that work next week?</p><p>Thanks!</p>", attachments: ["Schedule.pdf"] },
              M2: { text: "This week in product: three short updates and a tip.", html: "<h2>This week in product</h2><p>Three short updates and a tip.</p>", attachments: [] },
              M3: { text: "Are you free Saturday at 7? Same place as last time.", html: null, attachments: [] } },
    drafts: [{ id: "6F1C2D3E-0000-4000-8000-00000000D001", accountID: "A1", to: "Sample Friend <friend@example.com>", cc: "", subject: "Re: Dinner Saturday?", body: "Sounds good, see you at 7.\n\nSample User",
               inReplyTo: "<m12@example.com>", references: "<m12@example.com>", replyingTo: "M12", byFriday: false, created: Date.now() / 1000 - 978307200 - 600, files: [] }],
    signature: "Sample User",
  });
  const devices = () => ({ at: new Date().toISOString(), mac: "Mac mini", devices: [{ name: "iPhone", udid: "AAAAAA", model: "iPhone 17 Pro", reachable: true, state: "available (paired)" }, { name: "iPad", udid: "BBBBBB", model: "iPad Pro 11-inch", reachable: false, state: "unavailable" }] });
  return { payload, mail, devices };
})();
