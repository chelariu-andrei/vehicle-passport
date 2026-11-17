# Deadlines and reminders end-to-end checklist (manual)

Status: NOT YET RUN. A script for a human tester on a real dev build (local notifications cannot be exercised by `npm run check`). Fill the Result column with PASS / FAIL + note.

Setup: dev build (`eas build --profile development`), backend running (see `server/README.md`), a signed-in account with one car. Build the dev client with the `expo-notifications` plugin already in `app.json`.

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | Fresh car, nothing recorded. Open the Car tab. | Bell has no badge. Document status shows six grey "Not added" rows; CASCO reads "Optional · Add". No permission prompt yet. | |
| 2 | Add an RCA expiring in 12 days. | An explanation sheet appears first ("Allow reminders?"). Tap "Allow reminders": the system prompt follows. | |
| 3 | Return to the Car tab. | Bell shows 1 in the warning colour. The RCA row reads "Expiring" and "12 days". | |
| 4 | Tap "Not now" on a fresh install instead (repeat 2). | No system prompt, no reminders, and the sheet does not come back by itself. | |
| 5 | Deny in the system prompt. | Settings > Account > Notifications shows the note and "Open system settings". | |
| 6 | Tap "Open system settings", enable notifications, return to the app. | The note disappears; reminders are scheduled (check with step 9). | |
| 7 | Set the device date to 7 days before the RCA expiry, 09:00. | A notification "RCA expires in 7 days" with the car name arrives. | |
| 8 | Set the device date to the RCA expiry day, 09:00. | "RCA expires today" arrives. | |
| 9 | Record a renewal for the RCA (new policy, later `validUntil`) on this phone. | The old reminders are gone; none fires on the old expiry day. | |
| 10 | Tap a notification (app closed, then app open). | Document status for that car opens. | |
| 11 | Turn "Document deadlines" off. | No document reminders arrive; the footer reads "Reminders are off". | |
| 12 | Turn "Tire-season reminders" on with the date set to 14 October, 09:00 on 15 October. | "Time for winter tires" arrives, unless a TIRES event exists within the 30 days before. | |
| 13 | Release the car from the garage. | Its reminders stop. | |
| 14 | Sign out. | No reminder arrives afterwards. | |
| 15 | Reinstall and sign in. | No reminders until the app has opened once signed in; then they return. | |
| 16 | Two cars, many documents. | At most 60 reminders are scheduled (iOS limit 64); the nearest ones win. | |

Notes:
- Reminders are local to each phone. A renewal recorded on another device cancels this phone's reminders only after the app is opened here.
- Android: the channel is called "Document status" (id `deadlines`).
