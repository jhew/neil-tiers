import TierBoard from './TierBoard';
import type { Album, UserList } from '../../shared/types';

interface Props {
  lists: UserList[];
  albums: Album[];
  meId: string;
  query: string;
  onExpand: (userId: string) => void;
}

export default function ListsGrid({ lists, albums, meId, query, onExpand }: Props) {
  const q = query.trim().toLowerCase();
  const ordered = [...lists].sort((a, b) => {
    if (a.user.id === meId) return -1;
    if (b.user.id === meId) return 1;
    return a.user.nickname.localeCompare(b.user.nickname);
  });
  const visible = q ? ordered.filter((l) => l.user.nickname.toLowerCase().includes(q)) : ordered;

  return (
    <div className="lists-grid">
      {visible.map((l) => (
        <div
          key={l.user.id}
          id={`list-${l.user.id}`}
          className={`list-card${l.user.id === meId ? ' mine' : ''}`}
          onClick={() => onExpand(l.user.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onExpand(l.user.id)}
        >
          <div className="list-card-head">
            {l.user.avatarUrl && <img src={l.user.avatarUrl} alt="" loading="lazy" />}
            <span className="name">{l.user.nickname}</span>
            {l.user.id === meId && <span className="badge">you</span>}
            <span className="count">
              {l.placements.length}/{albums.length}
            </span>
          </div>
          <TierBoard albums={albums} placements={l.placements} compact />
        </div>
      ))}
      {visible.length === 0 && <p className="empty-note">No tier lists match that search.</p>}
    </div>
  );
}
