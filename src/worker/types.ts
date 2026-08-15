export interface Env {
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_GUILD_ID: string;
  ADMIN_DISCORD_IDS: string;
  SESSION_SECRET: string;
  /** Local development only (set via .dev.vars) — enables /api/auth/dev-login. */
  DEV_FAKE_LOGIN?: string;
}

export type AppContext = {
  Bindings: Env;
  Variables: { userId: string };
};

export function isAdmin(env: Env, userId: string): boolean {
  return (env.ADMIN_DISCORD_IDS ?? '').split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
