import type { PublicUser } from '../../shared/types';

interface Props {
  users: PublicUser[];
  query: string;
  onQueryChange: (q: string) => void;
  onJump: (userId: string) => void;
}

export default function PeopleBar({ users, query, onQueryChange, onJump }: Props) {
  const q = query.trim().toLowerCase();
  const visible = q ? users.filter((u) => u.nickname.toLowerCase().includes(q)) : users;
  return (
    <div className="people-bar">
      <input
        type="search"
        placeholder={`Search ${users.length} ${users.length === 1 ? 'person' : 'people'}…`}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Search people"
      />
      <div className="people-row">
        {visible.map((u) => (
          <button key={u.id} className="person" onClick={() => onJump(u.id)} title={u.nickname}>
            {u.avatarUrl && <img src={u.avatarUrl} alt="" loading="lazy" />}
            <span>{u.nickname}</span>
          </button>
        ))}
        {visible.length === 0 && <span className="empty-note">Nobody matches “{query}”.</span>}
      </div>
    </div>
  );
}
