import type { Album, AlbumSearchResult, Me, Placement, UserList } from '../shared/types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const api = {
  me: () => req<Me>('/api/me'),
  albums: () => req<Album[]>('/api/albums'),
  lists: () => req<UserList[]>('/api/lists'),
  saveRankings: (placements: Placement[]) => req<{ ok: boolean }>('/api/rankings', jsonInit('PUT', placements)),
  searchAlbums: (q: string) => req<AlbumSearchResult[]>(`/api/admin/search?q=${encodeURIComponent(q)}`),
  addAlbum: (album: { title: string; year: number | null; coverUrl: string | null; week?: number }) =>
    req<Album>('/api/albums', jsonInit('POST', album)),
  updateAlbum: (id: number, patch: Partial<Pick<Album, 'title' | 'year' | 'coverUrl' | 'week'>>) =>
    req<Album>(`/api/albums/${id}`, jsonInit('PATCH', patch)),
  deleteAlbum: (id: number) => req<{ ok: boolean }>(`/api/albums/${id}`, { method: 'DELETE' }),
};
