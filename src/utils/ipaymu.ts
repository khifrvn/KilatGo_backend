import crypto from 'crypto';
import { getIpaymuConfig } from '../services/settings.service';

// iPaymu Payment (redirect) API v2. Signature = HMAC-SHA256 dari
// `POST:VA:sha256(body):apiKey`. Dipakai untuk top up Dompet Kredit driver.
export async function createRedirectPayment(opts: {
  amount: number;
  referenceId: string;
  productName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}): Promise<{ url: string; sessionId: string } | null> {
  const cfg = await getIpaymuConfig();
  if (!cfg.va || !cfg.apiKey) return null; // iPaymu belum dikonfigurasi

  const body = {
    product: [opts.productName],
    qty: [1],
    price: [opts.amount],
    returnUrl: opts.returnUrl,
    cancelUrl: opts.cancelUrl,
    notifyUrl: opts.notifyUrl,
    referenceId: opts.referenceId,
    buyerName: opts.buyerName,
    buyerEmail: opts.buyerEmail,
    buyerPhone: opts.buyerPhone,
  };
  const bodyJson = JSON.stringify(body);
  const bodyHash = crypto.createHash('sha256').update(bodyJson).digest('hex').toLowerCase();
  const stringToSign = `POST:${cfg.va}:${bodyHash}:${cfg.apiKey}`;
  const signature = crypto.createHmac('sha256', cfg.apiKey).update(stringToSign).digest('hex');

  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

  try {
    const res = await fetch(`${cfg.baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        va: cfg.va,
        signature,
        timestamp,
      },
      body: bodyJson,
    });
    const data = (await res.json()) as { Status?: number; Data?: { Url?: string; SessionID?: string } };
    if (data?.Status !== 200 || !data?.Data?.Url) {
      console.error('iPaymu create payment failed', JSON.stringify(data));
      return null;
    }
    return { url: data.Data.Url, sessionId: data.Data.SessionID ?? '' };
  } catch (e) {
    console.error('iPaymu error', e);
    return null;
  }
}
