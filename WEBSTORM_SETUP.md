# Open this in WebStorm

This is TapIt Studio (the planning workspace) plus the mockups, planning files and notes.

## First run (about 3 minutes)

1. **Node 22 or newer.** Check with `node --version`. WebStorm: Settings, Languages & Frameworks, Node.js, set the interpreter to Node 22+.
2. **Open the `studio` folder** in WebStorm (File, Open, pick `tapit.info/studio`). Opening the parent folder also works.
3. In the WebStorm terminal (inside `studio`):
   ```
   npm install
   npm run dev
   ```
4. Open http://localhost:3100. You get:
   - **Flows**: four seeded application flows (click a box to edit, drag from the dot on its right edge to connect).
   - **Mockups**: the interactive version 2 mockups, running fully offline.
5. **Export spec** (top of the flow canvas) writes `planning/SPEC.md`. Edits to flows are saved automatically into `planning/flows/*.flow.json`.

To run it from WebStorm's Run menu: Run, Edit Configurations, add an **npm** configuration with command `run` and script `dev`.

## What is where

| Folder | What it is |
|---|---|
| `studio/` | The Studio app (Next.js, React Flow). |
| `planning/` | Flow files, the generated SPEC.md, and `REQUIREMENTS.md` (what is still to be built). |
| `mockups/` | The mockup source files. Version 2 is current. They are plain HTML, so do not reformat them. |
| `docs/` | Client questions, research and the billing and membership rules. |
| `CLAUDE.md` | The project rules, so Claude Code knows them when you start building. |

## Current state (be aware)

- This is Studio **version 0**: it has **no login yet**. Run it on your own machine only. Do not port-forward it until login and HTTPS are added (in progress).
- Not built yet: login, client and developer messaging, pin and draw comments on mockups, the Finalize button. They are listed in `planning/REQUIREMENTS.md`.
- Docker files are included but untested.
- `studio/vendor/dc-runtime.js` is a small runtime the mockups need, taken from the design tool they were made in. Check its terms before sharing outside your team.

## If something does not start

- `npm run dev` says the port is busy: stop the other process on port 3100, or change the port in `studio/package.json`.
- Blank page after an update: stop the server, delete `studio/.next`, run `npm run dev` again.
