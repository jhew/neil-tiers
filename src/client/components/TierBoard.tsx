import { useState } from 'react';
import { TIERS } from '../../shared/types';
import type { Album, Placement, Tier } from '../../shared/types';

interface Props {
  albums: Album[];
  placements: Placement[];
  editable?: boolean;
  compact?: boolean;
  onChange?: (placements: Placement[]) => void;
}

function normalize(placements: Placement[]): Placement[] {
  const counters = new Map<Tier, number>();
  return placements.map((p) => {
    const n = counters.get(p.tier) ?? 0;
    counters.set(p.tier, n + 1);
    return { ...p, position: n };
  });
}

export default function TierBoard({ albums, placements, editable = false, compact = false, onChange }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const byId = new Map(albums.map((a) => [a.id, a]));
  const placedIds = new Set(placements.map((p) => p.albumId));
  const shelf = albums.filter((a) => !placedIds.has(a.id));

  function place(albumId: number, tier: Tier | null) {
    if (!onChange) return;
    let next = placements.filter((p) => p.albumId !== albumId);
    if (tier) {
      next = [...next, { albumId, tier, position: 9999 }];
      // keep tier order stable: existing order, new album last
      next.sort((a, b) => (a.tier === b.tier ? a.position - b.position : 0));
    }
    onChange(normalize(next));
    setSelected(null);
  }

  function dropHandler(tier: Tier | null) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const id = Number(e.dataTransfer.getData('text/plain'));
      if (id) place(id, tier);
    };
  }

  function chip(album: Album) {
    const isSelected = selected === album.id;
    return (
      <div
        key={album.id}
        className={`chip${isSelected ? ' selected' : ''}`}
        draggable={editable}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(album.id));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={
          editable
            ? (e) => {
                e.stopPropagation();
                setSelected((sel) => (sel === album.id ? null : album.id));
              }
            : undefined
        }
        title={`${album.title}${album.year ? ` (${album.year})` : ''} — week ${album.week}`}
      >
        {album.coverUrl ? (
          <img src={album.coverUrl} alt={album.title} loading="lazy" draggable={false} />
        ) : (
          <span className="chip-fallback">{album.title}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`tier-board${compact ? ' compact' : ''}${editable ? ' editable' : ''}`}>
      {TIERS.map((tier) => {
        const items = placements
          .filter((p) => p.tier === tier)
          .sort((a, b) => a.position - b.position)
          .map((p) => byId.get(p.albumId))
          .filter((a): a is Album => a !== undefined);
        return (
          <div className="tier-row" key={tier}>
            <div className={`tier-label tier-${tier}`}>{tier}</div>
            <div
              className="tier-cells"
              onDragOver={editable ? (e) => e.preventDefault() : undefined}
              onDrop={editable ? dropHandler(tier) : undefined}
              onClick={editable && selected !== null ? () => place(selected, tier) : undefined}
            >
              {items.map(chip)}
            </div>
          </div>
        );
      })}
      {editable && (
        <>
          <div className="shelf-header">
            <span>Unranked albums</span>
            <span className="hint">Drag covers into a tier — or tap an album, then tap a tier row.</span>
          </div>
          <div
            className="tier-cells shelf"
            onDragOver={(e) => e.preventDefault()}
            onDrop={dropHandler(null)}
            onClick={selected !== null ? () => place(selected, null) : undefined}
          >
            {shelf.length === 0 && placements.length === 0 ? (
              <span className="empty-note">No albums yet — they appear here as they're added each week.</span>
            ) : shelf.length === 0 ? (
              <span className="empty-note">All albums ranked. Drop one here to un-rank it.</span>
            ) : (
              shelf.map(chip)
            )}
          </div>
        </>
      )}
    </div>
  );
}
