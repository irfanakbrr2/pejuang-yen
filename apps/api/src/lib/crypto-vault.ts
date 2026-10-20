/**
 * Credential vault — AES-256-GCM encryption-at-rest untuk credential automation
 * (Repliz token, Telegram bot token, dst). Key diturunkan dari secret env
 * AUTOMATION_ENCRYPTION_KEY via SHA-256. Plaintext hanya didekripsi saat eksекusi
 * di worker, tidak pernah dikembalikan ke frontend.
 */

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface EncryptedSecret {
  ciphertext: string; // base64
  iv: string;         // base64
}

/** Enkripsi object credential (field -> value) jadi {ciphertext, iv} base64. */
export async function encryptSecret(
  fields: Record<string, string>,
  secret: string
): Promise<EncryptedSecret> {
  if (!secret) throw new Error('AUTOMATION_ENCRYPTION_KEY belum dikonfigurasi');
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(fields));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { ciphertext: toBase64(ct), iv: toBase64(iv) };
}

/** Dekripsi balik ke object credential. */
export async function decryptSecret(
  enc: EncryptedSecret,
  secret: string
): Promise<Record<string, string>> {
  if (!secret) throw new Error('AUTOMATION_ENCRYPTION_KEY belum dikonfigurasi');
  const key = await deriveKey(secret);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(enc.iv) },
    key,
    fromBase64(enc.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(pt)) as Record<string, string>;
}
