import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import Login from './components/Login';
import PeopleBar from './components/PeopleBar';
import TierBoard from './components/TierBoard';
import ListsGrid from './components/ListsGrid';
import Stats from './components/Stats';
import AdminPanel from './components/AdminPanel';
import type { Album, Me, Placement, UserList } from '../shared/types';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [lists, setLists] = useState<UserList[]>([]);
  const [myPlacements, setMyPlacements] = useState<Placement[]>([]);
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const loadData = useCallback(async () => {
    const [a, l] = await Promise.all([api.albums(), api.lists()]);
    setAlbums(a);
    setLists(l);
    return l;
  }, []);

  useEffect(() => {
    if (!me) return;
    loadData().then((l) => {
      const mine = l.find((x) => x.user.id === me.id);
      if (mine) setMyPlacements(mine.placements);
      setLoaded(true);
    });
  }, [me, loadData]);

  function handleChange(placements: Placement[]) {
    if (!me) return;
    setMyPlacements(placements);
    setLists((prev) => prev.map((l) => (l.user.id === me.id ? { ...l, placements } : l)));
    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await api.saveRankings(placements);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 700);
  }

  function jumpTo(userId: string) {
    setQuery('');
    requestAnimationFrame(() => {
      const el = document.getElementById(`list-${userId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      window.setTimeout(() => el.classList.remove('flash'), 1600);
    });
  }

  if (me === undefined) return <div className="center-note">Loading…</div>;
  if (me === null) return <Login />;

  const expandedList = expanded ? lists.find((l) => l.user.id === expanded) : null;
  const currentWeek = albums.reduce((m, a) => Math.max(m, a.week), 0);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Neil Young Tier Lists</h1>
          <span className="subtitle">
            Week {currentWeek} of 40 · {albums.length} {albums.length === 1 ? 'album' : 'albums'} ·{' '}
            {lists.length} {lists.length === 1 ? 'ranker' : 'rankers'}
          </span>
        </div>
        <div className="topbar-me">
          {me.avatarUrl && <img src={me.avatarUrl} alt="" />}
          <span>{me.nickname}</span>
          <a className="ghost" href="/api/auth/logout">
            Sign out
          </a>
        </div>
      </header>

      {!loaded ? (
        <div className="center-note">Loading tier lists…</div>
      ) : (
        <>
          <PeopleBar
            users={lists.map((l) => l.user)}
            query={query}
            onQueryChange={setQuery}
            onJump={jumpTo}
          />

          <section className="my-list">
            <div className="section-head">
              <h2>Your tier list</h2>
              <span className={`save-state ${saveState}`}>
                {saveState === 'saving' && 'Saving…'}
                {saveState === 'saved' && 'Saved'}
                {saveState === 'error' && 'Save failed — check your connection'}
              </span>
            </div>
            <TierBoard albums={albums} placements={myPlacements} editable onChange={handleChange} />
          </section>

          <section>
            <h2>Everyone's lists</h2>
            <ListsGrid lists={lists} albums={albums} meId={me.id} query={query} onExpand={setExpanded} />
          </section>

          <Stats lists={lists} albums={albums} meId={me.id} />

          {me.isAdmin && <AdminPanel albums={albums} onChanged={loadData} />}
        </>
      )}

      {expandedList && (
        <div className="modal-backdrop" onClick={() => setExpanded(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="list-card-head">
              {expandedList.user.avatarUrl && <img src={expandedList.user.avatarUrl} alt="" />}
              <span className="name">{expandedList.user.nickname}</span>
              <button className="ghost" onClick={() => setExpanded(null)}>
                Close
              </button>
            </div>
            <TierBoard albums={albums} placements={expandedList.placements} />
          </div>
        </div>
      )}
    </div>
  );
}
