# App ⇄ website data contract

Both files live in the private repo `friday-sync`, encrypted with the same AES-GCM envelope and key (see `crypto.js` / `SyncCrypto` in the app).

## `friday-sync.json` (payload)

Sections are `{stamp, value}`; newer stamp wins per section. **Owners**: the app writes `friday`, `mail`, `prefs`, `claude`, `snapshot`; the website writes `queue`, `webchat`, and may write `prefs` (planner + settings). Each side carries the other's sections through untouched.

| section | value |
|---|---|
| `prefs` | `{key: string}`; `franklinPlanner` = JSON string of PlannerData (Franklin.swift); `claudeModel`, `hiddenCalendars` (`\n`-joined ids), `showDone` "1"/"0", `birthday`, `anniversary`, `anniversaryLabel`, `fromName`, `mailSignature`, `plannerSetupDone` "1"/"0" |
| `friday` | `{facts:[{id,fact,date}], lines:[{id,role,text,date}]}` (dates = seconds since 2001) |
| `claude` | the Claude API key (string) |
| `snapshot` | below |
| `queue` | `[Command]` below |
| `webchat` | `[{id, role:"user"|"friday"|"action"|"note", text, date(epoch), brain?}]` |

### snapshot (app → web). Times are Unix epoch seconds.
```
{ at, device, access:{calendar:bool, reminders:bool},
  todos:[Todo], done:[Todo],                  // open, and finished today
  history:{ "YYYY-MM-DD":[Todo] },             // finished on each of the last 14 days
  events:[{id, itemID, title, start, end, allDay, calendar, calendarID, color:"#RRGGBB", location, notes, repeats}],  // today-7 … today+30
  lists:[{title, color}], calendars:[{id, title, source, color, writable}],
  capacity:{ "YYYY-MM-DD": {n, fits, room, free, needed, aCount, basis:"profile"|"pace"|"standard", reasons:[string]} },  // next 14 days
  defense:{ focus:bool, buffer:bool, batch0:bool, batch1:bool, slump:bool },
  applied:[commandId],
  failed:{ commandId: "message to show" } }    // commands the iPhone ran but couldn't carry out (also listed in applied)
Todo = {id, title, list, listColor, due|null, dueHasTime, notes, letter, number, quadrant, role, bigRock, inProgress, delegate, goal, important, repeats, repeatRule}
```

## `friday-mail.json` (app → web; iPhone relays email)
```
{ at, accounts:[{id, label, email, fullName, colorIndex}],
  folders:{ accountId:[{name, role}] },          // role: inbox|archive|trash|sent|drafts|junk|""
  messages:[{id, accountID, folder, uid, from:{name,email}, to:[{name,email}], cc:[…], replyTo, subject, date, seen, flagged, isUpdate, size, preview, messageID, references,
             unsubscribe /* raw List-Unsubscribe: "<https://…>, <mailto:…>" or null */, oneClick /* RFC 8058 one-click supported */, junk /* in a Junk/Spam folder */}],   // includes each account's Junk folder
  bodies:{ id:{text, html, attachments:[name]} },  // newest ~40 + any the website asked for
  drafts:[MailDraft], signature }
```

## Commands (`queue`, web → app). Every command: `{id, at, kind, …}`. The app runs each once (ids recorded in `snapshot.applied`).

To-dos: `add_todo{title, list?, due?"YYYY-MM-DD", time?"HH:mm", notes?, letter?, number?, quadrant?, role?, bigRock?, goal?, important?, repeat?, inProgress?, delegate?}` (inProgress = the "•" status, delegate = name for "D"; set at creation because a follow-up `set_franklin` would need the new to-do's id. Mail's "Make a task" sends these) ·
`update_todo{todoID, title?, list?, hasDue?, due?, time?, notes?, important?, repeat?("never"|"daily"|"weekdays"|"weekly"|"biweekly"|"monthly"|"yearly"), fc?{letter,number,quadrant,role,bigRock,inProgress,delegate,goal}}` ·
`complete_todo{todoID}` · `uncomplete_todo{todoID}` · `delete_todo{todoID}` · `move_todo{todoID, due|null}` · `set_franklin{todoID, meta{…}}` ·
`forward_todos{ids[], due|null, inProgress?, keepLetter?}` · `renumber{ids[], letter}`

Lists: `add_list{name}` · `rename_list{old, new}` · `delete_list{name}` · `set_list_color{name, color}`

Events: `add_event{title, start, end, allDay?, location?, notes?, calendar?, repeat?}` · `update_event{itemID, occurrenceStart, allFuture?, title?, start?, end?, allDay?, location?, notes?, calendar?, repeat?}` · `delete_event{itemID, occurrenceStart, allFuture?}`

Calendar defense (planner setup): `apply_defense{peak:"HH:mm", focusMinutes, bufferMinutes, batchTimes:["HH:mm"], slump:"HH:mm"|null, focus, buffer, batch, cWindow}` · `remove_defense{keys:[…]}`

Mail. **Which email**: every mail action takes `mailID` (the message's `id` from friday-mail.json; never the command's own `id`) or `mailIDs[]` for many at once, **and always** the matching `messageID` / `messageIDs[]` (the message's `messageID` field; parallel to the ids, `""` when unknown) so the iPhone still finds an email that moved since (WebBridge.findMail: by id, else by Message-ID anywhere loaded).
Actions: `mail_archive` · `mail_trash` · `mail_delete` (permanent, from Trash) · `mail_flag{on}` · `mail_seen{on}` · `mail_move{folder, accountID?}` · `mail_junk{block?}` (to each account's Junk; block = that sender's future mail goes there too) · `mail_notjunk` (back to Inbox; sender unblocked and marked never-junk) · `mail_body` (download the whole email; it then appears in `bodies`) · `mail_unsubscribe{alsoJunk?, block?}` — each with `mailID`+`messageID` or `mailIDs[]`+`messageIDs[]`. Many at once = one batched server connection per folder.
Sending: `mail_send{accountID, to, cc, subject, body, inReplyTo?, references?, replyingTo?, byFriday?, draftID?}` (draftID = the draft's `id` when sending one of `drafts`; the iPhone deletes that draft) · `mail_draft_delete{draftID}` (Discard a draft). There is no "save draft" command: the website's Cancel offers Discard / Keep editing only.
Mailbox: `mail_folder{accountID, folder}` (load a folder) · `mail_refresh{}` (Sync now) · `mail_create_folder{accountID, name}` · `mail_empty{accountID?, role:"junk"|"trash"}` (permanent; the website asks first; no accountID = every account) · `mail_mark_all_read{accountID?, folder?}` (still accepted; the website's "Mark all as read" now sends `mail_seen{mailIDs, messageIDs, on:true}` for exactly the emails on screen — lane, filter, folder, account — and Undo sends `on:false` for the same ids).

Junk lists live in `prefs` and are **written by the iPhone only**: `mailBlocked`, `mailAllowed` (`\n`-joined lowercase emails), `mailUnsubscribed` (JSON text `{email: epochSeconds}`; a **negative** value = "their unsubscribe page was opened, not confirmed yet"). The website changes them with commands:
`mail_block{email}` · `mail_unblock{email}` · `mail_allow_remove{email}` (take off the never-junk list) · `mail_unsub_confirm{email}` (he finished on their page: stamp becomes positive).
Unsubscribe: the iPhone does one-click POST or the mailto email and records the date. If the sender only offers a web page, the website opens that https link itself **and still queues `mail_unsubscribe`**, so the iPhone records the negative stamp (and junks/blocks if asked). While negative, the website shows "You opened their unsubscribe page — finished there?" with **Yes, done** (`mail_unsub_confirm`) and **Open it again**; it isn't counted as unsubscribed (tags, suggestions) until confirmed.
Rules: allowed beats blocked; never block one of his own account addresses; nothing is junked or unsubscribed without his tap (suggestions only: ≥3 mailing-list emails from a sender, none opened).

Website overlay (how pending mail commands show): every mail command is laid over friday-mail.json at once, and **kept until friday-mail.json is newer than the command** (`mail.at > command.at`), even after `snapshot.applied` lists it, so rows never flash back. A command taken back from the queue (Undo) or listed in `snapshot.failed` is not laid over. The website remembers what each command it queued was about (localStorage, commandId → {kind, subject, to, …}) so a failure can say what didn't happen ("Not sent" card with Edit and try again; "Your iPhone couldn't archive “…”: reason"), each with Dismiss (remembered in localStorage). A `mail_body` with no body after 45 s (or in `failed`) shows "Couldn't get this email from your iPhone" with Try again.

Conversations (website = app, MailStore.threadKey): per account; root = the first `<…>` token in `references`; else a subject starting `re:`/`fw:`/`fwd:`/`aw:` (optionally `[n]`) → `"s:"` + the subject without those prefixes (unless empty or "(no subject)"); else the message's own `messageID`; else its `id`.

Memory: `remember{fact}` (the iPhone adds it to Friday's memory and logs "Remembered: …").

Planner data (values, roles, goals, weeks, days, profile) is edited directly in `prefs.franklinPlanner` (no command).
