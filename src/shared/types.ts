export const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'] as const;
export type Tier = (typeof TIERS)[number];

export interface Album {
  id: number;
  title: string;
  year: number | null;
  coverUrl: string | null;
  week: number;
  addedAt: number;
}

export interface Me {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface PublicUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface Placement {
  albumId: number;
  tier: Tier;
  position: number;
}

export interface UserList {
  user: PublicUser;
  placements: Placement[];
}

export interface AlbumSearchResult {
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
}
