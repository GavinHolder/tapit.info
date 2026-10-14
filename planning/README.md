# Planning

The plan for TapIt, kept as files so it can be read by Claude Code when development starts.

- `flows/*.flow.json`: the flow maps (source of truth). Edit them in TapIt Studio (`studio/`) or directly.
- `SPEC.md`: generated from the flows. Do not edit by hand. Regenerate with `cd studio && npm run spec`.

Each step in a flow has a type, a lane (Guest, Frontend, Backend, Database, Business, Admin, External), a status (draft, agreed, open question), what happens, the information captured (with personal-information flags for POPIA), what the backend reads and writes, an API, and a link to a mockup.
