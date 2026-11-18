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
  applied:[commandId] }
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

To-dos: `add_todo{title, list?, due?"YYYY-MM-DD", time?"HH:mm", notes?, letter?, number?, quadrant?, role?, bigRock?, goal?, important?, repeat?}` ·
`update_todo{todoID, title?, list?, hasDue?, due?, time?, notes?, important?, repeat?("never"|"daily"|"weekdays"|"weekly"|"biweekly"|"monthly"|"yearly"), fc?{letter,number,quadrant,role,bigRock,inProgress,delegate,goal}}` ·
`complete_todo{todoID}` · `uncomplete_todo{todoID}` · `delete_todo{todoID}` · `move_todo{todoID, due|null}` · `set_franklin{todoID, meta{…}}` ·
`forward_todos{ids[], due|null, inProgress?, keepLetter?}` · `renumber{ids[], letter}`

Lists: `add_list{name}` · `rename_list{old, new}` · `delete_list{name}` · `set_list_color{name, color}`

Events: `add_event{title, start, end, allDay?, location?, notes?, calendar?, repeat?}` · `update_event{itemID, occurrenceStart, allFuture?, title?, start?, end?, allDay?, location?, notes?, calendar?, repeat?}` · `delete_event{itemID, occurrenceStart, allFuture?}`

Calendar defense (planner setup): `apply_defense{peak:"HH:mm", focusMinutes, bufferMinutes, batchTimes:["HH:mm"], slump:"HH:mm"|null, focus, buffer, batch, cWindow}` · `remove_defense{keys:[…]}`

Mail (the message is `mailID` = the message's `id` from friday-mail.json; never put it in the command's own `id`):
`mail_send{accountID, to, cc, subject, body, inReplyTo?, references?, replyingTo?, byFriday?}` · `mail_archive{mailID}` · `mail_trash{mailID}` · `mail_delete{mailID}` (permanent, from Trash) ·
`mail_move{mailID, folder, accountID?}` · `mail_flag{mailID, on}` · `mail_seen{mailID, on}` · `mail_body{mailID}` · `mail_folder{accountID, folder}` · `mail_refresh{}` (the website's Sync now: check mail right away) · `mail_create_folder{accountID, name}`

Junk & unsubscribe: `mail_junk{mailIDs[], block?}` (move to each account's Junk; block = future mail from that sender goes to Junk) · `mail_notjunk{mailIDs[]}` (back to Inbox; sender unblocked and marked never-junk) ·
`mail_unsubscribe{mailID, alsoJunk?, block?}` (iPhone does one-click POST or the mailto email; if the sender only offers a web page, the website opens that https link itself).
Lists live in `prefs` and sync everywhere: `mailBlocked` and `mailAllowed` (`\n`-joined lowercase emails; the website may edit them directly), `mailUnsubscribed` (JSON text `{email: epochSeconds}`).
Rules: allowed beats blocked; never block one of his own account addresses; nothing is junked or unsubscribed without his tap (suggestions only: ≥3 mailing-list emails from a sender, none opened).

Failures: `snapshot.failed` = `{commandId: "message to show"}` for commands the iPhone couldn't carry out.

Memory: `remember{fact}` (the iPhone adds it to Friday's memory and logs "Remembered: …").

Planner data (values, roles, goals, weeks, days, profile) is edited directly in `prefs.franklinPlanner` (no command).
