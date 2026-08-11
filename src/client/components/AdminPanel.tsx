import { useState } from 'react';
import { api } from '../api';
import type { Album, AlbumSearchResult } from '../../shared/types';

interface Props {
  albums: Album[];
  onChanged: () => void;
}

interface Draft {
  title: string;
  year: number | null;
  coverUrl: string | null;
}

export default function AdminPanel({ albums, onChanged }: Props) {
  const nextWeek = albums.reduce((m, a) => Math.max(m, a.week), 0) + 1;
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AlbumSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [week, setWeek] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setError('');
    try {
      setResults(await api.searchAlbums(q));
    } catch {
      setError('Search failed — you can still add the album manually.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function add() {
    if (!draft?.title.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.addAlbum({
        title: draft.title.trim(),
        year: draft.year,
        coverUrl: draft.coverUrl,
        week: week === '' ? undefined : week,
      });
      setDraft(null);
      setResults(null);
      setQ('');
      setWeek('');
      onChanged();
    } catch {
      setError('Adding the album failed — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(album: Album) {
    if (!window.confirm(`Remove "${album.title}"? Everyone's placement of it will be deleted.`)) return;
    await api.deleteAlbum(album.id);
    onChanged();
  }

  async function changeWeek(album: Album, value: string) {
    const w = Number(value);
    if (!Number.isInteger(w) || w < 1 || w === album.week) return;
    await api.updateAlbum(album.id, { week: w });
    onChanged();
  }

  return (
    <section className="admin">
      <h2>Admin — add this week's album</h2>
      <form className="admin-search" onSubmit={search}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search album title (e.g. Harvest)…"
          aria-label="Search for an album"
        />
        <button type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Search covers'}
        </button>
        <button
          type="button"
          onClick={() => setDraft({ title: q.trim(), year: null, coverUrl: null })}
          disabled={!q.trim()}
        >
          Enter manually
        </button>
      </form>

      {results && results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <button
              key={i}
              className={`search-result${draft?.coverUrl === r.coverUrl && draft?.title === r.title ? ' picked' : ''}`}
              onClick={() => setDraft({ title: r.title, year: r.year, coverUrl: r.coverUrl })}
              title={`${r.title} — ${r.artist}${r.year ? ` (${r.year})` : ''}`}
            >
              {r.coverUrl ? <img src={r.coverUrl} alt={r.title} loading="lazy" /> : <span>{r.title}</span>}
              <span className="result-title">
                {r.title}
                {r.year ? ` (${r.year})` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {results && results.length === 0 && <p className="empty-note">No covers found — use “Enter manually”.</p>}

      {draft && (
        <div className="admin-draft">
          {draft.coverUrl && <img src={draft.coverUrl} alt="" />}
          <label>
            Title
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label>
            Year
            <input
              type="number"
              value={draft.year ?? ''}
              onChange={(e) => setDraft({ ...draft, year: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          <label>
            Week
            <input
              type="number"
              min={1}
              placeholder={String(nextWeek)}
              value={week}
              onChange={(e) => setWeek(e.target.value ? Number(e.target.value) : '')}
            />
          </label>
          <button onClick={add} disabled={busy || !draft.title.trim()}>
            {busy ? 'Adding…' : `Add as week ${week === '' ? nextWeek : week}`}
          </button>
          <button className="ghost" onClick={() => setDraft(null)}>
            Cancel
          </button>
        </div>
      )}
      {error && <p className="login-error">{error}</p>}

      {albums.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Album</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {albums.map((a) => (
              <tr key={a.id}>
                <td>
                  <input
                    type="number"
                    min={1}
                    defaultValue={a.week}
                    onBlur={(e) => changeWeek(a, e.target.value)}
                    aria-label={`Week for ${a.title}`}
                  />
                </td>
                <td>
                  {a.title}
                  {a.year ? ` (${a.year})` : ''}
                </td>
                <td>
                  <button className="ghost danger" onClick={() => remove(a)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
