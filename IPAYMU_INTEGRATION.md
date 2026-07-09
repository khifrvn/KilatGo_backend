# Integrasi Payment Gateway iPaymu — Handoff

Dokumen implementasi untuk mengganti pembayaran **mock** dengan iPaymu asli.
Ditulis sebagai bekal pindah chat — semua path & fakta di bawah sudah diverifikasi dari kode repo per 2026-07-09.

---

## 1. Kondisi saat ini (yang SUDAH ada)

| Hal | Status | Lokasi |
|---|---|---|
| Simpan credential iPaymu (VA, API Key, mode sandbox/production) | ✅ Selesai | `src/services/settings.service.ts` (`ipaymu_va`, `ipaymu_api_key`, `ipaymu_mode`) |
| Admin bisa ubah credential dari web | ✅ Selesai | CMS tab **Pembayaran** — `cms/src/pages/SettingsPage.tsx` |
| Baca credential di backend | ✅ Tersedia | `getSettings()` → `s.ipaymu_va`, `s.ipaymu_api_key`, `s.ipaymu_mode` |
| Pemrosesan pembayaran | ⚠️ **MASIH MOCK** | `src/services/payment.service.ts` — `processPayment()` bikin `TXN-...` palsu, sukses 90% random |
| Model `Payment` | ✅ Ada | `prisma/schema.prisma` model `Payment` (punya `transactionId`, `method`, `status`, `paidAt`) |
| Endpoint payments | ✅ Ada (mock) | `src/routes/payment.routes.ts` → `POST /api/payments/process`, `GET /api/payments`, dll |

**Yang HARUS diganti:** `payment.service.ts::processPayment()` — sekarang mock, jadikan panggilan real iPaymu.

> ⚠️ **PENTING:** JANGAN hardcode credential. Ambil selalu dari `getSettings()` supaya admin bisa ganti dari web. `ipaymu_mode` menentukan base URL sandbox vs production.

---

## 2. Alur order & pembayaran yang ada sekarang

Ringkas dari `src/services/order.service.ts`:

1. Customer `POST /api/orders` → order `status=PENDING`, `paymentMethod` default `CASH`.
2. Driver terima → `ACCEPTED` → ... → `COMPLETED`.
3. Saat `COMPLETED` (`order.service.ts:210`), otomatis dibuat record `Payment`:
   - `CASH` → `status=PENDING` (bayar tunai ke driver, belum lunas di sistem)
   - non-cash → langsung `status=PAID` (**ini bohong** — belum ada gateway)

Enum yang relevan (`schema.prisma`):
- `PaymentMethod`: `CASH | EWALLET | BANK_TRANSFER | CARD`
- `PaymentStatus`: `PENDING | PAID | FAILED | REFUNDED`
- `OrderStatus`: `PENDING | ACCEPTED | DRIVER_ARRIVED | ON_RIDE | COMPLETED | CANCELLED`

**Keputusan alur yang perlu diambil (lihat §7):** iPaymu dipakai untuk bayar **di awal** (sebelum driver jalan) atau **di akhir** (setelah COMPLETED)? Rekomendasi: **bayar di awal untuk non-cash**, CASH tetap bayar tunai ke driver.

---

## 3. Cara kerja iPaymu API (v2)

- **Base URL sandbox:** `https://sandbox.ipaymu.com/api/v2`
- **Base URL production:** `https://my.ipaymu.com/api/v2`
- Pilih base URL dari `s.ipaymu_mode` (`'sandbox'` → sandbox, selain itu production).
- **Tanpa dependency baru:** pakai `crypto` (stdlib Node) + `fetch` (native di Node 22). Tidak perlu `axios`/lib iPaymu.

> ⚠️ Verifikasi skema signature & field body di dokumentasi iPaymu terbaru sebelum production — versi API bisa berubah. Skema di bawah adalah iPaymu v2 yang umum.

### 3.1 Signature (WAJIB benar, kalau salah semua request ditolak)

Header tiap request: `va`, `signature`, `timestamp`, `Content-Type: application/json`.

```ts
import crypto from 'crypto';

function ipaymuHeaders(va: string, apiKey: string, body: object) {
  const bodyHash = crypto.createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
    .toLowerCase();
  const stringToSign = `POST:${va}:${bodyHash}:${apiKey}`;
  const signature = crypto.createHmac('sha256', apiKey)
    .update(stringToSign)
    .digest('hex');
  // timestamp format YYYYMMDDHHmmss (pakai luxon/manual — Date.now boleh di runtime app)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    va,
    signature,
    timestamp,
  };
}
```

### 3.2 Buat pembayaran (redirect / checkout page) — REKOMENDASI MVP

Endpoint: `POST {base}/payment`. iPaymu balikin `Data.Url` (halaman pilih channel: VA / QRIS / e-wallet / retail) + `Data.SessionID`.
Mobile tinggal buka `Url` di webview/browser.

Body minimal:
```json
{
  "product": ["KilatGo Order #<orderNumber>"],
  "qty": [1],
  "price": [<totalFare sebagai number>],
  "returnUrl": "https://kilatgo.com/payment/success",
  "cancelUrl": "https://kilatgo.com/payment/cancel",
  "notifyUrl": "https://api.kilatgo.com/api/payments/ipaymu/callback",
  "referenceId": "<order.id>",
  "buyerName": "<customer name>",
  "buyerPhone": "<customer phone>",
  "buyerEmail": "<customer email>"
}
```
- `referenceId` = `order.id` kita → dipakai mencocokkan saat callback.
- `notifyUrl` HARUS URL publik (server produksi). Untuk tes lokal pakai ngrok/webhook.site.

Respons sukses (bentuk umum):
```json
{ "Status": 200, "Data": { "SessionID": "xxxx", "Url": "https://sandbox.ipaymu.com/...", "TransactionId": 12345 } }
```

### 3.3 Direct API (opsional, kalau mau tampil VA/QRIS di dalam app tanpa webview)

Endpoint `POST {base}/payment/direct` dengan `paymentMethod` (`va`/`qris`/`cstore`) + `paymentChannel` (`bca`, `bni`, dst). Balikin nomor VA / string QR langsung. **Lebih ribet** (per-channel). Skip untuk MVP, pakai redirect (§3.2) dulu.

### 3.4 Cek status transaksi

`POST {base}/transaction` body `{ "transactionId": <id> }` → `Data.Status` / `Data.StatusDesc`. Dipakai untuk re-check kalau callback telat/hilang, atau endpoint polling dari mobile.

---

## 4. Perubahan schema (`prisma/schema.prisma`)

Model `Payment` perlu tambahan field untuk simpan data gateway. Tambah di model `Payment`:

```prisma
  sessionId     String?   @map("session_id")     // iPaymu SessionID
  paymentUrl    String?   @map("payment_url") @db.Text // URL checkout iPaymu
  expiresAt     DateTime? @map("expires_at")
  gatewayResponse String? @map("gateway_response") @db.Text // raw JSON (debug)
```
- `transactionId` yang sudah ada dipakai untuk iPaymu `TransactionId`.
- Tambah `EWALLET`/`BANK_TRANSFER` sudah cukup di enum — **tidak perlu ubah enum** kecuali mau method baru.

> ⚠️ **Migrasi DB = langkah deploy terpisah.** Lihat `DEPLOYMENT.md` bagian "Kalau skema DB berubah". Jalankan `npx prisma migrate deploy` manual di server (bukan `npm ci`). Buat migration lokal dulu: `npx prisma migrate dev --name payment_ipaymu_fields`.

---

## 5. Yang perlu dibuat (checklist implementasi)

### 5.1 Service iPaymu — `src/services/ipaymu.service.ts` (BARU)
- [ ] `getIpaymuConfig()` → baca `getSettings()`, return `{ va, apiKey, baseUrl }` (baseUrl dari mode). Throw `AppError` kalau `va`/`apiKey` kosong ("Payment gateway belum dikonfigurasi").
- [ ] `createPayment(order, customer)` → §3.2, return `{ sessionId, url, transactionId, expiresAt }`.
- [ ] `checkTransaction(transactionId)` → §3.4.
- [ ] Helper `ipaymuHeaders()` (§3.1) + `signAndFetch()`.

### 5.2 Ganti `payment.service.ts::processPayment()`
- [ ] Hapus blok mock (`payment.service.ts:29-66`).
- [ ] Kalau `method === CASH` → tetap seperti sekarang (tak lewat gateway).
- [ ] Kalau non-cash → panggil `ipaymu.createPayment()`, simpan `Payment` dengan `status=PENDING`, `sessionId`, `paymentUrl`, `transactionId`, `expiresAt`. **Return `paymentUrl`** ke mobile (bukan langsung PAID).

### 5.3 Webhook callback — `POST /api/payments/ipaymu/callback` (BARU)
- [ ] Route TANPA `authenticateToken` (iPaymu yang manggil, bukan user). Daftarkan di `payment.routes.ts`.
- [ ] iPaymu kirim form-urlencoded (`express.urlencoded` sudah aktif di `app.ts:29`). Field penting: `trx_id`, `status`, `status_code`, `reference_id` (= `order.id` kita), `sid`.
- [ ] **Verifikasi ke iPaymu** via `checkTransaction(trx_id)` — JANGAN percaya body callback mentah (bisa dipalsukan). Cocokkan status.
- [ ] Update `Payment.status`: `berhasil/success` → `PAID` + `paidAt`; `gagal/expired` → `FAILED`.
- [ ] Balas `200 OK` cepat (iPaymu retry kalau non-200).
- [ ] Idempoten: kalau sudah `PAID`, jangan proses ulang.

### 5.4 (Opsional) Endpoint cek status untuk mobile
- [ ] `GET /api/payments/orders/:orderId` sudah ada — pastikan mengembalikan `status` & `paymentUrl` terbaru untuk polling dari app.

---

## 6. Integrasi ke alur order

Rekomendasi (bayar di awal untuk non-cash):
1. Customer buat order, pilih `paymentMethod`.
2. Kalau non-cash → mobile panggil `POST /api/payments/process` → dapat `paymentUrl` → buka webview.
3. Customer bayar di halaman iPaymu → iPaymu hit `notifyUrl` → callback update `Payment=PAID`.
4. Order baru boleh lanjut dicari driver setelah `PAID` (atau tampilkan status "menunggu pembayaran").
5. CASH → skip gateway, bayar tunai ke driver seperti sekarang.

**Jangan lupa:** logika auto-create Payment saat `COMPLETED` di `order.service.ts:210` perlu disesuaikan supaya tidak dobel dengan Payment yang dibuat di awal untuk non-cash. Untuk CASH biarkan seperti sekarang.

---

## 7. Keputusan yang perlu diambil (tanya user / PM)

1. **Kapan bayar?** Di awal (sebelum driver) atau akhir (setelah selesai)? → memengaruhi §6.
2. **Channel apa saja?** VA saja, atau QRIS + e-wallet + retail? Redirect page (§3.2) kasih semua sekaligus — paling gampang.
3. **Timeout pembayaran** berapa lama? (order di-cancel kalau tak dibayar dalam X menit)
4. **Refund** — perlu otomatis (cancel setelah bayar) atau manual dari admin dulu? `PaymentStatus.REFUNDED` sudah ada tapi belum ada alurnya.

---

## 8. Testing dengan sandbox

Credential sandbox **diisi admin lewat CMS tab Pembayaran** (jangan ditulis di kode/dokumen — ini secret):
- VA: `0000002273624493`
- API Key: *(sandbox key yang diberikan iPaymu — isi di CMS, bukan di sini)*
- Mode: `sandbox`

Alur tes:
1. Isi credential di CMS → simpan.
2. Buat order non-cash lewat API/mobile → dapat `paymentUrl`.
3. Buka URL, bayar pakai simulator sandbox iPaymu.
4. Untuk callback lokal: pakai ngrok/webhook.site sebagai `notifyUrl`, atau tes langsung di server `api.kilatgo.com`.
5. Cek `Payment.status` jadi `PAID`.

---

## 9. Deployment (WAJIB baca `DEPLOYMENT.md`)

- Build lokal (`npx tsc` + `cd cms && npm run build`), upload zip via ssh-stdin, `pkill lsnode`. Detail lengkap di `DEPLOYMENT.md`.
- **Karena schema berubah (§4)**, WAJIB jalankan migrasi manual di server:
  ```bash
  ssh -p 2223 kilb7536@leuser.iixcp.rumahweb.net
  cd ~/repositories/Kilatgo_backend
  source ~/nodevenv/repositories/Kilatgo_backend/*/bin/activate
  npx prisma generate && npx prisma migrate deploy
  ```
- `notifyUrl` callback harus `https://api.kilatgo.com/...` (URL publik) supaya iPaymu bisa hit.

---

## 10. Prinsip

- **Zero dependency baru** — `crypto` + `fetch` cukup. Jangan install lib iPaymu/axios.
- **Credential selalu dari settings**, tidak pernah dari `.env`/hardcode — supaya admin bisa ganti.
- **Verifikasi callback ke iPaymu** (`checkTransaction`), jangan percaya body mentah.
- **Idempoten** di callback (bisa dipanggil berkali-kali).
- Sisakan 1 self-check untuk fungsi signature (§3.1) — gampang salah, dan kalau salah semua gagal senyap.
