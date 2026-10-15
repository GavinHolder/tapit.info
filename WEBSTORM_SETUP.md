# Open this in WebStorm

TapIt Studio (the planning workspace) plus the mockups, planning files and notes.

## First run

1. **Node 22 or newer** (`node --version`). WebStorm: Settings, Languages & Frameworks, Node.js, pick Node 22+.
2. **Open the `studio` folder** in WebStorm (File, Open). Make sure it is the folder you want: `package.json` should show the version number you expect.
3. In the terminal inside `studio`:
   ```
   npm install
   npm run create-owner -- you@example.com "Your Name" "a long password"
   npm run dev
   ```
4. Open http://localhost:3100 and sign in. The top bar shows the Studio version next to the logo.

Run from the Run menu: Edit Configurations, add an **npm** configuration (command `run`, script `dev`). Check its **working directory** is this `studio` folder.

## What you get

| Page | What |
|---|---|
| Inbox | Questions for the client and every message, with unread counts |
| Decisions | Look and layout choices the client approves |
| Flows | The application flows (see below) |
| Mockups | 17 interactive mockups. Pin, draw or box a comment on any of them |
| Finalize | Builds a numbered handoff with a Claude Code prompt and a Claude Design brief |
| Settings | Email connection (with a test button) and the wording and look of the emails |
| Team | Add clients and developers: send an invite link or set a password. Reset passwords, switch people off, change roles |

### Editing flows

- **Add:** right-click empty canvas, press **Tab** on a selected step (adds a connected step), or drag from a step's right-hand dot onto empty space.
- **Change or remove:** right-click a step or arrow, or click the **⋯** on a step (add after, duplicate, collapse, delete). **Delete** removes the selected step or arrow.
- **Move around:** arrow keys walk the flow. **Enter** edits the title. **C** collapses or expands the steps after the selected one.
- **Undo and redo:** Ctrl+Z, Ctrl+Shift+Z. **Ctrl+S** saves now (it also saves automatically).
- **Mermaid:** the **Mermaid** button exports the flow as a Mermaid flowchart or imports one as new steps. The **?** button lists every shortcut.

Accounts, messages and uploads are stored in `studio/data` (git-ignored). Flows and handoffs are files in `planning/` (commit them).

## Updating without losing your setup

Never extract a new zip over the old folder. Use `UPDATE-TEST-PROJECT.bat` (Windows, copies a new version into your test project after making a backup) or `node update-studio.mjs "<old>" "<new>"`. See `studio/UPDATING.md`.

## Tests

`npm run typecheck` checks the code. The browser and API test scripts are not part of the repository.

## Deploying

Start with `START-HERE.md` (blank VM to client connected, with a one-command installer). `studio/deploy/README.md` has the reference for Portainer, HTTPS and MikroTik. A GitHub Actions workflow in `.github/workflows/studio.yml` type-checks and builds on every push and publishes the image when `main` changes. The workflow has not been run on GitHub yet.

## If something does not start

- **Port 3100 busy:** another copy is running (often an older folder). Stop it, or find it with `netstat -ano | findstr :3100` then `taskkill /PID <number> /F`.
- **`'next' is not recognized`:** run `npm install` in the `studio` folder first.
- **Page looks old after an update:** delete `studio\.next` and hard-refresh (Ctrl+Shift+R).
- **Can't sign in / the login is gone:** run these in the `studio` folder.
  - `npm run list-users` shows which database is in use and who can sign in. If it says "No logins yet" or shows a different path than you expect, you are running a folder with its own empty data (use the update script to carry your data across).
  - `npm run create-owner -- you@example.com "Your Name" "a long password"` creates a developer login. Add `client` at the end for a client login.
  - `npm run reset-password -- you@example.com "a new long password"` sets a new password for an existing login.
- `studio/vendor/dc-runtime.js` is a small runtime the mockups need, taken from the design tool they were made in. Check its terms before sharing outside your team.
