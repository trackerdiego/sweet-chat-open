import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ——— Verified VAPID key pair (generated + sign/verify tested in Deno runtime) ———
const VAPID_PUBLIC_KEY = 'BABwZ141awYJTd606MI2vcDLQ8Zma2NwptLkaMbF_CA57z2H7LfgJsyIS3-Oz8GuteLiwJlG8l5kOv9moAErz3E';
const VAPID_PRIVATE_KEY = 'DUWaQNGyLJxOEaSqp1B6OaMScQhpEl_Xe6PQd7Y3QCg';

// ——— Base64URL utilities ———

function base64UrlToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64Url(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// ——— HKDF (RFC 5869) ———

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  // Extract
  const saltKey = await crypto.subtle.importKey(
    'raw',
    salt.length > 0 ? salt : new Uint8Array(32),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));

  // Expand
  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const t1 = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, infoWithCounter));
  return t1.slice(0, length);
}

// ——— RFC 8291: Web Push Payload Encryption (aes128gcm) ———

async function encryptPayload(
  payloadText: string,
  p256dhBase64: string,
  authBase64: string
): Promise<Uint8Array> {
  const enc = new TextEncoder();

  const clientPublicKeyBytes = base64UrlToUint8Array(p256dhBase64);
  const authSecret = base64UrlToUint8Array(authBase64);

  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const serverPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey)
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey },
      serverKeys.privateKey,
      256
    )
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // IKM derivation
  const ikmInfo = concatUint8Arrays(
    enc.encode('WebPush: info\0'),
    clientPublicKeyBytes,
    serverPublicKeyBytes
  );
  const ikm = await hkdf(authSecret, sharedSecret, ikmInfo, 32);

  // CEK and nonce
  const cekInfo = enc.encode('Content-Encoding: aes128gcm\0');
  const contentEncryptionKey = await hkdf(salt, ikm, cekInfo, 16);

  const nonceInfo = enc.encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Pad and encrypt
  const payloadBytes = enc.encode(payloadText);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // final record delimiter

  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentEncryptionKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  // Build aes128gcm record: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = 4096;
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs, false);
  const idlen = new Uint8Array([serverPublicKeyBytes.length]);

  return concatUint8Arrays(salt, rsBytes, idlen, serverPublicKeyBytes, ciphertext);
}

// ——— VAPID JWT (ES256 / RFC 8292) ———

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  if (der[0] !== 0x30) return der;

  let offset = 2;
  if (der[offset] !== 0x02) return der;
  offset++;
  const rLen = der[offset]; offset++;
  let r = der.slice(offset, offset + rLen); offset += rLen;

  if (der[offset] !== 0x02) return der;
  offset++;
  const sLen = der[offset]; offset++;
  let s = der.slice(offset, offset + sLen);

  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);

  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

async function generateVapidJWT(audience: string, subject: string): Promise<string> {
  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY);
  const publicKeyBytes = base64UrlToUint8Array(VAPID_PUBLIC_KEY);

  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: arrayBufferToBase64Url(x),
    y: arrayBufferToBase64Url(y),
    d: arrayBufferToBase64Url(privateKeyBytes),
  };

  const key = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const rawSig = derToRaw(new Uint8Array(signature));
  return `${unsignedToken}.${arrayBufferToBase64Url(rawSig)}`;
}

// ——— Main handler ———

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, url } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'user_id, title, body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-push] ${subscriptions.length} subs for ${user_id}, pubkey starts: ${VAPID_PUBLIC_KEY.substring(0, 20)}`);

    const payload = JSON.stringify({ title, body, url: url || '/' });
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        const encryptedPayload = await encryptPayload(payload, sub.p256dh, sub.auth);

        const audience = new URL(sub.endpoint).origin;
        const jwtToken = await generateVapidJWT(audience, 'mailto:push@influlab.app');

        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            Authorization: `vapid t=${jwtToken}, k=${VAPID_PUBLIC_KEY}`,
            TTL: '86400',
            Urgency: 'high',
          },
          body: encryptedPayload,
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
          console.log(`[send-push] ✓ delivered`);
        } else {
          const respBody = await response.text();
          console.error(`[send-push] ✗ ${response.status}: ${respBody}`);
          if (response.status === 404 || response.status === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            console.log(`[send-push] Removed expired subscription`);
          }
        }
      } catch (e: any) {
        console.error('[send-push] Error:', e.message);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[send-push] Fatal:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});