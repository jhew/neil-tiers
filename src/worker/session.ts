const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSession(secret: string, userId: string, days = 30): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ uid: userId, exp: Date.now() + days * 86_400_000 })));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/** Returns the user id if the token is valid and unexpired, else null. */
export async function verifySession(secret: string, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  try {
    const payload = token.slice(0, dot);
    const sigBytes = Uint8Array.from(b64urlDecode(token.slice(dot + 1)), (ch) => ch.charCodeAt(0));
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(b64urlDecode(payload)) as { uid: string; exp: number };
    if (typeof data.uid !== 'string' || Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}
