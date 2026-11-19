// Organizer + planner setup — a 1:1 port of the app's
//   DiagnosticSetupView.swift (6-question wizard, review, "You're set up"), DiagnosticMapping.swift (answers → pyramid),
//   OrganizerPresets.swift (starter profiles + pick list + Planner.merge), PlannerReset.swift (Start from zero),
//   OrganizerViews.swift (hub + the five modules).
// Exposes F.openSetup(mode) and F.openOrganizer(module?). Voice ("Say it") is left out on purpose; typing works.
"use strict";
(() => {
  const { ui, esc, D } = F;
  const icon = (n, a = "") => F.icon(n, a);
  F.addIcons({
    "checkmark.square.fill": '<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" stroke="none"/><path d="M7.5 12.3l3 3 6-6.3" stroke="#fff" stroke-width="2.4"/>',
    square: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/>',
    "checkmark.circle.fill": '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12.3l3 3 6-6.3" stroke="#fff" stroke-width="2.4"/>',
    minus: '<path d="M5 12h14"/>',
  });

  // ================================================================ helpers
  const has = (t, re) => re.test(t);
  const pad = (n) => String(n).padStart(2, "0");
  const hm = (c) => `${pad(c.h)}:${pad(c.m)}`;
  const parseHM = (s) => { const p = String(s || "").split(":").map(Number); return p.length === 2 && !p.some(isNaN) ? { h: p[0], m: p[1] } : null; };
  /** DiagnosticMapping.time: "9:00 AM" */
  const tm = (c) => { const d = new Date(); d.setHours(c?.h ?? 9, c?.m ?? 0, 0, 0); return D.time(d); };
  const trimP = (s) => s.replace(/^[\s.!?,]+|[\s.!?,]+$/g, "");
  const today = () => D.start(new Date());
  const openTodos = () => F.todos().filter((t) => !t.done);
  const calAccess = () => !!F.snap()?.access?.calendar;
  const defense = () => F.snap()?.defense || {};
  const hasBlock = (k) => !!defense()[k];
  const DEFENSE_KEYS = ["focus", "buffer", "batch0", "batch1", "slump"];

  /** PlannerCommands.taskPhrase */
  function taskPhrase(raw) {
    let s = trimP(String(raw || ""));
    const lead = /^((ok|okay|so|um|uh|well|yeah|yes|alright|i guess|i think|probably|definitely|maybe|let'?s say)[\s,]+)+/i;
    const intro = /^(my (big rock|goal|long.range goal|rock|main thing|priority) (is|would be|for (this|the) week is)( to)?|the (big rock|goal) is( to)?|for (this|the) week,?|this week,?|i (want|need|have|would like|'?d like|plan|hope) to|i'?m going to|i'?m gonna|i gotta|i should|i must|i will|i'?ll|it'?s|it would be|it'?s to|to)\s+/i;
    const tail = /\s+(this week|for (this|the) week|this year|in (the )?next (few|couple of) years|eventually|someday|if i can|hopefully|for sure)$/i;
    let prev = "";
    while (prev !== s) { prev = s; for (const p of [lead, intro, tail]) s = s.replace(p, ""); s = trimP(s); }
    return s ? s[0].toUpperCase() + s.slice(1) : "";
  }
  /** PlannerCommands.timeIn → {h, m} or null. 1–6 with no am/pm = afternoon. */
  function timeIn(raw) {
    const t = raw.toLowerCase().replace(/\b([ap])\.?\s?m\.?(?=\W|$)/g, "$1m");
    const small = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, "forty five": 45 };
    const rin = t.match(/\bin (\d{1,3}|an?|one|two|three|four|five|ten|fifteen|twenty|thirty|forty five) (hours?|minutes?|mins?)\b/);
    if (rin) {
      const n = /^\d+$/.test(rin[1]) ? +rin[1] : small[rin[1]]; if (n == null) return null;
      const d = new Date(Date.now() + n * (rin[2][0] === "h" ? 3600000 : 60000)); return { h: d.getHours(), m: d.getMinutes() };
    }
    const pm = /\b(pm|afternoon|evening|tonight)\b/.test(t), am = /\b(am|morning)\b/.test(t);
    let h = null, m = 0;
    if (/\bmidnight\b/.test(t)) h = 0;
    else if (/\bnoon\b/.test(t)) h = 12;
    else {
      const r = t.match(/(?<![a-z0-9:])\d{1,2}(:\d{2})?(?=\s*(am|pm)?(?![0-9]))/);
      if (r) { const p = r[0].split(":"); h = +p[0]; if (p.length > 1) m = +p[1] || 0; }
      else {
        const hours = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
        const tok = t.split(/[^a-z]+/).filter(Boolean);
        const i = tok.findIndex((w) => hours[w] != null);
        if (i >= 0) {
          let hh = hours[tok[i]];
          const after = tok.slice(i + 1, i + 3).join(" ");
          if (after.startsWith("fifteen")) m = 15; else if (after.startsWith("thirty")) m = 30; else if (after.startsWith("forty")) m = 45;
          const before = tok.slice(0, i).slice(-2).join(" ");
          if (before === "half past") m = 30; else if (before === "quarter past") m = 15;
          else if (before === "quarter to" || before === "quarter till") { m = 45; hh = (hh + 10) % 12 + 1; }
          h = hh;
        }
      }
    }
    if (h == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
    if (h <= 12) { if (pm && h < 12) h += 12; else if (am && h === 12) h = 0; else if (!am && !pm && h >= 1 && h <= 6) h += 12; }
    return { h, m };
  }

  // ================================================================ planner data (Franklin.swift shapes; Swift's decoder needs every non-optional key)
  const blankProfile = () => ({ peakHour: 9, peakMinute: 0, peakMinutes: 120, bufferMinutes: 90, batchTimes: ["16:30"], traps: [], milestones: [], completedDiagnostic: false });
  function norm(p) {
    p.mission ??= ""; p.actAs ??= ""; p.values ??= []; p.longGoals ??= []; p.midGoals ??= []; p.roles ??= []; p.weeks ??= {}; p.days ??= {};
    for (const v of p.values) v.detail ??= "";
    for (const g of [...p.longGoals, ...p.midGoals]) { g.target ??= ""; g.done ??= false; }
    for (const w of Object.values(p.weeks)) { w.rocks ??= []; w.saw ??= {}; w.sawDone ??= {}; for (const r of w.rocks) { r.done ??= false; r.scheduled ??= false; } }
    for (const d of Object.values(p.days)) { d.record ??= []; d.planned ??= false; d.closed ??= false; }
    if (p.profile) p.profile = { ...blankProfile(), ...p.profile };
    return p;
  }
  const data = () => norm(F.planner() || {});
  const weekKey = (d) => D.key(D.weekStart(d));
  const week = (p, d = new Date()) => p.weeks[weekKey(d)] || { rocks: [], saw: {}, sawDone: {} };
  const updWeek = (p, d, f) => { const k = weekKey(d); const w = p.weeks[k] || { rocks: [], saw: {}, sawDone: {} }; f(w); p.weeks[k] = w; };
  const save = (f) => F.savePlanner((p) => { norm(p); f(p); norm(p); });
  const profile = () => data().profile || blankProfile();
  const isSetUp = (p = data()) => p.values.length > 0 && p.roles.length > 0;
  const ci = (a, b) => a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;

  /** Planner.merge: adds WITHOUT removing anything; skips duplicates. (Caller sets plannerSetupDone.) */
  function merge(p, { values = [], roles = [], rocks = {}, mission, actAs, goal }) {
    for (const v of values) if (!p.values.some((x) => ci(x.title, v))) p.values.push({ id: F.uuid(), title: v, detail: "" });
    for (const r of roles) if (!p.roles.some((x) => ci(x.name, r))) p.roles.push({ id: F.uuid(), name: r });
    if (mission != null && !p.mission.trim()) p.mission = mission;
    if (actAs != null && !p.actAs.trim()) p.actAs = actAs;
    if (goal && !p.longGoals.some((g) => g.title === goal)) p.longGoals.push({ id: F.uuid(), title: goal, target: "", done: false });
    const list = Object.entries(rocks).map(([role, title]) => { const r = p.roles.find((x) => ci(x.name, role)); return r ? { id: F.uuid(), roleID: r.id, title, done: false, scheduled: false } : null; }).filter(Boolean);
    if (list.length) updWeek(p, new Date(), (w) => { for (const b of list) if (!w.rocks.some((x) => x.title === b.title)) w.rocks.push(b); });
  }

  // ================================================================ the 6 questions (DiagnosticQuestion.all, exact wording)
  const QUESTIONS = [
    { id: 1, title: "The regret & legacy filter",
      prompt: "Think about a week that felt completely wasted versus a week where you felt deeply fulfilled. What was the single biggest difference between the two?",
      why: "Your answer shows your governing values, what makes a week worth it. They become the top of your pyramid and your daily Act As card.",
      chips: ["Uninterrupted deep focus", "Being fully present with loved ones", "Making visible progress on big goals", "Feeling calm and in control of my time"],
      placeholder: "e.g. I got to be with my kids and still finished the big stuff" },
    { id: 2, title: "The jar & sand audit",
      prompt: "What usually hijacks your day when you had every intention of getting real work done?",
      why: "These are your Quadrant III traps: urgent, not important. We defend your calendar with a crisis buffer and a set time to batch the reactive work.",
      chips: ["Last-minute messages & emails", "Unexpected family or home errands", "Saying yes to too many requests", "Context switching & digital distractions"],
      placeholder: "e.g. texts and emails that pull me off track" },
    { id: 3, title: "The hat-switching inventory",
      prompt: "When you close your laptop or finish your main shift, what other 'hats' do people in your life count on you to wear?",
      why: "These are your roles, the spokes of your Weekly Compass. Personal roles sit right next to your career so none of them gets starved.",
      chips: ["Spouse / Partner", "Parent / Caregiver", "Household & Finance Manager", "Community / Mentor / Friend"],
      placeholder: "e.g. dad, husband, I coach my son's team" },
    { id: 4, title: "Energy peak & chronotype",
      prompt: "During which 2-hour window of the day is your brain sharpest, and when does your energy hit a wall?",
      why: "Your sharpest window becomes a protected Quadrant II deep-work block for your A1. Your slump is where the low-stakes C tasks go.",
      chips: ["Early Morning (6 AM – 9 AM)", "Mid-Morning (9 AM – 12 PM)", "Afternoon (1 PM – 4 PM)", "Late Evening (8 PM – 11 PM)"],
      placeholder: "e.g. sharpest 9 to 11, I crash around 3" },
    { id: 5, title: "The neglect detector",
      prompt: "What is one personal habit that always gets cut first when life gets crazy, even though cutting it makes everything harder?",
      why: "That's your keystone self-renewal habit, sharpening the saw. It becomes a weekly Big Rock for your Self-Renewal role, so it's protected instead of cut.",
      chips: ["Exercise & movement", "Consistent sleep & wind-down", "Reading, learning & quiet time", "Healthy meal prep & hydration"],
      placeholder: "e.g. my morning run" },
    { id: 6, title: "The needle-mover test",
      prompt: "If you could fast-forward 90 days and celebrate one breakthrough that took huge pressure off your shoulders, what would it be?",
      why: "That's your 90-day goal. You'll get weekly milestones for it, and I'll speak up if your A tasks stop moving it forward.",
      chips: ["Launch or finish a major work project", "Get finances & budgets completely organized", "Establish a sustainable health routine", "Clear my backlog & build a daily system"],
      placeholder: "e.g. land a senior role" },
  ];

  // ================================================================ DiagnosticMapping.build
  const VALUE_MAP = [
    [/focus|deep work|concentrat|uninterrupted|flow/, "Deep focus", "focused", "protects deep-work time"],
    [/present|loved ones|family|kids|children|wife|husband|partner|son|daughter/, "Family comes first", "present", "is fully present with the people I love"],
    [/progress|big goals|goal|accomplish|achiev|finish|(got|get|getting) (a lot|things|stuff|the big stuff|it) done|big stuff|productive/, "Meaningful progress", "purposeful", "moves the big goals forward every day"],
    [/calm|peace|in control|control of my time|stress|overwhelm|rushed/, "Peace of mind", "calm", "stays in control of my time"],
    [/health|exercise|gym|sleep|energy|run/, "Health and energy", "energized", "takes care of my body"],
    [/faith|god|church|pray|spirit/, "Faith", "faithful", "lives by my faith"],
    [/money|debt|financ|bills|savings/, "Financial security", "responsible", "makes careful choices with money"],
    [/learn|grow|read|study/, "Keep learning", "curious", "keeps learning"],
    [/honest|integrity|trust|my word/, "Integrity", "honest", "keeps my word"],
    [/help|serve|give|volunteer|others/, "Serve others", "generous", "shows up for others"],
    [/creat|music|art|write|design|build/, "Creativity", "creative", "makes time to create"],
  ];
  function build(answers) {
    const r = { values: [], actAs: "", roles: [], careerRole: "Career", bufferMinutes: 90, batchTimes: [], traps: [], peak: { h: 9, m: 0 }, focusMinutes: 120,
                slump: null, keystone: "", keystoneTask: "", ninetyDay: "", milestones: [], milestoneRole: "Career" };
    const words = (n) => { const a = answers[n]; return ((a ? [...a.chips].sort().join(". ") : "") + ". " + (a?.text || "")).toLowerCase(); };
    // 1 → 2–3 governing values + Act As card
    const w1 = words(1);
    const hits = VALUE_MAP.filter((v) => has(w1, v[0]));
    r.values = hits.map((h) => h[1]).slice(0, 3);
    if (r.values.length < 2) for (const v of ["Peace of mind", "Meaningful progress"]) if (r.values.length < 2 && !r.values.includes(v)) r.values.push(v);
    const top = hits.slice(0, 2);
    r.actAs = !top.length ? "I act as a calm, focused person who moves what matters forward."
      : `I act as a ${top.map((h) => h[2]).join(", ")} person who ` + top.map((h) => h[3]).join(" and ") + ".";
    // 2 → Quadrant III traps → crisis buffer + batch & triage
    const w2 = words(2);
    r.bufferMinutes = has(w2, /family|home|errand|kid|unexpected|yes|request/) ? 120 : 90;
    if (has(w2, /message|email|text|slack|notification|inbox|calls?/)) { r.batchTimes = [{ h: 11, m: 30 }, { h: 16, m: 30 }]; r.traps.push("Messages & email"); }
    else r.batchTimes = [{ h: 16, m: 30 }];
    if (has(w2, /family|home|errand/)) r.traps.push("Home & family errands");
    if (has(w2, /yes|request|favor/)) r.traps.push("Saying yes too often");
    if (has(w2, /switch|distract|phone|social|scroll|digital/)) r.traps.push("Context switching");
    // 3 → Weekly Compass roles
    const w3 = words(3);
    r.careerRole = has(w3, /student|school/) ? "Student" : "Career";
    const roles = [r.careerRole];
    const roleMap = [[/spouse|partner|husband|wife|girlfriend|boyfriend/, "Partner"], [/parent|caregiver|dad|father|mom|mother|kids/, "Parent"],
      [/household|finance|house|home|bills|budget/, "Home & Finances"], [/community|mentor|friend|volunteer|church|neighbor/, "Community"],
      [/coach/, "Coach"], [/side business|seminar|creator|founder|freelance/, "Side business"], [/my (mom|dad|mother|father|parents)\b|aging parent|care for my/, "Son or daughter"]];
    for (const [p, name] of roleMap) if (has(w3, p) && !roles.includes(name) && roles.length < 5) roles.push(name);
    r.roles = roles;
    // 4 → energy peak + slump
    const w4 = words(4), t4 = answers[4]?.text || "";
    if (has(w4, /early morning|6 am/)) r.peak = { h: 6, m: 30 };
    else if (has(w4, /mid-morning|9 am – 12|9 to 12/)) r.peak = { h: 9, m: 0 };
    else if (has(w4, /afternoon \(1|1 pm – 4/)) r.peak = { h: 13, m: 0 };
    else if (has(w4, /late evening|8 pm/)) r.peak = { h: 20, m: 0 };
    const parts = t4.toLowerCase().split(/[,;.]/).flatMap((s) => s.split(" and "));
    for (const part of parts) {
      if (!has(part, /\d|noon|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve/)) continue;
      const at = timeIn(part); if (!at) continue;
      if (has(part, /crash|wall|slump|tired|drag|dip|fade|dead/)) r.slump = at;
      else if (has(part, /sharp|best|peak|focus|clear|good/) || (r.peak.h === 9 && r.peak.m === 0)) r.peak = at;
    }
    if (!r.slump) r.slump = r.peak.h >= 12 && r.peak.h <= 16 ? { h: 17, m: 0 } : { h: 14, m: 0 };
    // 5 → Self-Renewal role + keystone habit
    if (!r.roles.includes("Self-Renewal")) r.roles.unshift("Self-Renewal");
    const w5 = words(5), t5 = (answers[5]?.text || "").trim();
    const keystones = [[/exercise|movement|run|gym|walk|work ?out|working out|lift|training|sports?/, "Exercise & movement", "Exercise three times this week"],
      [/sleep|wind.down|bed/, "Sleep & wind-down", "In bed by 10:30 five nights"],
      [/read|learn|quiet|pray|journal|meditat/, "Reading & quiet time", "Read or reflect 20 minutes, four days"],
      [/meal|food|eat|hydrat|water|cook/, "Meal prep & hydration", "Prep healthy meals for the week"]];
    const k = keystones.find((x) => has(w5, x[0]));
    if (k) { r.keystone = k[1]; r.keystoneTask = k[2]; }
    if (t5 && !r.keystone) {
      const kk = t5.replace(/\s+(always |usually |is always )?(gets? cut( first)?|goes first|is the first (thing )?to go|falls off|drops off|slips)\b.*$/i, "")
        .replace(/^(i (always |usually )?(skip|stop|drop|cut|give up)|probably|definitely|my)\s+/i, "");
      r.keystone = taskPhrase(kk); r.keystoneTask = r.keystone + ", three times this week";
    }
    // 6 → 90-day goal + weekly milestones
    const w6 = words(6), t6 = (answers[6]?.text || "").trim();
    const goals = [[/launch|major work project|finish .*project|ship/, "Launch or finish the major work project", ["Define done and list every remaining piece", "Finish the hardest piece first", "Review, fix and set the launch date"], r.careerRole],
      [/financ|budget|money|debt|bills/, "Get finances and budgets completely organized", ["List every account, bill and debt", "Build a monthly budget", "Automate bills and savings"], "Home & Finances"],
      [/health routine|sustainable health|health|fitness|weight/, "Establish a sustainable health routine", ["Pick the routine and put it on the calendar", "Do it three times this week", "Add sleep and meal habits"], "Self-Renewal"],
      [/backlog|daily system|organized|clear my/, "Clear my backlog and build a daily system", ["Brain-dump every open loop onto the master list", "Sort the list into A, B, C and quadrants", "Plan every morning and close out every night"], r.careerRole],
      [/job|role|hired|offer|career/, "Land the right role", ["Tailor the resume and pick 10 target roles", "Apply to five roles and reach out to three contacts", "Prepare stories and follow up on every application"], r.careerRole]];
    const g = goals.find((x) => has(w6, x[0]));
    if (g) { r.ninetyDay = t6 ? taskPhrase(t6) : g[1]; r.milestones = g[2]; r.milestoneRole = g[3]; }
    else if (t6) {
      r.ninetyDay = taskPhrase(t6);
      r.milestones = [`Define what done looks like for: ${r.ninetyDay}`, "Take the first real step", "Review progress and adjust"];
      r.milestoneRole = r.careerRole;
    }
    if (!r.roles.includes(r.milestoneRole) && r.roles.length < 6) r.roles.push(r.milestoneRole);
    return r;
  }

  // ================================================================ DefensePlan
  /** DefensePlan.bufferStart */
  function bufferStart(peak, focusMinutes = 120, bufferMinutes = 90, slump = null, batch = []) {
    const m = (c) => c.h * 60 + c.m;
    const busy = [[m(peak), m(peak) + focusMinutes]];
    if (slump) busy.push([m(slump), m(slump) + 60]);
    for (const b of batch) busy.push([m(b), m(b) + 30]);
    for (const start of [870, 630, 780, 930, 480, 1005, 1050]) {
      const end = start + bufferMinutes;
      if (!busy.some(([a, b]) => a < end && b > start)) return { h: Math.floor(start / 60), m: start % 60 };
    }
    return { h: 14, m: 30 };
  }
  /** DefensePlan.apply: queues apply_defense for the phone and returns what will be made (for the toast). */
  async function applyDefense({ peak, focusMinutes, bufferMinutes, batchTimes, slump, focus, buffer, batch, cWindow }) {
    await F.cmd("apply_defense", { peak: hm(peak), focusMinutes, bufferMinutes, batchTimes: batchTimes.map(hm), slump: slump ? hm(slump) : null, focus, buffer, batch, cWindow });
    const made = [];
    if (focus) made.push(`deep work at ${tm(peak)}`);
    if (buffer) made.push(`buffer at ${tm(bufferStart(peak, focusMinutes, bufferMinutes, cWindow ? slump : null, batch ? batchTimes : []))}`);
    if (batch) batchTimes.slice(0, 2).forEach((b) => made.push(`batch & triage at ${tm(b)}`));
    if (cWindow && slump) made.push(`C-task window at ${tm(slump)}`);
    return made;
  }
  /** DiagnosticMapping.saveSettings (on a planner being mutated) */
  function saveSettings(p, r) {
    const pr = p.profile || blankProfile();
    pr.peakHour = r.peak.h; pr.peakMinute = r.peak.m; pr.peakMinutes = r.focusMinutes;
    if (r.slump) pr.slumpHour = r.slump.h; else delete pr.slumpHour;
    pr.bufferMinutes = r.bufferMinutes;
    pr.batchTimes = r.batchTimes.map(hm);
    if (r.traps?.length) pr.traps = r.traps;
    if (r.keystone) pr.keystone = r.keystone;
    if (r.milestones?.length) pr.milestones = r.milestones;
    p.profile = pr;
  }

  /** DiagnosticSave.save */
  async function diagnosticSave(r, values, roles, { focus, buffer, batch, cWindow, keystone }) {
    let addKeystoneTodo = false;
    await save((p) => {
      merge(p, { values, roles, actAs: r.actAs });
      if (r.actAs) p.actAs = r.actAs;
      saveSettings(p, r);
      const pr = p.profile;
      const selfRole = p.roles.find((x) => x.name === "Self-Renewal");
      if (keystone && r.keystoneTask && selfRole) {
        updWeek(p, new Date(), (w) => { if (!w.rocks.some((x) => x.title === r.keystoneTask)) w.rocks.push({ id: F.uuid(), roleID: selfRole.id, title: r.keystoneTask, done: false, scheduled: false }); });
        pr.keystone = r.keystoneTask;
        addKeystoneTodo = !openTodos().some((t) => t.title === r.keystoneTask);
      }
      if (r.ninetyDay) {
        const target = D.md(D.add(new Date(), 90));
        let g = p.midGoals.find((x) => x.title === r.ninetyDay);
        if (!g) { g = { id: F.uuid(), title: r.ninetyDay, target: `by ${target}`, done: false }; p.midGoals.push(g); }
        pr.needleGoalID = g.id;
        const role = p.roles.find((x) => x.name === r.milestoneRole) || p.roles[0];
        if (role) r.milestones.slice(0, 3).forEach((m, i) => updWeek(p, D.add(new Date(), 7 * i), (w) => { if (!w.rocks.some((x) => x.title === m)) w.rocks.push({ id: F.uuid(), roleID: role.id, title: m, done: false, scheduled: false }); }));
      }
      pr.completedDiagnostic = true;
      p.profile = pr;
    });
    await F.setPref("plannerSetupDone", "1");
    if (addKeystoneTodo) await F.cmd("add_todo", { title: r.keystoneTask, due: D.key(today()), repeat: "weekly", quadrant: 2, bigRock: true, role: "Self-Renewal" });
    return applyDefense({ peak: r.peak, focusMinutes: r.focusMinutes, bufferMinutes: r.bufferMinutes, batchTimes: r.batchTimes, slump: r.slump, focus, buffer, batch, cWindow });
  }

  // ================================================================ starter profiles (OrganizerPreset.all, exact)
  const PRESETS = [
    { id: "exec", name: "Corporate Leader", blurb: "Leading a team, protecting focus time, keeping family in the picture.", icon: "briefcase",
      mission: "I lead with integrity, grow the people around me, and protect time for what matters at home.",
      values: ["Integrity", "Family comes first", "Health and energy", "Keep learning"],
      roles: ["Self-Renewal", "Leader", "Partner", "Parent", "Community"],
      rocks: { Leader: "One-on-ones with each direct report", Partner: "Date night", "Self-Renewal": "Exercise three times" },
      actAs: "I act as a calm, decisive leader who protects deep-work time and listens fully.",
      goal: "Grow into a senior leadership role within three years",
      starter: ["Prepare for the most important meeting this week", "Answer priority email in one batch", "Tidy the shared drive"] },
    { id: "founder", name: "Solo Founder / Creator", blurb: "Building a business while staying healthy and connected.", icon: "lightbulb",
      mission: "I build something useful, serve my customers honestly, and don't trade my health or family for it.",
      values: ["Serve customers", "Financial security", "Health and energy", "Family comes first"],
      roles: ["Self-Renewal", "Founder", "Sales & Marketing", "Family", "Finances"],
      rocks: { Founder: "Ship one improvement customers asked for", "Sales & Marketing": "Five sales conversations", "Self-Renewal": "Walk every morning" },
      actAs: "I act as a focused builder who finishes what matters first.",
      goal: "Make the business my full-time income",
      starter: ["Ship one improvement customers asked for", "Follow up with two leads", "Organize receipts"] },
    { id: "parent", name: "Busy Parent & Professional", blurb: "Work, kids, home: keeping all of it moving without losing yourself.", icon: "figure.and.child.holdinghands",
      mission: "I raise my kids with patience, do honest work, and keep our home a place of rest.",
      values: ["Family comes first", "Patience", "Faith", "Financial security"],
      roles: ["Self-Renewal", "Parent", "Partner", "Professional", "Home & Finances"],
      rocks: { Parent: "One-on-one time with each kid", "Home & Finances": "Plan meals and the budget", "Self-Renewal": "Two quiet mornings" },
      actAs: "I act as a patient, present parent and a steady professional.",
      goal: "Pay off debt and build three months of savings",
      starter: ["Finish the top work task before noon", "Plan this week's meals", "Sort the mail pile"] },
    { id: "student", name: "Student / Researcher", blurb: "Courses, research and a life outside of both.", icon: "graduationcap",
      mission: "I learn deeply, do careful work, and stay connected to the people who support me.",
      values: ["Keep learning", "Integrity", "Health and energy", "Friendship"],
      roles: ["Self-Renewal", "Student", "Researcher", "Friend", "Family"],
      rocks: { Student: "Finish the problem set early", Researcher: "Draft the methods section", "Self-Renewal": "Sleep eight hours five nights" },
      actAs: "I act as a curious, disciplined learner.",
      goal: "Finish my degree with work I'm proud of",
      starter: ["Two hours on the hardest assignment", "Email the advisor with questions", "Clean up notes"] },
    { id: "seeker", name: "Job seeker", blurb: "Landing the next role while keeping momentum and morale.", icon: "magnifyingglass",
      mission: "I keep moving toward the right role with steady effort, honest applications, and care for my family.",
      values: ["Family comes first", "Integrity", "Keep learning", "Financial security"],
      roles: ["Self-Renewal", "Job seeker", "Family", "Home & Finances", "Network"],
      rocks: { "Job seeker": "Apply to five roles that fit", Network: "Reach out to three contacts", "Self-Renewal": "Exercise three times" },
      actAs: "I act as a confident professional who keeps moving forward.",
      goal: "Land a senior role that fits my strengths",
      starter: ["Tailor the resume for the best-fit role", "Reach out to one contact", "Update LinkedIn headline"] },
  ];
  const ARCHETYPES = PRESETS.filter((p) => ["exec", "founder", "parent", "student"].includes(p.id));
  /** OrganizerPreset.sections */
  function sections(pr) {
    const out = [
      ["Values", pr.values.map((v) => ({ key: "v:" + v, text: v }))],
      ["Roles", pr.roles.map((r) => ({ key: "r:" + r, text: r }))],
      ["Mission, Act As and goal", [{ key: "m", text: pr.mission, note: "Mission" }, { key: "a", text: pr.actAs, note: "Act As card" }, { key: "g", text: pr.goal, note: "Long-range goal" }]],
      ["This week's Big Rocks", Object.keys(pr.rocks).sort().map((k) => ({ key: "k:" + k, text: pr.rocks[k], note: k }))],
    ];
    if (pr.starter.length) out.push(["Tasks for today (optional)", pr.starter.slice(0, 3).map((t, i) => ({ key: "t:" + t, text: t, note: ["A1", "B1", "C1"][i] }))]);
    return out;
  }
  /** OrganizerPreset.apply: adds only what he checked. */
  async function applyPreset(pr, picked) {
    if (!picked.size) return 0;
    const rockPicks = Object.fromEntries(Object.entries(pr.rocks).filter(([k]) => picked.has("k:" + k)));
    const rolePicks = pr.roles.filter((r) => picked.has("r:" + r) || rockPicks[r] != null);
    const valuePicks = pr.values.filter((v) => picked.has("v:" + v));
    if (valuePicks.length || rolePicks.length || Object.keys(rockPicks).length || picked.has("m") || picked.has("a") || picked.has("g")) {
      await save((p) => merge(p, { values: valuePicks, roles: rolePicks, rocks: rockPicks,
        mission: picked.has("m") ? pr.mission : null, actAs: picked.has("a") ? pr.actAs : null, goal: picked.has("g") ? pr.goal : null }));
      await F.setPref("plannerSetupDone", "1");
    }
    const open = openTodos();
    const role = rolePicks.find((r) => r !== "Self-Renewal");
    for (const [i, title] of pr.starter.slice(0, 3).entries()) {
      if (!picked.has("t:" + title) || open.some((t) => t.title === title)) continue;
      await F.cmd("add_todo", { title, due: D.key(today()), letter: ["A", "B", "C"][i], number: 1, quadrant: [2, 3, 4][i], ...(role ? { role } : {}) });
    }
    return picked.size;
  }

  // ================================================================ shared pieces
  /** DiagnosticChip: 52pt row, square / checked square, neutral (never a color for "selected"). */
  const chip = (title, on, act, d = {}) => `<button type="button" class="dchip press${on ? " on" : ""}" data-act="${act}" ${Object.entries(d).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")} aria-pressed="${on}">
      <span class="dchip-ic">${icon(on ? "checkmark.square.fill" : "square")}</span><span class="dchip-t">${esc(title)}</span></button>`;
  const block = (title, inner, cls = "") => `<section class="card org-block ${cls}">${ui.label2(title)}${inner}</section>`;
  const toggle = (text, on, act, d = {}) => `<label class="org-toggle"><span class="grow">${esc(text)}</span><span class="switch"><input type="checkbox" role="switch" ${on ? "checked" : ""} data-change="${act}" ${Object.entries(d).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}></span></label>`;
  const summaryRow = (ic, title, detail) => `<div class="org-srow">${icon(ic, 'class="org-sic"')}<div class="v g2 grow"><span class="t15 w6 ink">${esc(title)}</span>${detail ? `<span class="t13 muted">${esc(detail)}</span>` : ""}</div></div>`;
  const warnLine = (t) => `<p class="org-warn">${icon("exclamationmark.triangle.fill")}<span>${esc(t)}</span></p>`;
  const coachBtn = () => "";   // Friday chat is iPhone/iPad only
  const autosize = (root) => root.querySelectorAll("textarea[data-grow]").forEach((t) => { const max = +t.dataset.grow; t.style.height = "auto"; const lh = 22; t.style.height = Math.min(t.scrollHeight + 2, lh * max + 34) + "px"; });

  /** Redraw a sheet but keep what he is typing (value + caret) in the focused field. */
  function redraw(api, after) {
    const ae = document.activeElement;
    const keep = ae && api.el.contains(ae) && ae.id && (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && /text|search|time/.test(ae.type))) ? { id: ae.id, v: ae.value, s: ae.selectionStart, e: ae.selectionEnd } : null;
    const wasBtn = ae && api.el.contains(ae) && ae.tagName === "BUTTON" && ae.id;
    api.update();
    after?.(api.el);
    autosize(api.el);
    if (keep) { const n = api.el.querySelector("#" + CSS.escape(keep.id)); if (n) { n.value = keep.v; n.focus(); try { n.setSelectionRange(keep.s, keep.e); } catch {} } }
    else if (wasBtn) api.el.querySelector("#" + CSS.escape(ae.id))?.focus();
  }

  // ================================================================ F.openSetup — DiagnosticSetupView
  let W = null;
  F.openSetup = function openSetup(mode = "diagnostic", opts = {}) {
    if (W?.api.el.open) W.api.close();
    const inst = W = { step: 1, answers: {}, result: null, keepValues: new Set(), keepRoles: new Set(), addFocus: false, addBuffer: false, addBatch: false, addCWindow: false, addKeystone: false,
          finished: null, why: {}, busy: false, fromHub: !!opts.fromHub };
    W.api = F.sheet({
      id: "setup",
      title: () => (W.finished != null ? "You're set up" : W.step <= 6 ? `Step ${W.step} of 6` : "Your planner"),
      leading: () => (W.finished != null ? null : { label: "Later", act: "setup-later" }),
      body: () => `<div class="org-wrap">${W.finished != null ? finishPage(W.finished) : progressHTML() + (W.step <= 6 ? questionPage(QUESTIONS[W.step - 1]) : reviewPage())}</div>`,
      foot: () => (W.finished != null ? finishFooter() : setupFooter()),
      onClose: () => { if (W === inst) W = null; },
    });
    // Esc mid-setup asks first (nothing is saved until Build); untouched or finished, it just closes
    W.api.guard = { dirty: () => W === inst && W.finished == null && !W.busy && (W.step > 1 || Object.values(W.answers).some((a) => a.chips.size || a.text.trim())),
      title: "Leave setup?", message: "Your answers aren't saved until you tap Build. You can come back to it from Settings.", leave: "Leave setup", stay: "Keep going" };
    W.api.el.classList.add("org-sheet");
    autosize(W.api.el);
    if (mode === "starter") openStarter();
    return W.api;
  };
  const wDraw = () => W && redraw(W.api);

  function progressHTML() {
    const s = W.step;
    return `<div class="v g8">${s === 1 ? `<div class="v g4"><h2 class="t24 w6 ink">Let's set up your planner</h2>
        <p class="t15 ink2">Six quick questions, one per screen. Tap the answers that fit, or type. Nothing is saved until you see it and tap Build. You can stop anytime with Later.</p></div>
        ${ui.actbar([ui.btn({ label: "Skip & Pick a Starter Profile", icon: "person.crop.rectangle.stack", kind: "small", act: "setup-starter" })])}` : ""}
      <div class="org-prog" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map((i) => `<i class="${i < s ? "done" : i === s ? "cur" : ""}"></i>`).join("")}</div>
      ${s <= 6 ? `<p class="t13 w6 muted">${esc(QUESTIONS[s - 1].title)}</p>` : ""}</div>`;
  }
  function questionPage(q) {
    const a = W.answers[q.id] || { text: "", chips: new Set() };
    const open = !!W.why[q.id];
    return `<div class="v g16">
      <h3 class="t20 w6 ink">${esc(q.prompt)}</h3>
      <div class="v g8"><p class="t13 w6 muted">Tap any that fit</p>${q.chips.map((c) => chip(c, a.chips.has(c), "setup-chip", { c })).join("")}</div>
      <div class="v g8"><label class="t13 w6 muted" for="setup-text-${q.id}">Or say it in your own words</label>
        <textarea id="setup-text-${q.id}" class="input org-ta" rows="2" data-grow="5" data-input="setup-text" data-q="${q.id}" placeholder="${esc(q.placeholder)}">${esc(a.text)}</textarea></div>
      <div class="org-dg${open ? " open" : ""}"><button type="button" class="org-dg-h" id="setup-why-${q.id}" data-act="setup-why" data-q="${q.id}" aria-expanded="${open}"><span class="t15 w5 ink">Why this question?</span><span class="sp"></span>${icon("chevron.right", 'class="org-dg-chev"')}</button>
        ${open ? `<p class="t15 ink2 org-dg-b">${esc(q.why)}</p>` : ""}</div>
    </div>`;
  }
  const answered = () => { const a = W.answers[W.step]; return !!a && (a.chips.size > 0 || a.text.trim() !== ""); };
  function setupFooter() {
    const s = W.step;
    return `<div class="h g8 setfoot">${s > 1 ? ui.btn({ label: "Back", icon: "chevron.left", act: "setup-back" }) : ""}<span class="sp"></span>
      ${s <= 6 ? `${answered() ? "" : ui.btn({ label: "Skip", act: "setup-next" })}${ui.btn({ label: s === 6 ? "See my planner" : "Next", kind: "primary", act: "setup-next", disabled: !answered() })}`
               : `<button type="button" class="btn primary" data-act="setup-build" ${W.busy ? "disabled" : ""}>${W.busy ? ui.spinner() : ""}Build my planner</button>`}</div>`;
  }
  const drawFoot = () => { const f = W?.api.el.querySelector(".sheetfoot"); if (f) f.innerHTML = W.finished != null ? finishFooter() : setupFooter(); };

  function checklist(title, items, keep, which) {
    return block(title, (items.length ? "" : '<p class="t15 muted">Nothing from your answers; add these later in the Organizer.</p>')
      + items.map((i) => chip(i, keep.has(i), "setup-keep", { w: which, v: i })).join(""));
  }
  function reviewPage() {
    const r = W.result;
    const bs = bufferStart(r.peak, r.focusMinutes, r.bufferMinutes, W.addCWindow ? r.slump : null, W.addBatch ? r.batchTimes : []);
    return `<div class="v g16">
      <div class="v g8"><h2 class="t24 w6 ink">Here's your planner</h2><p class="t15 ink2">Built from your answers. Uncheck anything that doesn't fit; change any of it later in Tasks › Organizer.</p></div>
      ${checklist("Governing values", r.values, W.keepValues, "v")}
      ${block("Act As card", `<textarea id="setup-actas" class="org-ta actas" rows="2" data-grow="4" data-input="setup-actas" placeholder="I act as…" aria-label="Act As card">${esc(r.actAs)}</textarea>`)}
      ${checklist("Weekly Compass roles", r.roles, W.keepRoles, "r")}
      ${block("Self-renewal keystone", !r.keystone ? '<p class="t15 muted">Nothing picked; you can add one later.</p>'
        : `<p class="t16 w6 ink">${esc(r.keystone)}</p>${toggle(`Add it as a weekly Big Rock and a repeating to-do: ${r.keystoneTask}`, W.addKeystone, "setup-flag", { k: "addKeystone" })}`)}
      ${block("90-day goal", `<textarea id="setup-goal" class="input org-ta goal" rows="1" data-grow="3" data-input="setup-goal" placeholder="One breakthrough in 90 days" aria-label="90-day goal">${esc(r.ninetyDay)}</textarea>
        ${r.milestones.map((m, i) => `<div class="h top g8"><span class="t13 w6 muted org-wk">Week ${i + 1}</span><span class="t15 ink grow">${esc(m)}</span></div>`).join("")}
        <p class="t13 muted" id="setup-goal-note" ${r.ninetyDay ? "" : "hidden"}>I'll speak up when your A tasks stop moving this forward.</p>`)}
      ${block("Suggested calendar blocks", `<p class="t13 muted">Off until you turn one on. Friday only adds the ones you pick.</p>
        ${r.traps.length ? warnLine(`Your traps: ${r.traps.join(", ")}`) : ""}
        ${toggle(`Deep work, ${tm(r.peak)} for 2 hours: your sharpest window, for A1 and Big Rocks`, W.addFocus, "setup-flag", { k: "addFocus" })}
        ${toggle(`Crisis buffer at ${tm(bs)}, ${Math.floor(r.bufferMinutes / 60) === 2 ? "2 hours (20%)" : "90 min (15%)"} left open`, W.addBuffer, "setup-flag", { k: "addBuffer" })}
        ${toggle("Batch & triage at " + r.batchTimes.map(tm).join(" and ") + ", 30 min each", W.addBatch, "setup-flag", { k: "addBatch" })}
        ${r.slump ? toggle(`Low-energy window at ${tm(r.slump)}, 1 hour, for C tasks`, W.addCWindow, "setup-flag", { k: "addCWindow" }) : ""}
        ${calAccess() ? "" : '<p class="t13 muted">Calendar access is off, so these are saved now and added once you allow it.</p>'}`)}
    </div>`;
  }
  function finishPage(profileName) {
    const d = data();
    const rocks = week(d).rocks.filter((r) => !r.done);
    const g = d.midGoals[d.midGoals.length - 1] || d.longGoals[d.longGoals.length - 1];
    return `<div class="v g16">
      <div class="v g8">${icon("checkmark.circle.fill", 'class="org-bigcheck"')}<h2 class="t24 w6 ink">You're set up${esc(F.withName())}</h2>
        <p class="t15 ink2">${esc(profileName ? `Started from the ${profileName} profile. Change anything later in the Organizer.` : "Built from your answers. Change anything later in the Organizer.")}</p></div>
      ${block("What you have now", summaryRow("heart", `${d.values.length} governing value${d.values.length === 1 ? "" : "s"}`, d.values.slice(0, 4).map((v) => v.title).join(", "))
        + summaryRow("person.2", `${d.roles.length} role${d.roles.length === 1 ? "" : "s"}`, d.roles.map((r) => r.name).join(", "))
        + (g ? summaryRow("flag", "Your goal", g.title) : "")
        + summaryRow("circle.grid.cross", `${rocks.length} Big Rock${rocks.length === 1 ? "" : "s"} this week`, rocks.slice(0, 3).map((r) => r.title).join(", ")), "g12")}
      ${block("Your daily rhythm", summaryRow("sunrise", "Every morning, 15 minutes", "Plan my day: list it, mark A, B, C, do A1 first.")
        + summaryRow("moon", "Every evening, 2 minutes", "Close out: mark each task done, forward or delete.")
        + summaryRow("calendar", "Sunday or Monday, 20 minutes", "Plan my week: one or two Big Rocks per role.")
        + '<p class="t13 muted">The card at the top of Brief always shows your next step. Lost? Tap Friday and say "help".</p>', "g12")}
      ${block("Where things are", summaryRow("target", "Organizer", "Top of Tasks, and on Brief. Values, roles, time matrix, rules, focus time.")
        + summaryRow("gearshape", "Redo these questions", "Settings › Your planner."), "g12")}
    </div>`;
  }
  const finishFooter = () => ui.actbar([ui.btn({ label: "Look around first", act: "sheet-close" }), ui.btn({ label: "Open the Organizer", icon: "target", act: "setup-organizer" }),
      ui.btn({ label: "Plan my day now", icon: "arrow.right", kind: "primary", act: "setup-planday" })], true);

  F.on("setup-later", () => W?.api.close());
  F.on("setup-chip", (el) => {
    const q = W.step, a = W.answers[q] || (W.answers[q] = { text: "", chips: new Set() });
    a.chips.has(el.dataset.c) ? a.chips.delete(el.dataset.c) : a.chips.add(el.dataset.c);
    wDraw();
  });
  F.onInput("setup-text", (el) => {
    const q = +el.dataset.q, a = W.answers[q] || (W.answers[q] = { text: "", chips: new Set() });
    a.text = el.value; autosize(W.api.el); drawFoot();
  });
  F.on("setup-why", (el) => { W.why[el.dataset.q] = !W.why[el.dataset.q]; wDraw(); });
  F.on("setup-back", () => { W.step -= 1; wDraw(); W.api.el.querySelector(".sheetbody").scrollTop = 0; });
  F.on("setup-next", () => {
    W.step += 1;
    if (W.step === 7) { W.result = build(W.answers); W.keepValues = new Set(W.result.values); W.keepRoles = new Set(W.result.roles); }
    wDraw(); W.api.el.querySelector(".sheetbody").scrollTop = 0;
  });
  F.on("setup-keep", (el) => { const s = el.dataset.w === "v" ? W.keepValues : W.keepRoles; s.has(el.dataset.v) ? s.delete(el.dataset.v) : s.add(el.dataset.v); wDraw(); });
  F.onChange("setup-flag", (el) => { W[el.dataset.k] = el.checked; wDraw(); });
  F.onInput("setup-actas", (el) => { W.result.actAs = el.value; autosize(W.api.el); });
  F.onInput("setup-goal", (el) => { W.result.ninetyDay = el.value; autosize(W.api.el); const n = W.api.el.querySelector("#setup-goal-note"); if (n) n.hidden = !el.value; });
  F.on("setup-build", async () => {
    if (W.busy) return;
    W.busy = true; drawFoot();
    try {
      const r = W.result;
      const made = await diagnosticSave(r, r.values.filter((v) => W.keepValues.has(v)), r.roles.filter((v) => W.keepRoles.has(v)),
        { focus: W.addFocus, buffer: W.addBuffer, batch: W.addBatch, cWindow: W.addCWindow, keystone: W.addKeystone });
      if (made.length) F.toast("On your calendar: " + made.join(", ") + ".");
      W.finished = ""; W.busy = false; wDraw(); W.api.el.querySelector(".sheetbody").scrollTop = 0;
      H && hDraw();
    } catch (e) { W.busy = false; drawFoot(); throw e; }
  });
  F.on("setup-planday", () => {
    const fromHub = W?.fromHub; W?.api.close();
    if (fromHub) H?.api.close();
    setTimeout(() => F.openTasks?.("day", F.D.key(new Date())), 300);
  });
  F.on("setup-organizer", () => { W?.api.close(); if (H?.api.el.open) { H.module = null; hDraw(); } else F.openOrganizer(); });
  F.on("setup-starter", () => openStarter());

  // ================================================================ StarterProfileSheet + StarterChecklist
  let ST = null;
  function openStarter() {
    ST = { chosen: null, picked: new Set(), busy: false };
    ST.api = F.sheet({
      id: "starter",
      title: () => ST.chosen?.name || "Starter profiles",
      leading: { label: "Back", act: "starter-back" },
      body: () => `<div class="org-wrap g16">${ST.chosen ? starterChecklist(ST.chosen) : starterProfiles()}</div>`,
      foot: () => (ST.chosen ? `<button type="button" class="btn primary wide" data-act="starter-add" ${!ST.picked.size || ST.busy ? "disabled" : ""}>${ST.busy ? ui.spinner() : ""}${esc(ST.picked.size ? `Add ${ST.picked.size} selected` : "Check what you want to add")}</button>` : ""),
    });
    ST.api.el.classList.add("org-sheet");
  }
  const stDraw = () => ST && redraw(ST.api);
  function starterProfiles() {
    return `<p class="t15 ink2">Pick the one closest to your life. Next you'll see its suggestions (values, roles, Big Rocks, a few tasks) and check only the ones you want. Nothing is added on its own.</p>
      ${ARCHETYPES.map((p) => `<button type="button" class="plain card org-pcard press" data-act="starter-pick" data-id="${p.id}" aria-description="Shows this profile's suggestions so you can pick">
        <span class="org-tile">${icon(p.icon)}</span>
        <span class="v g4 grow"><span class="t16 w6 ink">${esc(p.name)}</span><span class="t13 muted">${esc(p.blurb)}</span><span class="t12 ink2">${esc("Roles: " + p.roles.join(", "))}</span></span>
        ${icon("chevron.right", 'class="chev org-pchev"')}</button>`).join("")}`;
  }
  function starterChecklist(pr) {
    return `<p class="t15 ink2">${esc(`These are suggestions from the ${pr.name} profile. Nothing is added until you check it and tap Add.`)}</p>
      ${sections(pr).map(([title, items], si) => {
        const all = items.every((i) => ST.picked.has(i.key));
        return `<section class="card org-block"><div class="h">${ui.label2(title)}<span class="sp"></span>
          <button type="button" class="btn small" data-act="starter-all" data-s="${si}" aria-label="${esc((all ? "Clear " : "Select all ") + title)}">${all ? "Clear" : "Select all"}</button></div>
          ${items.map((it) => chip(it.note ? `${it.note}: ${it.text}` : it.text, ST.picked.has(it.key), "starter-item", { k: it.key })).join("")}</section>`;
      }).join("")}`;
  }
  F.on("starter-back", () => { if (ST.chosen) { ST.chosen = null; ST.picked = new Set(); stDraw(); ST.api.el.querySelector(".sheetbody").scrollTop = 0; } else ST.api.close(); });
  F.on("starter-pick", (el) => { ST.picked = new Set(); ST.chosen = PRESETS.find((p) => p.id === el.dataset.id); stDraw(); ST.api.el.querySelector(".sheetbody").scrollTop = 0; });
  F.on("starter-item", (el) => { const k = el.dataset.k; ST.picked.has(k) ? ST.picked.delete(k) : ST.picked.add(k); stDraw(); });
  F.on("starter-all", (el) => {
    const keys = sections(ST.chosen)[+el.dataset.s][1].map((i) => i.key);
    const all = keys.every((k) => ST.picked.has(k));
    keys.forEach((k) => (all ? ST.picked.delete(k) : ST.picked.add(k))); stDraw();
  });
  F.on("starter-add", async () => {
    if (ST.busy || !ST.picked.size) return;
    ST.busy = true; stDraw();
    try {
      const pr = ST.chosen;
      await applyPreset(pr, ST.picked);
      ST.api.close(); ST = null;
      if (W?.api.el.open) { W.finished = pr.name; wDraw(); }
      H && hDraw();
    } catch (e) { if (ST) { ST.busy = false; stDraw(); } throw e; }
  });

  // ================================================================ PlannerResetButton + confirm sheet
  const BACKUP_KEY = "friday.plannerBackup";
  const readBackup = () => { try { return localStorage.getItem(BACKUP_KEY); } catch { return null; } };
  function resetButtonHTML() {
    return `<div class="v g8">${ui.actbar([readBackup() ? ui.btn({ label: "Restore my last backup", kind: "small", act: "org-restore" }) : "", ui.btn({ label: "Start from zero", kind: "destructive", cls: "small", act: "org-reset" })])}
      <p class="t13 muted">Clears values, roles, goals, Big Rocks and setup answers, including anything a starter profile added. Your to-dos and calendar events stay. A backup is saved first.</p></div>`;
  }
  let RS = null;
  F.openPlannerReset = () => openReset();
  F.on("org-reset", () => openReset());
  function openReset() {
    RS = { endBlocks: true, busy: false };
    const hasBlocks = () => DEFENSE_KEYS.some(hasBlock);
    RS.api = F.sheet({
      id: "reset", title: "Start from zero", leading: { label: "Cancel" },
      body: () => `<div class="v g16">
        <h2 class="t20 w6 ink">Start your planner from zero?</h2>
        <p class="t15 ink2">This clears your values, roles, mission, goals, Big Rocks, daily pages and setup answers. Your to-dos and your own calendar events are not touched. A backup copy is saved first, so you can restore it.</p>
        ${hasBlocks() ? chip("Also end the focus, buffer and batch blocks Friday put on my calendar", RS.endBlocks, "reset-blocks") : ""}
        ${ui.actbar([ui.btn({ label: "Keep everything", act: "sheet-close" }),
          `<button type="button" class="btn destructive confirm" data-act="reset-go" ${RS.busy ? "disabled" : ""}>${RS.busy ? ui.spinner() : ""}Clear my planner</button>`], true)}</div>`,
    });
    RS.api.el.classList.add("org-sheet", "org-half");
    RS.hasBlocks = hasBlocks;
  }
  F.on("reset-blocks", () => { RS.endBlocks = !RS.endBlocks; redraw(RS.api); });
  F.on("reset-go", async () => {
    if (RS.busy) return;
    RS.busy = true; redraw(RS.api);
    try {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(data())); } catch {}
      const end = RS.endBlocks && RS.hasBlocks();
      await save((p) => { for (const k of Object.keys(p)) delete p[k]; });
      await F.setPref("plannerSetupDone", "0");
      if (end) await F.cmd("remove_defense", { keys: DEFENSE_KEYS });
      RS.api.close(); RS = null;
      F.toast("Planner cleared. A backup was saved; tap Restore to undo.");
      H && hDraw();
    } catch (e) { if (RS) { RS.busy = false; redraw(RS.api); } throw e; }
  });
  F.on("org-restore", async () => {
    const b = readBackup(); if (!b) return;
    let p; try { p = norm(JSON.parse(b)); } catch { return; }
    await save((x) => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, p); });
    await F.setPref("plannerSetupDone", p.values.length || p.roles.length ? "1" : "0");
    F.toast("Your planner is back the way it was before the reset.");
    H && hDraw();
  });

  // ================================================================ F.openOrganizer — OrganizerHubView + OrganizerModuleView
  const MODULES = [
    { key: "values", name: "Values & Mission", icon: "heart", why: "What matters most, your mission and your Act As card. The top of the pyramid." },
    { key: "goals", name: "Goals", icon: "flag", why: "Where you're headed: long-range goals (1 to 5 years) and the milestones that get you there. Tap any line to change it." },
    { key: "roles", name: "Roles & Weekly Compass", icon: "person.2", why: "The hats you wear and this week's Big Rocks for each one." },
    { key: "matrix", name: "Time Matrix", icon: "square.grid.2x2", why: "Sort work by urgent and important so Quadrant II gets your best time." },
    { key: "engine", name: "Task Engine", icon: "checklist", why: "How A-B-C priorities and the end-of-day marks work, and the rules you want." },
    { key: "energy", name: "Energy & Calendar Defense", icon: "bolt.shield", why: "Your energy peak, a daily focus block for Big Rocks, a buffer for surprises, and set times to batch messages." },
  ];
  const modOf = (m) => (m ? MODULES.find((x) => x.key === m || x.name === m) : null);
  let H = null;
  F.openPlannerSetup = () => F.openSetup("diagnostic");
  F.openOrganizer = function openOrganizer(module) {
    if (H?.api.el.open) { H.module = modOf(module)?.key || null; hDraw(); return H.api; }
    H = { module: modOf(module)?.key || null, focus: null, energy: null, drafts: {}, saved: null };
    H.api = F.sheet({
      id: "organizer", size: "large",
      title: () => (H.module ? modOf(H.module).name : "Organizer"),
      leading: () => (H.module ? { label: "Organizer", act: "org-home" } : null),
      trailing: () => (H.module ? null : { label: "Done", act: "sheet-close" }),
      body: () => `<div class="org-wrap">${H.module ? moduleView(modOf(H.module)) : hubView()}</div>`,
      onClose: () => { H = null; },
    });
    H.api.el.classList.add("org-sheet");
    H.api.refresh = () => hDraw();
    paintBar(H.api.el);
    autosize(H.api.el);
    return H.api;
  };
  /** The pushed module shows the system back button ("‹ Organizer"), not a gray SheetBar button. */
  function paintBar(el) {
    const b = el.querySelector('.sheetbar [data-act="org-home"]');
    if (b) { b.className = "btn link org-back"; b.innerHTML = icon("chevron.left") + '<span class="org-back-t">Organizer</span>'; b.setAttribute("aria-label", "Organizer"); }
  }
  const hDraw = () => H && redraw(H.api, paintBar);
  F.on("org-home", () => { H.module = null; H.focus = null; H.energy = null; H.saved = null; hDraw(); H.api.el.querySelector(".sheetbody").scrollTop = 0; });
  F.on("org-module", (el) => { H.module = el.dataset.m; H.focus = null; H.energy = null; H.saved = null; hDraw(); H.api.el.querySelector(".sheetbody").scrollTop = 0; });
  F.on("org-quick", (el) => F.openSetup(el.dataset.m, { fromHub: true }));

  function quickStartCard(p) {
    const setUp = isSetUp(p);
    return `<section class="card org-block ${setUp ? "" : "edge-friday"}">
      ${ui.label2(setUp ? "Start over or add more" : "Start here", setUp ? "" : "friday")}
      <p class="t15 ink2">${setUp ? "Answer the 6 questions again, add from a ready-made profile, or start from zero." : "Set up your planner first: six quick questions, about three minutes. Or pick a ready-made profile."}</p>
      ${ui.actbar([ui.btn({ label: "Pick a starter profile", kind: "small", act: "org-quick", data: { m: "starter" } }),
        ui.btn({ label: setUp ? "Redo the 6 questions" : "Start the 6 questions", kind: "small", cls: setUp ? "" : "tinted", act: "org-quick", data: { m: "diagnostic" } })])}
      ${setUp || readBackup() ? `<hr class="org-div">${resetButtonHTML()}` : ""}</section>`;
  }
  function pyramid(p) {
    const t0 = today();
    const rows = [["Values", p.values.length], ["Goals", p.longGoals.length], ["Roles", p.roles.length], ["Big Rocks this week", week(p).rocks.length],
      ["Today's A-B-C tasks", openTodos().filter((t) => t.fc.letter && t.due && D.same(t.due, t0)).length]];
    // every level is a TAB into the planner, like the paper binder: tap it and you're on that page, ready to type
    const go = ["values", "goals", "roles", "roles", ""];
    rows[0][0] = "Values & mission"; rows[1][1] = p.longGoals.length + p.midGoals.length;
    return `<div class="v g8">${ui.label2("Turn to a page")}<div class="org-pyr">${rows.map((r, i) =>
      `<button type="button" class="plain org-pyr-row press" style="margin:0 ${i * 8}px" ${go[i] ? `data-act="org-module" data-m="${go[i]}"` : 'data-act="org-today"'}
        aria-label="${esc(`${r[0]}, ${r[1]}`)}"><span class="ink w6">${esc(r[0])}</span><span class="sp"></span><span class="${r[1] ? "ink2" : "muted"} num w6">${r[1]}</span>${icon("chevron.right", 'class="chev"')}</button>`).join("")}</div></div>`;
  }
  function status(m, p) {
    switch (m.key) {
      case "values": return !p.values.length ? "Not set yet · start here" : `${p.values.length} values · ${p.mission ? "mission set" : "no mission yet"} · ${p.actAs ? "Act As set" : "no Act As card"}`;
      case "goals": return !p.longGoals.length && !p.midGoals.length ? "No goals yet · tap to add one" : `${p.longGoals.length} goals · ${p.midGoals.length} milestones`;
      case "roles": return !p.roles.length ? "No roles yet" : `${p.roles.length} roles · ${week(p).rocks.length} Big Rocks this week`;
      case "matrix": {
        const open = openTodos(), sorted = open.filter((t) => t.fc.quadrant != null), q2 = sorted.filter((t) => t.fc.quadrant === 2).length;
        return !sorted.length ? `${open.length} tasks not sorted yet` : `${q2} of ${sorted.length} sorted tasks in Quadrant II · ${open.length - sorted.length} to sort`;
      }
      case "engine": return "A-B-C-1-2-3 and the ✓ → • D ✗ marks · your rules";
      case "energy": { const pr = p.profile || blankProfile(); return `Peak ${tm({ h: pr.peakHour, m: pr.peakMinute })} · ` + (hasBlock("focus") ? "deep-work block on" : "no deep-work block yet"); }
    }
    return "";
  }
  /** The 90-day needle (spec "Charts and graphs"): days used ÷ 90 next to milestones done ÷ total; an invitation when there's no goal. */
  function goalCard(setUp) {
    const nd = F.ritualKit?.goal?.();
    if (!nd) return setUp ? `<section class="card org-block sec-friday">${ui.label2("90-day goal")}<p class="invite">No 90-day goal yet. Redo the 6 questions (the last one sets it) to see it here.</p></section>` : "";
    return `<section class="card org-block sec-friday">${ui.label2("90-day goal")}<p class="t16 w7 ink wrap">${esc(nd.g.title)}</p>${F.ritualKit.goalHTML(nd)}</section>`;
  }
  function hubView() {
    const p = data(), setUp = isSetUp(p);
    return `<p class="t15 ink2">Everything in your planner traces back to what matters most. Open any part, any time.</p>
      ${setUp ? "" : quickStartCard(p)}
      ${pyramid(p)}
      ${goalCard(setUp)}
      <div class="v g8">${ui.label2("More pages")}<div class="org-mods">${MODULES.filter((m) => ["matrix", "engine", "energy"].includes(m.key)).map((m) => `<button type="button" class="plain card org-mcard press" data-act="org-module" data-m="${m.key}" aria-description="${esc(m.why)}">
        <span class="org-tile">${icon(m.icon)}</span><span class="v g4 grow"><span class="t-card-title">${esc(m.name)}</span><span class="t13 muted">${esc(status(m, p))}</span></span>
        ${icon("chevron.right", 'class="chev"')}</button>`).join("")}</div></div>
      ${setUp ? quickStartCard(p) : ""}`;
  }
  function moduleView(m) {
    const body = { values: valuesModule, goals: goalsModule, roles: rolesModule, matrix: matrixModule, engine: engineModule, energy: energyModule }[m.key]();
    // the bar above names the page ("‹ Organizer" goes back); here, just what it's for
    return `<p class="t-secondary">${esc(m.why)}</p>${body}`;
  }

  // ---------- shared module pieces
  const section = (title, inner, footer) => `<div class="v g8">${ui.label2(title)}<div class="card org-block">${inner}</div>${footer ? `<p class="t13 muted">${esc(footer)}</p>` : ""}</div>`;
  const removable = (title, act, d) => `<div class="org-rrow"><span class="t16 ink grow wrap">${esc(title)}</span>
      <button type="button" class="btn icon org-trash" data-act="${act}" ${Object.entries(d).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")} aria-label="${esc("Remove " + title)}">${icon("trash")}</button></div>`;
  /** AddField: FieldBox + "Add" (disabled while empty). Drafts survive redraws. */
  const addField = (id, prompt, kind, d = {}) => {
    const v = H.drafts[id] || "";
    return `<form class="org-add" data-form="org-add" data-kind="${kind}" ${Object.entries(d).map(([k, x]) => `data-${k}="${esc(x)}"`).join(" ")}>
      <input id="${id}" class="input org-fb" name="t" type="text" placeholder="${esc(prompt)}" aria-label="${esc(prompt)}" value="${esc(v)}" data-input="org-draft" autocomplete="off" enterkeyhint="done">
      <button type="submit" class="btn" ${v.trim() ? "" : "disabled"}>Add</button></form>`;
  };
  F.onInput("org-draft", (el) => { H.drafts[el.id] = el.value; const b = el.form.querySelector("button"); b.disabled = !el.value.trim(); });
  F.onSubmit("org-add", async (fd, form) => {
    const t = (fd.t || "").trim(); if (!t) return;
    const k = form.dataset.kind, id = form.querySelector("input").id;
    H.drafts[id] = "";
    form.querySelector("input").value = ""; form.querySelector("button").disabled = true;
    if (k === "value") await save((p) => p.values.push({ id: F.uuid(), title: t, detail: "" }));
    if (k === "goal") await save((p) => p.longGoals.push({ id: F.uuid(), title: t, target: "", done: false }));
    if (k === "mile") await save((p) => p.midGoals.push({ id: F.uuid(), title: t, target: "", done: false }));
    if (k === "role") await save((p) => p.roles.push({ id: F.uuid(), name: t }));
    if (k === "rock") await save((p) => updWeek(p, new Date(), (w) => w.rocks.push({ id: F.uuid(), roleID: form.dataset.role, title: t, done: false, scheduled: false })));
    hDraw();
    H?.api.el.querySelector("#" + CSS.escape(id))?.focus();
  });

  // ---------- Values & Mission
  const VALUE_IDEAS = ["Family comes first", "Health and energy", "Integrity", "Keep learning", "Faith", "Financial security"];
  function valuesModule() {
    const p = data();
    return section("Mission", `<textarea id="org-mission" class="input org-fb" rows="2" data-grow="6" data-change="org-field" data-f="mission" placeholder="e.g. I take care of my family, do work I'm proud of, and keep growing." aria-label="Mission">${esc(p.mission)}</textarea>`,
        "A sentence or two about who you want to be, built from your values.")
      + section("Governing values", (p.values.length ? "" : '<p class="t15 muted">None yet. Add one, or tap an idea below.</p>')
        + p.values.map((v) => `<div class="org-rrow top"><div class="v g4 grow">
            <textarea id="org-v-${v.id}" class="input org-fb w6" rows="1" data-grow="3" placeholder="Value" aria-label="Value" data-change="org-gf" data-path="values.${v.id}.title">${esc(v.title)}</textarea>
            <input id="org-vd-${v.id}" class="input org-fb ink2" value="${esc(v.detail || "")}" placeholder="What it means to you (optional)" aria-label="What it means to you" data-change="org-gf" data-path="values.${v.id}.detail" autocomplete="off"></div>
          <button type="button" class="btn icon org-trash" data-act="org-del-value" data-id="${v.id}" aria-label="${esc("Delete " + v.title)}">${icon("trash")}</button></div>`).join("")
        + addField("org-add-value", "Add a value", "value")
        + `<div class="flow">${VALUE_IDEAS.filter((i) => !p.values.some((v) => v.title === i)).map((i) => ui.btn({ label: i, icon: "plus", kind: "small", act: "org-idea", data: { v: i } })).join("")}</div>`,
        "Two to five things you'd never trade away. When a day gets crowded, these decide what stays.")
      + section("Standing Act As card", `<textarea id="org-actas" class="input org-fb actas" rows="2" data-grow="4" data-change="org-field" data-f="actAs" placeholder="I act as…" aria-label="Standing Act As card">${esc(p.actAs)}</textarea>`,
        "Shows at the top of every day unless you write a different one that morning.")
      + `<button type="button" class="plain card org-mcard press" data-act="org-module" data-m="goals"><span class="org-tile">${icon("flag")}</span>
          <span class="v g4 grow"><span class="t-card-title">Goals</span><span class="t13 muted">${p.longGoals.length} goals · ${p.midGoals.length} milestones</span></span>${icon("chevron.right", 'class="chev"')}</button>`;
  }
  /** Goals: long-range goals + milestones. Every line is a field (tap and type); link, target, done, delete. */
  function goalsModule() {
    const p = data();
    const row = (g, coll) => {
      const mile = coll === "midGoals", parent = p.longGoals.find((x) => x.id === g.parentID), vn = p.values.find((v) => v.id === g.valueID)?.title || "";
      const opts = mile ? p.longGoals.map((x) => [x.id, x.title]) : p.values.map((v) => [v.id, v.title]);
      const cur = mile ? g.parentID : g.valueID, label = mile ? (parent ? `Toward: ${parent.title}` : "Link to a goal") : (vn ? `Serves: ${vn}` : "Link to a value");
      return `<div class="v g8 org-goal">
        <div class="h g8 top">${ui.check(!!g.done, "org-g-done", { id: g.id, coll }, g.title)}
          <textarea id="org-g-${g.id}" class="input org-fb grow w6 ${g.done ? "strike muted" : ""}" rows="1" data-grow="4" placeholder="${mile ? "Milestone" : "Goal"}" aria-label="${mile ? "Milestone" : "Goal"}" data-change="org-gf" data-path="${coll}.${g.id}.title">${esc(g.title)}</textarea>
          <button type="button" class="btn icon org-trash" data-act="org-del-g" data-id="${g.id}" data-coll="${coll}" aria-label="${esc("Delete " + g.title)}">${icon("trash")}</button></div>
        <div class="flow g8 org-goal-meta">
          <label class="org-menu">${ui.tag(label)}<select data-change="org-g-link" data-id="${g.id}" data-coll="${coll}" aria-label="${esc(label)}">
            <option value="" disabled ${cur ? "" : "selected"} hidden></option>
            ${opts.length ? "" : `<option disabled>${mile ? "Add a long-range goal first" : "Add a value first"}</option>`}
            ${opts.map(([id, t]) => `<option value="${id}" ${id === cur ? "selected" : ""}>${esc(t)}</option>`).join("")}
            ${cur ? '<option value="__unlink">Unlink</option>' : ""}</select></label>
          <input id="org-gt-${g.id}" class="input org-fb org-when" value="${esc(g.target || "")}" placeholder="${mile ? "By when" : "Target year"}" aria-label="${mile ? "By when" : "Target year"}" data-change="org-gf" data-path="${coll}.${g.id}.target" autocomplete="off"></div></div>`;
    };
    return section("Long-range goals", (p.longGoals.length ? "" : '<p class="t15 muted">None yet. Add your first goal below.</p>')
        + p.longGoals.map((g) => row(g, "longGoals")).join("") + addField("org-add-goal", "Add a goal", "goal"),
        "One to five years out. Tap a goal to change its words; link it to the value it serves.")
      + section("Milestones", (p.midGoals.length ? "" : '<p class="t15 muted">None yet. Add a milestone below.</p>')
        + p.midGoals.map((g) => row(g, "midGoals")).join("") + addField("org-add-mile", "Add a milestone", "mile"),
        "Steps this year, quarter or month toward a goal. Check one off when it's done.");
  }
  F.onChange("org-gf", (el) => { const [coll, id, f] = el.dataset.path.split("."); save((p) => { const x = p[coll].find((y) => y.id === id); if (x) x[f] = el.value; }); });
  F.on("org-g-done", (el) => save((p) => { const x = p[el.dataset.coll].find((y) => y.id === el.dataset.id); if (x) x.done = !x.done; }).then(() => hDraw()));
  F.on("org-del-g", (el) => {
    const coll = el.dataset.coll;
    return removeWithUndo(el, coll, el.dataset.id, (g) => (coll === "midGoals" ? `Deleted the milestone “${g.title}”` : `Deleted the goal “${g.title}”`));
  });
  F.onChange("org-g-link", (el) => save((p) => { const x = p[el.dataset.coll].find((y) => y.id === el.dataset.id); if (!x) return; const k = el.dataset.coll === "midGoals" ? "parentID" : "valueID"; if (el.value === "__unlink") delete x[k]; else x[k] = el.value; }).then(() => hDraw()));
  F.on("open-organizer", () => F.openOrganizer());
  F.on("org-compass", async () => { await F.editCompass?.(new Date()); hDraw(); });
  F.on("org-today", () => { H?.api.close(); location.hash = "tasks"; });
  F.onChange("org-field", (el) => save((p) => { p[el.dataset.f] = el.value; }));
  F.on("org-del-value", (el) => removeWithUndo(el, "values", el.dataset.id, (v) => `Deleted the value “${v.title}”`));
  F.on("org-idea", (el) => save((p) => { p.values.push({ id: F.uuid(), title: el.dataset.v, detail: "" }); }));

  // ---------- Roles & Weekly Compass
  const SAW = ["Physical", "Social / Emotional", "Mental", "Spiritual"];
  function rolesModule() {
    const p = data(), w = week(p);
    // this week's Compass sits on its own page now (the page is called Roles & Weekly Compass)
    const compassCard = `<div class="v g8">${ui.label2("This week's Compass")}<button type="button" class="plain card actas press" data-act="org-compass" aria-description="Edit this week's Compass">
        ${ui.compass(F.compassFor({ ...p, days: {} }, new Date()), { label: String(w.compass || "").trim() ? "Compass · this week" : w.suggestedCompass ? "Compass · suggested" : "Compass",
          placeholder: "Tap to write this week's Compass: who you're being across your roles." })}</button></div>`;
    return compassCard + section("Roles", (p.roles.length ? "" : '<p class="t15 muted">No roles yet. Add one, like Parent or Job seeker.</p>')
        + p.roles.map((r, i) => `<div class="h g8 org-role-row rc${i % 8}"><span class="role-dot" aria-hidden="true"></span><input id="org-role-${r.id}" class="input org-fb grow" type="text" value="${esc(r.name)}" placeholder="Role" aria-label="Role" data-change="org-role-name" data-id="${r.id}">
            <button type="button" class="btn icon org-trash" data-act="org-del-role" data-id="${r.id}" aria-label="${esc("Remove role " + r.name)}">${icon("trash")}</button></div>`).join("")
        + addField("org-add-role", "Add a role", "role"),
        "Four to seven is typical. Renaming a role keeps its tasks.")
      + section("This week's Big Rocks", p.roles.map((role) => {
          const rocks = w.rocks.filter((k) => k.roleID === role.id);
          return `<div class="v g4"><span>${ui.roleTag(role.name)}</span>
            ${rocks.map((k) => `<div class="h g8 org-rock">${`<button type="button" class="check ${k.done ? "on" : ""}" data-act="org-rock-done" data-id="${k.id}" aria-label="${esc((k.done ? "Done: " : "Mark done: ") + k.title)}"><i></i></button>`}
              <span class="t15 grow ${k.done ? "muted strike" : "ink"}">${esc(k.title)}</span>
              ${k.scheduled ? ui.tag("Scheduled", "done") : ui.btn({ label: "Block time", kind: "small", act: "org-block-time", data: { id: k.id } })}</div>`).join("")}
            ${rocks.length < 2 ? addField(`org-add-rock-${role.id}`, `Big Rock for ${role.name}`, "rock", { role: role.id }) : ""}</div>`;
        }).join("") + (p.roles.length ? "" : '<p class="t15 muted">Add a role first; each role gets its own Big Rocks.</p>'),
        "One or two per role. Block time for them first, before the week fills up.")
      + section("Sharpen the saw", SAW.map((dim, i) => `<div class="v g4"><label class="t13 w6 muted" for="org-saw-${i}">${esc(dim)}</label>
          <input id="org-saw-${i}" class="input org-fb" type="text" placeholder="This week's renewal" value="${esc(w.saw[dim] || "")}" data-change="org-saw" data-dim="${esc(dim)}"></div>`).join(""),
        "One small renewal for each part of you this week.");
  }
  F.onChange("org-role-name", (el) => save((p) => { const r = p.roles.find((x) => x.id === el.dataset.id); if (r) r.name = el.value; }));
  F.on("org-del-role", (el) => {
    // the role and its Big Rocks (every week) go at once; Undo puts both back in their places
    const id = el.dataset.id, rocks = {};
    for (const [k, w] of Object.entries(data().weeks)) { const rs = (w.rocks || []).map((x, i) => [i, x]).filter(([, x]) => x.roleID === id); if (rs.length) rocks[k] = rs; }
    const n = Object.values(rocks).reduce((a, rs) => a + rs.length, 0);
    return removeWithUndo(el, "roles", id, (r) => `Removed the role “${r.name}”` + (n ? ` and its ${n === 1 ? "Big Rock" : n + " Big Rocks"}` : ""),
      (p) => { for (const w of Object.values(p.weeks)) w.rocks = w.rocks.filter((k) => k.roleID !== id); },
      (p) => { for (const [k, rs] of Object.entries(rocks)) { const w = p.weeks[k]; if (!w) continue; for (const [i, x] of rs) if (!w.rocks.some((y) => y.id === x.id)) w.rocks.splice(Math.min(i, w.rocks.length), 0, x); } });
  });
  /** Delete one line with Undo instead of "Are you sure?" (spec 4b Forgiving): the row folds away (200 ms, a fade with
   *  Reduce Motion), it's saved, and the toast's Undo puts it back where it was. also/back = extra changes and their reverse. */
  async function removeWithUndo(el, coll, id, say, also, back) {
    const p0 = data(), idx = p0[coll].findIndex((x) => x.id === id), item = p0[coll][idx];
    if (!item) return;
    const row = el.closest(".org-rrow, .org-goal, .org-role-row");
    if (row?.dataset.removing) return;
    if (row) row.dataset.removing = "1";
    if (row && row.animate) {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, h = row.offsetHeight;
      await row.animate(reduce ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, height: h + "px", transform: "none" }, { opacity: 0, height: "0px", transform: "translateX(-12px)" }],
        { duration: reduce ? 150 : 220, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }).finished.catch(() => {});
    }
    await save((p) => { p[coll] = p[coll].filter((x) => x.id !== id); also?.(p); });
    F.toast(say(item), { undo: async () => {
      await save((p) => { if (!p[coll].some((x) => x.id === id)) p[coll].splice(Math.min(idx, p[coll].length), 0, item); back?.(p); });
      F.toast("Put back");
    } });
  }
  F.on("org-rock-done", (el) => save((p) => updWeek(p, new Date(), (w) => { const k = w.rocks.find((x) => x.id === el.dataset.id); if (k) k.done = !k.done; })));
  F.onChange("org-saw", (el) => save((p) => updWeek(p, new Date(), (w) => { w.saw[el.dataset.dim] = el.value; })));
  F.on("org-block-time", (el) => {
    const rock = week(data()).rocks.find((x) => x.id === el.dataset.id); if (!rock) return;
    const onSaved = () => save((p) => updWeek(p, new Date(), (w) => { const k = w.rocks.find((x) => x.id === rock.id); if (k) k.scheduled = true; }));
    if (F.openEventEdit) F.openEventEdit(null, { day: new Date(), title: `Big Rock · ${rock.title}`, onSaved });
    else blockTimeSheet(`Big Rock · ${rock.title}`, onSaved);
  });
  /** Fallback only when the Calendar screen's event editor isn't loaded: title, day, start, end → add_event. */
  function blockTimeSheet(title, onSaved) {
    const n = new Date(); n.setMinutes(0, 0, 0); n.setHours(n.getHours() + 1);
    const s = F.sheet({ title: "New event", leading: { label: "Cancel" }, trailing: { label: "Add", act: "org-bt-add" },
      body: `<div class="form"><div class="fgroup">
        <div class="frow"><input class="bare" id="org-bt-title" value="${esc(title)}" aria-label="Title"></div>
        <div class="frow"><span class="lbl">Day</span><input class="bare" type="date" id="org-bt-day" value="${D.key(n)}" style="flex:none"></div>
        <div class="frow"><span class="lbl">Starts</span><input class="bare" type="time" id="org-bt-start" value="${D.hhmm(n)}" style="flex:none"></div>
        <div class="frow"><span class="lbl">Ends</span><input class="bare" type="time" id="org-bt-end" value="${D.hhmm(new Date(n.getTime() + 3600000))}" style="flex:none"></div></div></div>` });
    s.el.classList.add("org-half");
    F.on("org-bt-add", async () => {
      const q = (id) => s.el.querySelector(id).value;
      const st = new Date(q("#org-bt-day") + "T" + q("#org-bt-start")), en = new Date(q("#org-bt-day") + "T" + q("#org-bt-end"));
      if (!(en > st)) { F.toast("The end has to be after the start."); return; }
      await F.cmd("add_event", { title: q("#org-bt-title").trim() || title, start: st.getTime() / 1000, end: en.getTime() / 1000 }, "Added to your calendar.");
      await onSaved(); s.close();
    });
  }

  // ---------- Time Matrix
  const QUADS = [[1, "Urgent & important", "Crises, deadlines", "q1"], [2, "Important, not urgent", "Big Rocks, planning, health, people", "q2"],
    [3, "Urgent, not important", "Interruptions, most messages", "q3"], [4, "Neither", "Busywork, time wasters", "q4"]];
  function sortRow(t) {
    return `<div class="v g4 org-sort"><span class="t15 ink wrap">${esc(t.title)}</span><div class="h g4">${QUADS.map((q) =>
      `<button type="button" class="org-qbtn press ${t.fc.quadrant === q[0] ? q[3] + " on" : ""}" data-act="org-quad" data-id="${esc(t.id)}" data-q="${q[0]}" aria-label="${esc(`Quadrant ${q[0]}, ${q[1]}`)}" aria-pressed="${t.fc.quadrant === q[0]}">Q${q[0]}</button>`).join("")}</div></div>`;
  }
  function matrixModule() {
    const open = openTodos(), sorted = open.filter((t) => t.fc.quadrant != null), q2 = sorted.filter((t) => t.fc.quadrant === 2).length;
    const unsorted = open.filter((t) => t.fc.quadrant == null);
    let out = `<div class="v g8"><div class="org-grid">${QUADS.map((q) => { const n = open.filter((t) => t.fc.quadrant === q[0]).length;
        return `<button type="button" id="org-quad-${q[0]}" class="org-quad press ${q[3]} ${H.focus === q[0] ? "focus" : ""}" data-act="org-focus" data-q="${q[0]}" aria-pressed="${H.focus === q[0]}" aria-description="Shows these tasks below">
          <span class="t13 w6 qc">Quadrant ${q[0]}</span><span class="t15 w6 ink">${esc(q[1])}</span><span class="t12 ink2">${esc(q[2])}</span><span class="t13 w6 ink num">${n} task${n === 1 ? "" : "s"}</span></button>`; }).join("")}</div>
      <p class="t13 muted">${sorted.length ? `${q2} of ${sorted.length} sorted tasks are Quadrant II. The goal is to move time out of III and IV into II.` : "Sort a few tasks below to see where your time goes."}</p></div>`;
    if (H.focus) {
      const list = open.filter((t) => t.fc.quadrant === H.focus);
      out += section(`Quadrant ${H.focus}`, (list.length ? "" : '<p class="t15 muted">Nothing here.</p>') + list.slice(0, 40).map(sortRow).join(""));
    }
    out += section(`Not sorted yet · ${unsorted.length}`, (unsorted.length ? "" : '<p class="t15 c-done">Everything is sorted.</p>') + unsorted.slice(0, 30).map(sortRow).join("")
      + (unsorted.length > 30 ? `<p class="t13 muted">And ${unsorted.length - 30} more. Sort these first.</p>` : ""),
      "Tap the quadrant each one belongs in. Most of what feels urgent is really Quadrant III.");
    return out;
  }
  F.on("org-focus", (el) => { const q = +el.dataset.q; H.focus = H.focus === q ? null : q; hDraw(); });
  F.on("org-quad", async (el) => {
    const t = F.todos().find((x) => String(x.id) === el.dataset.id); if (!t) return;
    const q = +el.dataset.q;
    await F.cmd("set_franklin", { todoID: t.id, meta: { ...t.fc, quadrant: t.fc.quadrant === q ? null : q } });
  });

  // ---------- Task Engine (rules are the app's @AppStorage keys, written as prefs "1"/"0")
  const RULES = [["closeOutForwardRest", true, "Close-out: Done forwards anything unmarked to tomorrow"],
    ["forwardKeepsLetter", false, "Forwarded tasks keep their A-B-C letter (Franklin says re-prioritize, so off by default)"],
    ["quickDefaultC", false, "Quick tasks I say out loud (or add in one line here) get a C"],
    ["bufferWarn", true, "Warn me when a day is more than 85% booked"]];
  const rule = (k, def) => { const v = F.prefs()[k]; return v == null ? def : v === "1" || v === "true"; };
  function engineModule() {
    return section("A-B-C-1-2-3", [["A", "Vital: must happen today"], ["B", "Important: could slip a day"], ["C", "Nice to do"]].map(([l, t]) =>
        `<div class="h g16"><span class="pbadge org-pbadge ${l}">${l}1</span><span class="t15 ink">${esc(t)}</span></div>`).join("")
        + '<p class="t13 muted">Then number within each letter in the order you\'ll do them: A1, A2, A3.</p>',
        "Work top down: every A before any B, and A1 before A2.")
      + section("End-of-day marks", [["✓", "Done", "c-done"], ["→", "Forwarded to another day", "ink2"], ["•", "In progress, carries over", "ink2"],
          ["D", "Delegated to someone", "ink2"], ["✗", "Deleted, no longer needed", "c-danger"]].map(([m, t, c]) =>
          `<div class="h g16 org-mark"><span class="org-markc ${c}">${m}</span><span class="t15 ink">${esc(t)}</span></div>`).join(""),
        "Every task gets one mark, so nothing silently disappears.")
      + section("Your rules", RULES.map(([k, def, t]) => toggle(t, rule(k, def), "org-rule", { k })).join(""), "Change these any time; they apply from now on.");
  }
  F.onChange("org-rule", (el) => F.setPref(el.dataset.k, el.checked ? "1" : "0"));

  // ---------- Energy & Calendar Defense
  const BUF = [[60, "10% · 1 hour"], [90, "15% · 90 min"], [120, "20% · 2 hours"]];
  function energyLoad() {
    const pr = profile();
    const any = ["focus", "buffer", "batch0", "slump"].some(hasBlock);
    return { peak: { h: pr.peakHour, m: pr.peakMinute }, slump: { h: pr.slumpHour ?? 14, m: 0 }, focusMinutes: pr.peakMinutes, bufferMinutes: pr.bufferMinutes,
      batchTwice: (pr.batchTimes || []).length > 1, focusOn: !any || hasBlock("focus"), bufferOn: !any || hasBlock("buffer"), batchOn: !any || hasBlock("batch0"), cOn: !any || hasBlock("slump"), busy: false };
  }
  function energyModule() {
    const E = H.energy || (H.energy = energyLoad());
    const traps = data().profile?.traps || [];
    const sel = (BUF.find((b) => b[0] === E.bufferMinutes) || BUF[1])[1];
    return section("Energy peak", `<label class="org-prow"><span class="grow t15">Sharpest window starts</span><input id="org-peak" class="org-time" type="time" value="${hm(E.peak)}" data-change="org-e-time" data-k="peak"></label>
        <div class="org-prow"><span class="grow t15">Deep-work block: ${E.focusMinutes} min</span><div class="org-step" role="group" aria-label="Deep-work block length">
          <button type="button" id="org-step-dn" data-act="org-e-step" data-d="-15" aria-label="Shorter" ${E.focusMinutes <= 30 ? "disabled" : ""}>${icon("minus")}</button><i></i>
          <button type="button" id="org-step-up" data-act="org-e-step" data-d="15" aria-label="Longer" ${E.focusMinutes >= 180 ? "disabled" : ""}>${icon("plus")}</button></div></div>`,
        "Your sharpest window. It becomes a protected deep-work block for your A1 and Big Rocks, and Friday suggests it first when you plan your day.")
      + section("Energy slump", `<label class="org-prow"><span class="grow t15">Slump starts</span><input id="org-slump" class="org-time" type="time" value="${hm(E.slump)}" data-change="org-e-time" data-k="slump"></label>`,
        "When your energy hits a wall. Good for C tasks: quick, low-stakes things.")
      + section("Crisis buffer", ui.seg("org-e-buf", BUF.map((b) => b[1]), sel), "Franklin keeps 15 to 20 percent of the day open, so a surprise doesn't push your A's.")
      + section("Batch & triage", toggle("Twice a day (11:30 and 4:30)", E.batchTwice, "org-e-flag", { k: "batchTwice" }) + (traps.length ? warnLine(`Your traps: ${traps.join(", ")}`) : ""),
        "Answer messages and requests in set blocks instead of all day. That keeps Quadrant III small.")
      + section("On my calendar, every weekday", toggle("Deep-work block", E.focusOn, "org-e-flag", { k: "focusOn" }) + toggle("Crisis buffer", E.bufferOn, "org-e-flag", { k: "bufferOn" })
        + toggle("Batch & triage", E.batchOn, "org-e-flag", { k: "batchOn" }) + toggle("Low-energy window for C tasks", E.cOn, "org-e-flag", { k: "cOn" })
        + `<div><button type="button" class="btn primary" data-act="org-e-apply" ${E.busy ? "disabled" : ""}>${E.busy ? ui.spinner() : ""}Update my calendar</button></div>`
        + (H.saved ? `<p class="t13 c-done">${esc(H.saved)}</p>` : "")
        + (calAccess() ? "" : '<p class="t13 c-attention">Calendar access is off; allow it to add these blocks.</p>')
        + '<p class="t13 muted">Only the blocks Friday made are changed; your own events are never touched.</p>');
  }
  F.onChange("org-e-time", (el) => { const c = parseHM(el.value); if (c) H.energy[el.dataset.k] = c; });
  F.on("org-e-step", (el) => { const E = H.energy; E.focusMinutes = Math.min(180, Math.max(30, E.focusMinutes + +el.dataset.d)); hDraw(); });
  F.on("org-e-buf", (el) => { H.energy.bufferMinutes = (BUF.find((b) => b[1] === el.dataset.value) || BUF[1])[0]; hDraw(); });
  F.onChange("org-e-flag", (el) => { H.energy[el.dataset.k] = el.checked; });
  F.on("org-e-apply", async () => {
    const E = H.energy; if (E.busy) return;
    for (const k of ["peak", "slump"]) { const c = parseHM(H.api.el.querySelector("#org-" + k)?.value); if (c) E[k] = c; }
    E.busy = true; hDraw();
    try {
      const r = { peak: E.peak, slump: E.slump, focusMinutes: E.focusMinutes, bufferMinutes: E.bufferMinutes,
        batchTimes: E.batchTwice ? [{ h: 11, m: 30 }, { h: 16, m: 30 }] : [{ h: 16, m: 30 }] };
      await save((p) => saveSettings(p, r));
      const made = await applyDefense({ ...r, focus: E.focusOn, buffer: E.bufferOn, batch: E.batchOn, cWindow: E.cOn });
      H.saved = made.length ? "Saved. On your calendar every weekday: " + made.join(", ") + "." : "Saved. No blocks on your calendar.";
      F.toast(H.saved);
    } finally { if (H?.energy) { H.energy.busy = false; hDraw(); } }
  });

  // for QA / other screens
  F.organizer = { build, taskPhrase, timeIn, bufferStart, PRESETS, QUESTIONS, isSetUp: () => isSetUp() && F.prefs().plannerSetupDone !== "0" };
})();
