# Updating TapIt Studio from a zip

A zip only adds and replaces files. It never deletes the ones that were removed or moved, and stale copies can stop the app from starting.

Safest way: extract the zip into a NEW folder, then copy your data across.

1. Stop the dev server.
2. Extract the zip into a new folder (do not extract over the old one).
3. Copy `studio/data/` from the old folder into the new `studio/` (this holds the database, accounts, messages and uploads).
4. Copy any edited files in `planning/flows/` if you changed flows outside the app.
5. In the new `studio/` folder run `npm install`, then `npm run dev`.

If you do extract over the old folder, delete these first (removed or moved in earlier versions):
- `studio/app/flows/` and `studio/app/review/` (moved into `studio/app/(app)/`)
- `studio/public/prototypes/` (moved to `studio/prototypes/`, behind login)
- `studio/.next/` (build cache, safe to delete any time)

Using git (`git pull` on branch `claude/nifty-lamport-2rxnx1`) handles deletions for you and is the better route once it is set up in WebStorm.
