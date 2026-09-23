// Kirim email reset sandi lewat HTTP API Brevo, tanpa dependency npm — pola sama
// seperti utils/fcm.ts: hindari install berat di shared host. Bila kunci belum
// diatur, email tidak dikirim (hanya di-log) supaya alur reset masih bisa diuji
// manual dan permintaan pengguna tidak pernah gagal 500.
//
// Brevo dipilih sebagai satu-satunya provider: `npm ci` OOM di shared host ini,
// jadi jalur HTTP (bukan SMTP) dan tanpa SDK adalah syarat. Menambah provider
// lain di sini berarti menambah cabang yang harus ikut diuji setiap kali, dan
// hanya satu yang benar-benar dipakai.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/// `MAIL_FROM` ditulis "Nama <email@domain>", tapi Brevo menolak string
/// gabungan: sender harus { name, email } terpisah.
export function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  return m && m[2] ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() };
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function isMailConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

/// Brevo: kunci di header `api-key` (bukan Bearer), body memakai `sender`,
/// `htmlContent`, `textContent`, dan membalas 201 saat diterima.
async function sendViaBrevo(apiKey: string, from: string, mail: MailInput): Promise<boolean> {
  const sender = parseFrom(from);
  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
  });
  if (!res.ok) {
    console.error('Brevo send failed', res.status, await res.text());
    return false;
  }
  return true;
}

/// Kirim satu email. Tidak pernah melempar — pengirim yang gagal dicatat & false.
export async function sendMail(mail: MailInput): Promise<boolean> {
  const from = process.env.MAIL_FROM;
  if (!from) {
    console.warn('MAIL_FROM belum diatur — email dilewati');
    return false;
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn(`[MAIL SKIP] ${mail.to} | ${mail.subject}`);
    return false;
  }

  try {
    return await sendViaBrevo(apiKey, from, mail);
  } catch (e) {
    console.error('Mail error', e);
    return false;
  }
}
