# TapIt Studio

Self-hosted planning workspace for TapIt. Two parts:

- **Flows** (`/flows`): a flow editor built on React Flow. Steps are typed (Screen, Action, Decision, Data captured, Backend, Profile, External, Open question) and carry the information captured, what the backend reads and writes, the API, a link to a mockup, a status and comments.
- **Mockups** (`/review`): the interactive prototypes, served locally and fully offline.

Everything is stored as files in `../planning` so Claude Code can read it when development starts:

```
planning/flows/*.flow.json   source of truth, edited in Studio
planning/SPEC.md             generated from the flows ("Export spec" or `npm run spec`)
```

## Run it

```bash
npm install
npm run seed        # first time only: writes the starting flows (never overwrites without --force)
npm run dev         # http://localhost:3100
```

Or with Docker (not yet tested in this environment):

```bash
docker compose up --build
```

## Mockups

`npm run prototypes` copies the boards from `../mockups` into `public/prototypes` and makes them self-contained (React, the runtime and the Manrope font are bundled; nothing loads from a CDN).

`vendor/dc-runtime.js` is the small runtime the mockups need. It came from the design tool they were made in. Check its terms before sharing the Studio outside this team.

## Rules this tool follows

- No third-party services, analytics or telemetry. External requests are blocked in testing and none were made.
- No login yet. Run it on a trusted machine or behind your own reverse proxy. Magic-link login is planned before clients are invited.
- React Flow shows a small "React Flow" credit in the corner (MIT licence).

## Next

1. Pin and draw comments on the mockups, with screenshots, uploads and links.
2. Magic-link login with roles (owner and client reviewer).
3. Keyboard shortcuts for adding steps, drag-to-create from a handle, collapse branches.
4. Mermaid import and export of each flow.
