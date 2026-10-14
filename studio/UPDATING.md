# Updating TapIt Studio from a zip, without losing your setup

1. Stop the dev server.
2. Extract the new zip into a NEW folder (never over the old one: a zip cannot delete old files, and stale ones can stop the app starting).
3. From the new folder, run the script that carries your work across:

   ```
   node update-studio.mjs "D:\path\to\OLD-folder" "D:\path\to\NEW-folder" --install
   ```

   (Inside the new folder you can leave out the second path.) Add `--dry` first if you want to see what it would do.

4. In the new `studio` folder run `npm run dev`. Your accounts, messages, decisions, uploads and flows are already there.

## What the script copies

| From the old folder | Why |
|---|---|
| `studio/data/` | the database (accounts, messages, decisions) and uploaded images |
| `studio/.env*` | your settings (owner login, SMTP) |
| `planning/flows/*.flow.json` | flows you edited. If the new zip has a different version, it is saved next to yours as `.incoming` |
| `planning/handoffs/` | every handoff you finalized |
| `.idea/` | your WebStorm project settings (only if the new folder has none) |

Anything it would replace is first saved in `_update-backup-<time>` inside the new folder. It never changes or deletes anything in the old folder.

If you already started the new folder once, it has its own empty database and the script stops. Add `--force` to replace it with your old one (the new one is backed up first).

## If you extracted over the old folder anyway

Delete these (removed or moved in earlier versions), then `npm run dev` again:
- `studio/app/flows/` and `studio/app/review/`
- `studio/public/prototypes/`
- `studio/.next/`

Using git (`git pull` on branch `claude/nifty-lamport-2rxnx1`) is the other good route, because git handles deletions.
