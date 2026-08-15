import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createSession, verifySession } from './session';
import type { AppContext } from './types';

const SESSION_COOKIE = 'ny_session';
const STATE_COOKIE = 'ny_state';
const DISCORD_API = 'https://discord.com/api/v10';

function isLocalhostUrl(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function redirectUri(reqUrl: string): string {
  return `${new URL(reqUrl).origin}/api/auth/callback`;
}

async function upsertUser(db: D1Database, id: string, nickname: string, avatarUrl: string | null) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO users (id, nickname, avatar_url, first_login, last_login)
       VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT(id) DO UPDATE SET nickname = ?2, avatar_url = ?3, last_login = ?4`
    )
    .bind(id, nickname, avatarUrl, now)
    .run();
}

export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const uid = await verifySession(c.env.SESSION_SECRET, getCookie(c, SESSION_COOKIE));
  if (!uid) {
    console.warn(`auth: unauthenticated ${c.req.method} ${c.req.path}`);
    return c.json({ error: 'unauthorized' }, 401);
  }
  c.set('userId', uid);
  await next();
};

export const authRoutes = new Hono<AppContext>();

authRoutes.get('/login', (c) => {
  const state = crypto.randomUUID();
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    path: '/',
    maxAge: 600,
    sameSite: 'Lax',
    // Always Secure except plain-http local dev.
    secure: !isLocalhostUrl(c.req.url),
  });
  const params = new URLSearchParams({
    client_id: c.env.DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(c.req.url),
    scope: 'identify guilds.members.read',
    state,
  });
  return c.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

authRoutes.get('/callback', async (c) => {
  const { code, state, error } = c.req.query();
  if (error) {
    console.warn(`oauth: discord returned error "${error}"`);
    return c.redirect('/?error=denied');
  }
  const savedState = getCookie(c, STATE_COOKIE);
  if (!code || !state || state !== savedState) {
    console.warn('oauth: missing or mismatched state parameter');
    return c.redirect('/?error=state');
  }
  deleteCookie(c, STATE_COOKIE, { path: '/' });

  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.env.DISCORD_CLIENT_ID,
      client_secret: c.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(c.req.url),
    }),
  });
  if (!tokenRes.ok) {
    console.warn(`oauth: token exchange failed with ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 200)}`);
    return c.redirect('/?error=token');
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Membership check: 200 only if the user is in the configured guild.
  // Also yields their guild-specific nickname and avatar.
  const memberRes = await fetch(`${DISCORD_API}/users/@me/guilds/${c.env.DISCORD_GUILD_ID}/member`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!memberRes.ok) {
    console.warn(`oauth: guild membership check failed with ${memberRes.status} — sign-in rejected`);
    return c.redirect('/?error=not_member');
  }
  const member = (await memberRes.json()) as {
    nick: string | null;
    avatar: string | null;
    user: { id: string; username: string; global_name: string | null; avatar: string | null };
  };

  const user = member.user;
  const nickname = member.nick || user.global_name || user.username;
  const cdn = 'https://cdn.discordapp.com';
  const avatarUrl = member.avatar
    ? `${cdn}/guilds/${c.env.DISCORD_GUILD_ID}/users/${user.id}/avatars/${member.avatar}.png?size=128`
    : user.avatar
      ? `${cdn}/avatars/${user.id}/${user.avatar}.png?size=128`
      : `${cdn}/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;

  await upsertUser(c.env.DB, user.id, nickname, avatarUrl);

  const token = await createSession(c.env.SESSION_SECRET, user.id);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    maxAge: 30 * 86_400,
    sameSite: 'Lax',
    secure: !isLocalhostUrl(c.req.url),
  });
  return c.redirect('/');
});

authRoutes.get('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.redirect('/');
});

// Local development only: create a fake session without Discord.
// DEV_FAKE_LOGIN (set via .dev.vars, never in production) must hold a random
// token of 16+ chars, and the request must present it as ?key=. A hostname
// check can't distinguish local from production here because `wrangler dev`
// simulates the production route's hostname; requiring a secret token means
// even a stray var in production opens nothing without the exact value.
authRoutes.get('/dev-login', async (c) => {
  const devKey = c.env.DEV_FAKE_LOGIN;
  if (!devKey || devKey.length < 16 || c.req.query('key') !== devKey) {
    if (devKey) console.warn('auth: dev-login attempt rejected (missing, short, or mismatched key)');
    return c.notFound();
  }
  const uid = c.req.query('uid') ?? 'dev-user-1';
  const name = c.req.query('name') ?? `Dev ${uid.slice(-4)}`;
  const avatar = `https://cdn.discordapp.com/embed/avatars/${uid.length % 6}.png`;
  await upsertUser(c.env.DB, uid, name, avatar);
  const token = await createSession(c.env.SESSION_SECRET, uid);
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, path: '/', maxAge: 86_400, sameSite: 'Lax' });
  return c.redirect('/');
});
