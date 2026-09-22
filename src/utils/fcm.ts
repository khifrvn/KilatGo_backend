import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Kirim FCM lewat HTTP v1 API tanpa dependency firebase-admin (menghindari
// npm install berat di shared host). JWT ditandatangani dgn crypto bawaan Node.

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let sa: ServiceAccount | null = null;
let cachedToken: { token: string; exp: number } | null = null;

function loadSA(): ServiceAccount | null {
  if (sa) return sa;
  try {
    const p =
      process.env.FIREBASE_ADMIN_JSON || path.join(process.cwd(), 'secrets', 'firebase-admin.json');
    sa = JSON.parse(fs.readFileSync(p, 'utf8'));
    return sa;
  } catch {
    return null; // belum dikonfigurasi → FCM di-skip diam-diam
  }
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned =
    `${b64({ alg: 'RS256', typ: 'JWT' })}.` +
    b64({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    });
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('FCM token exchange failed');
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

// Apakah FCM sudah dikonfigurasi (secrets/firebase-admin.json ada & valid).
export function isFcmConfigured(): boolean {
  return !!loadSA();
}

// Kembalikan true bila FCM menerima pesan (200). Error di-log & dikembalikan false — tidak melempar.
export async function sendToToken(
  token: string,
  notification: { title: string; body: string },
  data?: Record<string, string>
): Promise<boolean> {
  const account = loadSA();
  if (!account || !token) return false;
  try {
    const accessToken = await getAccessToken(account);
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification,
            data: data ?? {},
            android: {
              priority: 'HIGH',
              // Channel high-importance (dibuat app) → heads-up + suara + getar walau app mati.
              notification: {
                channelId: 'kilatgo_orders',
                sound: 'default',
                defaultVibrateTimings: true,
                notificationPriority: 'PRIORITY_MAX',
              },
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: { aps: { sound: 'default' } },
            },
          },
        }),
      }
    );
    if (!res.ok) {
      console.error('FCM send failed', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('FCM error', e);
    return false;
  }
}
