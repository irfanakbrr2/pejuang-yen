import type { Env } from '../env';

/**
 * Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) di atas Web Crypto Cloudflare Workers.
 * Tidak ada dependency Node — semua via crypto.subtle.
 *
 * Butuh env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url raw P-256),
 * dan VAPID_SUBJECT (mailto:...). Generate sekali via web-push CLI atau util ECDSA P-256.
 */

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string; // base64url
  auth: string; // base64url
}

// ─── base64url helpers ──────────────────────────────────────────────────────
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// ─── HKDF via Web Crypto ────────────────────────────────────────────────────
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// ─── VAPID JWT (ES256) ──────────────────────────────────────────────────────
async function importVapidSigningKey(env: Env): Promise<CryptoKey> {
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY || ''); // 65 bytes (0x04 || x || y)
  const priv = b64urlToBytes(env.VAPID_PRIVATE_KEY || ''); // 32 bytes (d)
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: bytesToB64url(priv),
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function buildVapidToken(env: Env, audience: string): Promise<string> {
  const header = bytesToB64url(strToBytes(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToB64url(
    strToBytes(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT || 'mailto:admin@pejuangyen.com',
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const key = await importVapidSigningKey(env);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    strToBytes(signingInput) as BufferSource
  );
  return `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
}

// ─── aes128gcm payload encryption (RFC 8291) ────────────────────────────────
async function encryptPayload(plaintext: Uint8Array, sub: PushSubscriptionRecord) {
  const uaPublic = b64urlToBytes(sub.p256dh); // 65 bytes
  const authSecret = b64urlToBytes(sub.auth); // 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Ephemeral server ECDH keypair
  const serverKeys = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )) as CryptoKeyPair;
  const asPublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', serverKeys.publicKey)) as ArrayBuffer
  ); // 65 bytes

  const uaKey = await crypto.subtle.importKey('raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaKey } as any,
    serverKeys.privateKey,
    256
  );
  const ecdhSecret = new Uint8Array(ecdhBits); // 32 bytes

  // IKM = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0"||ua_public||as_public, 32)
  const keyInfo = concat(strToBytes('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // CEK & NONCE (RFC 8188)
  const cekInfo = concat(strToBytes('Content-Encoding: aes128gcm'), new Uint8Array([0]));
  const nonceInfo = concat(strToBytes('Content-Encoding: nonce'), new Uint8Array([0]));
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Record = plaintext || 0x02 (last-record delimiter), no extra padding
  const record = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aesKey, record as BufferSource)
  );

  // Header: salt(16) || rs(4) || idlen(1)=65 || keyid(as_public 65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export interface WebPushResult {
  ok: boolean;
  status: number;
  gone: boolean; // 404/410 → langganan harus dihapus
}

/**
 * Kirim satu notifikasi push. payload akan di-JSON-kan dan dibaca service worker.
 * Never throws — kembalikan status untuk caller.
 */
export async function sendWebPush(
  env: Env,
  sub: PushSubscriptionRecord,
  payload: { title: string; body?: string; url?: string; tag?: string; icon?: string }
): Promise<WebPushResult> {
  try {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
      return { ok: false, status: 0, gone: false };
    }
    const body = await encryptPayload(strToBytes(JSON.stringify(payload)), sub);
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const token = await buildVapidToken(env, audience);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '2419200',
        Authorization: `vapid t=${token}, k=${env.VAPID_PUBLIC_KEY}`,
      },
      body: body as BufferSource,
    });
    return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch (err) {
    console.error('[web-push] send failed:', err);
    return { ok: false, status: 0, gone: false };
  }
}
