# Neil Young Tier Lists

A 40-week group project: everyone in the Discord ranks Neil Young albums, one album added each week. Built as a single-page app on Cloudflare Workers (free tier) with a D1 database and Discord OAuth restricted to one server.

- **Frontend:** React + Vite, served as static assets by the Worker
- **Backend:** Hono on Cloudflare Workers, D1 (SQLite) for storage
- **Auth:** Discord OAuth (`identify` + `guilds.members.read`) — only members of the configured guild can sign in; nicknames and avatars come from that server
- **Deploys:** push to `main` → Cloudflare Workers Builds deploys automatically

See [SETUP.md](SETUP.md) for the one-time setup steps (Discord app, Cloudflare wiring, secrets) and local development.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev: Worker on :8787, Vite on :5173 (open :5173) |
| `npm run build` | Build the frontend to `dist/` |
| `npm run deploy` | Build + deploy to Cloudflare |
| `npm run check` | Typecheck client and worker |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations in production |
