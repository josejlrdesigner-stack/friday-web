# F.R.I.D.A.Y. web

The desktop/web companion to the F.R.I.D.A.Y. iPhone and iPad app: today, tasks, calendar, planner, text chat with Friday, and a Sync button that asks the owner's Mac to update the app on their devices.

This repository holds only the website's code. All personal data lives encrypted (AES-256-GCM, key from the owner's password via PBKDF2) in a separate private repository and is decrypted in the browser after sign-in. `auth.json` holds a GitHub access key encrypted the same way.
