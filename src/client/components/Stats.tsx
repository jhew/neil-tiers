import TierBoard from './TierBoard';
import type { Album, Placement, Tier, UserList } from '../../shared/types';

const TIER_SCORE: Record<Tier, number> = { S: 6, A: 5, B: 4, C: 3, D: 2, F: 1 };

function scoreToTier(score: number): Tier {
  if (score >= 5.5) return 'S';
  if (score >= 4.5) return 'A';
  if (score >= 3.5) return 'B';
  if (score >= 2.5) return 'C';
  if (score >= 1.5) return 'D';
  return 'F';
}

interface Props {
  lists: UserList[];
  albums: Album[];
  meId: string;
}

interface AlbumStat {
  album: Album;
  mean: number;
  spread: number; // population std dev, in tier steps
  n: number;
}

export default function Stats({ lists, albums, meId }: Props) {
  // score per album per user
  const scores = new Map<number, { userId: string; score: number }[]>();
  for (const l of lists) {
    for (const p of l.placements) {
      if (!scores.has(p.albumId)) scores.set(p.albumId, []);
      scores.get(p.albumId)!.push({ userId: l.user.id, score: TIER_SCORE[p.tier] });
    }
  }

  const stats: AlbumStat[] = albums
    .map((album) => {
      const s = scores.get(album.id) ?? [];
      if (s.length === 0) return null;
      const mean = s.reduce((sum, x) => sum + x.score, 0) / s.length;
      const variance = s.reduce((sum, x) => sum + (x.score - mean) ** 2, 0) / s.length;
      return { album, mean, spread: Math.sqrt(variance), n: s.length };
    })
    .filter((x): x is AlbumStat => x !== null);

  if (stats.length === 0) return null;

  // Consensus tier list: average placement, ordered best-first within each tier
  const consensus: Placement[] = [...stats]
    .sort((a, b) => b.mean - a.mean)
    .map((s) => ({ albumId: s.album.id, tier: scoreToTier(s.mean), position: 0 }));
  const tierCounters = new Map<Tier, number>();
  for (const p of consensus) {
    const n = tierCounters.get(p.tier) ?? 0;
    p.position = n;
    tierCounters.set(p.tier, n + 1);
  }

  // Controversy: spread of opinions, only meaningful with 2+ raters
  const controversial = stats
    .filter((s) => s.n >= 2)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 8);
  const maxSpread = Math.max(...controversial.map((s) => s.spread), 0.001);

  // Hot takes: biggest gap between one person and everyone else (3+ raters)
  interface HotTake {
    nickname: string;
    isMe: boolean;
    album: Album;
    theirTier: Tier;
    groupTier: Tier;
    diff: number;
  }
  const hotTakes: HotTake[] = [];
  for (const l of lists) {
    for (const p of l.placements) {
      const all = scores.get(p.albumId) ?? [];
      if (all.length < 3) continue;
      const others = all.filter((x) => x.userId !== l.user.id);
      const otherMean = others.reduce((sum, x) => sum + x.score, 0) / others.length;
      const diff = TIER_SCORE[p.tier] - otherMean;
      const album = albums.find((a) => a.id === p.albumId);
      if (album && Math.abs(diff) >= 2) {
        hotTakes.push({
          nickname: l.user.nickname,
          isMe: l.user.id === meId,
          album,
          theirTier: p.tier,
          groupTier: scoreToTier(otherMean),
          diff,
        });
      }
    }
  }
  hotTakes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const raterCount = lists.filter((l) => l.placements.length > 0).length;

  return (
    <section className="stats">
      <h2>The numbers</h2>

      <div className="stat-block">
        <h3>Group consensus</h3>
        <p className="stat-caption">
          Every album's average placement across {raterCount} {raterCount === 1 ? 'ranking' : 'rankings'}.
        </p>
        <TierBoard albums={albums} placements={consensus} />
      </div>

      {controversial.length > 0 && (
        <div className="stat-block">
          <h3>Most divisive</h3>
          <p className="stat-caption">
            How far apart opinions are, in tiers. Higher = the group can't agree.
          </p>
          <div className="bar-chart" role="img" aria-label="Most divisive albums, by spread of opinions">
            {controversial.map((s) => (
              <div className="bar-row" key={s.album.id} title={`${s.album.title}: ±${s.spread.toFixed(1)} tiers across ${s.n} rankings`}>
                <span className="bar-label">{s.album.title}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(s.spread / maxSpread) * 100}%` }} />
                </div>
                <span className="bar-value">±{s.spread.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hotTakes.length > 0 && (
        <div className="stat-block">
          <h3>Hottest takes</h3>
          <ul className="hot-takes">
            {hotTakes.slice(0, 6).map((t, i) => (
              <li key={i}>
                <strong>{t.isMe ? 'You' : t.nickname}</strong> put <em>{t.album.title}</em> in{' '}
                <span className={`tier-pill tier-${t.theirTier}`}>{t.theirTier}</span> — the group has it in{' '}
                <span className={`tier-pill tier-${t.groupTier}`}>{t.groupTier}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
