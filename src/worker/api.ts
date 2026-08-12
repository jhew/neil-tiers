import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { TIERS } from '../shared/types';
import type { Album, Placement, Tier, UserList } from '../shared/types';
import { requireAuth } from './auth';
import { isAdmin, type AppContext } from './types';

// Defense-in-depth CSRF check on top of the SameSite=Lax cookie: browsers
// always attach an Origin header to cross-site mutations, so a present but
// mismatched Origin is never legitimate. Absent Origin (curl etc.) passes
// through to the auth check.
const rejectCrossOrigin: MiddlewareHandler<AppContext> = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('Origin');
    if (origin && origin !== new URL(c.req.url).origin) {
      console.warn(`csrf: blocked ${c.req.method} ${c.req.path} from origin ${origin}`);
      return c.json({ error: 'forbidden' }, 403);
    }
  }
  await next();
};

const adminOnly: MiddlewareHandler<AppContext> = async (c, next) => {
  const uid = c.get('userId');
  if (!isAdmin(c.env, uid)) {
    console.warn(`auth: user ${uid} denied admin route ${c.req.method} ${c.req.path}`);
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
};

interface AlbumRow {
  id: number;
  title: string;
  year: number | null;
  cover_url: string | null;
  week: number;
  added_at: number;
}

function toAlbum(r: AlbumRow): Album {
  return { id: r.id, title: r.title, year: r.year, coverUrl: r.cover_url, week: r.week, addedAt: r.added_at };
}

export const apiRoutes = new Hono<AppContext>();
apiRoutes.use('*', rejectCrossOrigin);
apiRoutes.use('*', requireAuth);

apiRoutes.get('/me', async (c) => {
  const uid = c.get('userId');
  const row = await c.env.DB.prepare('SELECT id, nickname, avatar_url FROM users WHERE id = ?1')
    .bind(uid)
    .first<{ id: string; nickname: string; avatar_url: string | null }>();
  if (!row) return c.json({ error: 'unauthorized' }, 401);
  return c.json({ id: row.id, nickname: row.nickname, avatarUrl: row.avatar_url, isAdmin: isAdmin(c.env, uid) });
});

apiRoutes.get('/albums', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, year, cover_url, week, added_at FROM albums ORDER BY week, id'
  ).all<AlbumRow>();
  return c.json(results.map(toAlbum));
});

apiRoutes.get('/lists', async (c) => {
  const users = await c.env.DB.prepare('SELECT id, nickname, avatar_url FROM users ORDER BY nickname COLLATE NOCASE')
    .all<{ id: string; nickname: string; avatar_url: string | null }>();
  const rankings = await c.env.DB.prepare(
    'SELECT user_id, album_id, tier, position FROM rankings'
  ).all<{ user_id: string; album_id: number; tier: Tier; position: number }>();

  const byUser = new Map<string, Placement[]>();
  for (const r of rankings.results) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push({ albumId: r.album_id, tier: r.tier, position: r.position });
  }
  const lists: UserList[] = users.results.map((u) => ({
    user: { id: u.id, nickname: u.nickname, avatarUrl: u.avatar_url },
    placements: byUser.get(u.id) ?? [],
  }));
  return c.json(lists);
});

// Replace the caller's entire ranking set. Users can only ever write their own rows.
apiRoutes.put('/rankings', async (c) => {
  const uid = c.get('userId');
  const body = (await c.req.json().catch(() => null)) as unknown;
  if (!Array.isArray(body) || body.length > 500) return c.json({ error: 'bad request' }, 400);

  const { results } = await c.env.DB.prepare('SELECT id FROM albums').all<{ id: number }>();
  const validAlbums = new Set(results.map((r) => r.id));

  const seen = new Set<number>();
  const clean: Placement[] = [];
  for (const p of body as Placement[]) {
    if (
      !p ||
      typeof p.albumId !== 'number' ||
      typeof p.position !== 'number' ||
      !TIERS.includes(p.tier)
    ) {
      return c.json({ error: 'bad request' }, 400);
    }
    if (!validAlbums.has(p.albumId) || seen.has(p.albumId)) continue;
    seen.add(p.albumId);
    clean.push({ albumId: p.albumId, tier: p.tier, position: Math.max(0, Math.min(999, Math.floor(p.position))) });
  }

  const now = Date.now();
  const stmts = [c.env.DB.prepare('DELETE FROM rankings WHERE user_id = ?1').bind(uid)];
  for (const p of clean) {
    stmts.push(
      c.env.DB.prepare(
        'INSERT INTO rankings (user_id, album_id, tier, position, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)'
      ).bind(uid, p.albumId, p.tier, p.position, now)
    );
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ---- Admin: album management ----

// Proxy to the iTunes Search API (no CORS from the browser, so the Worker fetches).
apiRoutes.get('/admin/search', adminOnly, async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q) return c.json([]);
  const res = await fetch(
    `https://itunes.apple.com/search?media=music&entity=album&limit=12&term=${encodeURIComponent(q)}`
  );
  if (!res.ok) return c.json({ error: 'search failed' }, 502);
  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return c.json(
    (data.results ?? []).map((r) => ({
      title: (r.collectionName as string) ?? '',
      artist: (r.artistName as string) ?? '',
      year: typeof r.releaseDate === 'string' ? Number(r.releaseDate.slice(0, 4)) : null,
      coverUrl: typeof r.artworkUrl100 === 'string' ? r.artworkUrl100.replace('100x100', '600x600') : null,
    }))
  );
});

apiRoutes.post('/albums', adminOnly, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    title?: string;
    year?: number | null;
    coverUrl?: string | null;
    week?: number;
  } | null;
  const title = body?.title?.trim();
  if (!title) return c.json({ error: 'title required' }, 400);

  let week = body?.week;
  if (typeof week !== 'number' || !Number.isFinite(week)) {
    const max = await c.env.DB.prepare('SELECT COALESCE(MAX(week), 0) AS w FROM albums').first<{ w: number }>();
    week = (max?.w ?? 0) + 1;
  }

  const now = Date.now();
  const res = await c.env.DB.prepare(
    'INSERT INTO albums (title, year, cover_url, week, added_at) VALUES (?1, ?2, ?3, ?4, ?5)'
  )
    .bind(title, body?.year ?? null, body?.coverUrl ?? null, Math.floor(week), now)
    .run();
  const id = res.meta.last_row_id;
  return c.json({ id, title, year: body?.year ?? null, coverUrl: body?.coverUrl ?? null, week, addedAt: now });
});

apiRoutes.patch('/albums/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'bad id' }, 400);
  const body = (await c.req.json().catch(() => null)) as {
    title?: string;
    year?: number | null;
    coverUrl?: string | null;
    week?: number;
  } | null;
  if (!body) return c.json({ error: 'bad request' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT id, title, year, cover_url, week, added_at FROM albums WHERE id = ?1'
  )
    .bind(id)
    .first<AlbumRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const title = body.title !== undefined ? body.title.trim() : existing.title;
  if (!title) return c.json({ error: 'title required' }, 400);
  const year = body.year !== undefined ? body.year : existing.year;
  const coverUrl = body.coverUrl !== undefined ? body.coverUrl : existing.cover_url;
  const week = body.week !== undefined && Number.isFinite(body.week) ? Math.floor(body.week) : existing.week;

  await c.env.DB.prepare('UPDATE albums SET title = ?1, year = ?2, cover_url = ?3, week = ?4 WHERE id = ?5')
    .bind(title, year, coverUrl, week, id)
    .run();
  return c.json({ id, title, year, coverUrl, week, addedAt: existing.added_at });
});

apiRoutes.delete('/albums/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'bad id' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM rankings WHERE album_id = ?1').bind(id),
    c.env.DB.prepare('DELETE FROM albums WHERE id = ?1').bind(id),
  ]);
  return c.json({ ok: true });
});
