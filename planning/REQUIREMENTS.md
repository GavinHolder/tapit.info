# Studio requirements (from the project owner)

Status: captured, not yet built unless marked done.

## Collaboration
- [x] A proper client / developer notes space. When the client comments or messages, the developer is notified; when the developer replies, the client is notified. Threads attach to a flow step, a mockup screen, or the project in general.
- [x] Comments can include images, links to websites, and text. Pin and draw comments directly on the mockups.
- [x] (in-app inbox; email still to do) An inbox with unread counts for both sides. Optional email via the owner's own SMTP server.

## Visual design AND application flow
- [x] Application flows (React Flow editor, seeded flows).
- [x] Visual design workspace: mockups with pin/draw comments, plus recorded design decisions (palette, layout direction, components) that the client can approve.
- [x] Every flow step can link to the screen it uses, and every screen shows which steps use it.

## Finalize
- [x] A Finalize button (owner only) that snapshots ALL of it: design decisions, annotated mockups, comments and threads, flows, open questions.
- [x] It writes a versioned handoff folder with (a) a Claude Code build prompt and (b) a Claude Design brief, plus a bundle of the flows, comments, screenshots and uploads.
- [x] Warn before finalizing if open questions remain. Changes after finalizing start a new draft version.

## Hosting
- Run on a VM via Docker, managed by Portainer, on the owner's network. Remote access for the client through a MikroTik port forward.
- Must not be exposed without login and HTTPS. All tooling internal.
- Developed and tested locally in WebStorm.
