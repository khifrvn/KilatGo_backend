// Kirim email lewat HTTP API provider (Resend / SendGrid) tanpa dependency npm —
// pola sama seperti utils/fcm.ts: hindari install berat di shared host.
// Bila belum dikonfigurasi, email tidak dikirim (hanya di-log) supaya alur reset
// masih bisa diuji manual dan permintaan pengguna tidak pernah gagal 500.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function isMailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
}

async function sendViaResend(apiKey: string, from: string, mail: MailInput): Promise<boolean> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    console.error('Resend send failed', res.status, await res.text());
    return false;
  }
  return true;
}

async function sendViaSendgrid(apiKey: string, from: string, mail: MailInput): Promise<boolean> {
  const res = await fetch(SENDGRID_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: mail.to }] }],
      from: { email: from },
      subject: mail.subject,
      // text dulu, html terakhir: klien memilih yang paling didukung.
      content: [
        { type: 'text/plain', value: mail.text },
        { type: 'text/html', value: mail.html },
      ],
    }),
  });
  // SendGrid menjawab 202 Accepted tanpa body saat berhasil.
  if (!res.ok) {
    console.error('SendGrid send failed', res.status, await res.text());
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

  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!resendKey && !sendgridKey) {
    console.warn(`[MAIL SKIP] ${mail.to} | ${mail.subject}`);
    return false;
  }

  try {
    return resendKey
      ? await sendViaResend(resendKey, from, mail)
      : await sendViaSendgrid(sendgridKey as string, from, mail);
  } catch (e) {
    console.error('Mail error', e);
    return false;
  }
}
