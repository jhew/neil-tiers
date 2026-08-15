# One-time setup

Three pieces need manual clicks: the Discord application, the Cloudflare resources, and connecting the GitHub repo for auto-deploys. Everything else is code.

## 1. Discord application (~5 minutes)

1. Go to https://discord.com/developers/applications → **New Application** → name it (e.g. "NY Tier Lists").
2. **OAuth2** tab → copy the **Client ID** and reset/copy the **Client Secret**.
3. Still in OAuth2 → **Redirects** → add BOTH:
   - `http://localhost:5173/api/auth/callback` (local dev)
   - `https://tiers.guidegather.com/api/auth/callback` (production — match your real subdomain)
4. Get your **server (guild) ID**: in Discord, Settings → Advanced → enable Developer Mode, then right-click your server icon → **Copy Server ID**.
5. Get your own **user ID** the same way (right-click your name → Copy User ID) — that makes you admin.

No bot needs to be added to the server; the OAuth scopes (`identify guilds.members.read`) are enough, and only members of your server will be able to sign in.

## 2. Configuration values

All Discord values live in Worker secrets (step 3) and, for local dev, in the gitignored `.dev.vars` — **never commit any of them to the repo**, which is public. `wrangler.jsonc` intentionally contains no Discord IDs.

## 3. Cloudflare resources

```bash
npx wrangler login
```

```bash
npx wrangler d1 create neil-young-tiers
```

Paste the printed `database_id` into `wrangler.jsonc`, then:

```bash
npm run db:migrate:remote
```

Set the five secrets (each command prompts for the value):

```bash
npx wrangler secret put DISCORD_CLIENT_ID
```

```bash
npx wrangler secret put DISCORD_CLIENT_SECRET
```

```bash
npx wrangler secret put DISCORD_GUILD_ID
```

```bash
npx wrangler secret put ADMIN_DISCORD_IDS
```

```bash
npx wrangler secret put SESSION_SECRET
```

Values: client ID + secret from step 1.2, guild ID from step 1.4, admin IDs from step 1.5 (comma-separated for co-admins), and any long random string for `SESSION_SECRET`.

First deploy:

```bash
npm run deploy
```

## 4. Auto-deploy from GitHub

Cloudflare dashboard → **Workers & Pages** → the `neil-young-tiers` worker → **Settings** → **Build** → connect the GitHub repo (`jhew/neil-young-tiers`), branch `main`:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

From then on every push to `main` deploys automatically.

## 5. Custom domain

Worker → **Settings** → **Domains & Routes** → **Add** → Custom domain → `tiers.guidegather.com` (or whatever subdomain you like). Cloudflare creates the DNS record automatically since the zone is already on your account.

Remember to add that exact URL as a Discord redirect (step 1.3) if you picked a different subdomain.

## Local development

```bash
npm install
```

Copy `.dev.vars.example` to `.dev.vars` and fill in the Discord values. For real Discord login locally you need the real client ID/secret and guild ID; or set `DEV_FAKE_LOGIN` to a random 16+ character token and visit `http://localhost:5173/api/auth/dev-login?key=<that token>&uid=test1&name=Tester` to fake a session without Discord.

```bash
npm run db:migrate:local
```

```bash
npm run dev
```

Open http://localhost:5173.

## Week-to-week use

Nothing to deploy weekly. Sign in (you're admin), scroll to the **Admin** panel, search the album title, click the right cover, **Add**. It appears on everyone's unranked shelf immediately. There is deliberately no feature that hints at or predicts upcoming albums.
