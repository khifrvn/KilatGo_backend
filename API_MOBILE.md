# KilatGo — API untuk Aplikasi Mobile

Dokumentasi endpoint backend untuk app **Customer**, **Driver**, dan **Merchant**.

- **Base URL:** `https://api.kilatgo.com`
- **Semua path** diawali `/api`
- **Format:** JSON (kecuali upload dokumen/foto → `multipart/form-data`)

## Autentikasi

Login mengembalikan **JWT** (berlaku 7 hari). Sertakan di setiap request yang butuh login:

```
Authorization: Bearer <token>
```

Role di token: `CUSTOMER` · `DRIVER` · `MERCHANT` · `ADMIN`.

## Format Response

Semua response memakai envelope:

```jsonc
// sukses
{ "success": true, "message": "...", "data": { /* ... */ }, "meta": { /* opsional (pagination) */ } }

// gagal
{ "success": false, "message": "Pesan error", "errors": [ /* opsional (detail validasi) */ ] }
```

Kode status: `200` ok · `201` created · `400` validasi · `401` token salah/kadaluarsa · `403` tidak berhak · `404` tidak ada · `409` duplikat · `500` error server.

---

## 🔓 Auth (semua app)

| Method | Endpoint | Body | Ket. |
|---|---|---|---|
| POST | `/api/auth/register/customer` | `{ email, password, phone, name }` | daftar customer |
| POST | `/api/auth/register/driver` | **multipart** (lihat bawah) | daftar driver |
| POST | `/api/merchants/register` | **multipart** (lihat bawah) | daftar mitra usaha |
| POST | `/api/auth/login` | `{ email, password }` | login |

**Response login / register** → `data`:
```jsonc
{
  "token": "eyJ...",
  "user": { "id", "email", "name", "phone", "role", "status" }
}
```

**Register driver** (`multipart/form-data`) — field:
`name, email, phone, password, nik(16 digit), birthDate?, address?, city, serviceType(RIDE|CAR),`
`simType?, simNumber?, simExpiry?, vehicleType, vehiclePlate, licenseNumber, vehicleBrand?, vehicleYear?, vehicleColor?, stnkNumber?,`
`bankName?, bankAccount?, bankHolder?, npwp?, faceDescriptor?(JSON 128 angka)`
File: `ktpPhoto`, `selfiePhoto`, `simPhoto?`, `stnkPhoto?`, `skckPhoto?` (JPG/PNG, ≤5MB) → status awal `PENDING`, tunggu approve admin.

**Register merchant** (`multipart/form-data`) — field:
`ownerName, email, phone, password, nik, businessName, category?, address?, city?, latitude?, longitude?, operatingHours?, npwp?, nib?, siup?, bankName?, bankAccount?, bankHolder?`
File: `ktpPhoto`, `outletPhoto`, `npwpPhoto?`

---

## 📱 Customer App

| Method | Endpoint | Auth | Ket. |
|---|---|---|---|
| GET | `/api/users/profile` | ✅ | profil |
| PATCH | `/api/users/profile` | ✅ | update profil |
| POST | `/api/orders` | ✅ | buat order (lihat body) |
| GET | `/api/orders` | ✅ | riwayat order (mendukung `?status=&page=&limit=`) |
| GET | `/api/orders/:id` | ✅ | detail order |
| PATCH | `/api/orders/:id/cancel` | ✅ | batalkan order |
| POST | `/api/payments/process` | ✅ | proses bayar `{ orderId, method }` |
| GET | `/api/payments/orders/:orderId` | ✅ | pembayaran per order |
| GET | `/api/tracking/orders/:orderId` | ✅ | posisi driver terakhir |
| GET | `/api/notifications` | ✅ | daftar notifikasi |
| PATCH | `/api/notifications/:id/read` | ✅ | tandai dibaca |
| PATCH | `/api/notifications/read-all` | ✅ | tandai semua dibaca |

**Body buat order** `POST /api/orders`:
```jsonc
{
  "pickupLat": -6.2088, "pickupLng": 106.8456, "pickupAddress": "Jl. ...",
  "dropoffLat": -6.19, "dropoffLng": 106.82, "dropoffAddress": "Jl. ...",
  "paymentMethod": "CASH",   // CASH | EWALLET | BANK_TRANSFER | CARD
  "notes": "opsional"
}
```
→ server hitung jarak & tarif otomatis, buat order status `PENDING`.

---

## 🛵 Driver App

| Method | Endpoint | Auth | Ket. |
|---|---|---|---|
| GET | `/api/users/profile` | DRIVER | profil |
| PATCH | `/api/users/driver/profile` | DRIVER | update profil driver |
| GET | `/api/orders/available` | DRIVER | order menunggu driver |
| POST | `/api/orders/:id/accept` | DRIVER | terima order |
| PATCH | `/api/orders/:id/status` | DRIVER | ubah status `{ status }` (DRIVER_ARRIVED, ON_RIDE, COMPLETED) |
| POST | `/api/tracking/online` | DRIVER | set online |
| POST | `/api/tracking/offline` | DRIVER | set offline |
| POST | `/api/tracking/location` | DRIVER | kirim GPS `{ latitude, longitude, orderId? }` |
| POST | `/api/attendance/enroll-face` | DRIVER | daftar wajah referensi `{ faceDescriptor: [128] }` (sekali) |
| POST | `/api/attendance/checkin` | DRIVER | **absen** — multipart `latitude, longitude, faceDescriptor, photo?` |
| GET | `/api/attendance/me` | DRIVER | riwayat absen sendiri |
| POST | `/api/complaints` | DRIVER | lapor kendala `{ subject, message, category? }` |
| GET | `/api/notifications` | ✅ | notifikasi |

**Verifikasi wajah (absen):**
1. Sekali di awal → `enroll-face` kirim descriptor 128 angka (dari **face-api.js** di app).
2. Tiap absen → `checkin` kirim `faceDescriptor` selfie live.
3. Backend bandingkan (ambang 0.6) → `status`: `PRESENT` (cocok) / `FLAGGED` (tidak) + `matchScore` (0..1).

---

## 🏪 Merchant App

| Method | Endpoint | Auth | Ket. |
|---|---|---|---|
| GET | `/api/merchants/me` | MERCHANT | profil usaha + daftar menu |
| POST | `/api/merchants/menus` | MERCHANT | tambah menu — multipart `name, price, category?, description?, photo?` |
| POST | `/api/complaints` | MERCHANT | lapor kendala |
| GET | `/api/notifications` | ✅ | notifikasi |

---

## ⚡ Real-time (Socket.io)

Koneksi:
```js
io("https://api.kilatgo.com", { auth: { token: "<JWT>" } })
```

Event **driver → server**: `driver:online`, `driver:offline`, `driver:location` `{ latitude, longitude, orderId }`
Event **customer → server**: `customer:track` `{ orderId }`, `customer:stop_track`
Event **server → client**: `driver:status`, `driver:location:ack`, `order:location` (ke room `order:<id>`), `customer:tracking`, `error`

---

## Referensi Enum

- **OrderStatus:** `PENDING, ACCEPTED, DRIVER_ARRIVED, ON_RIDE, COMPLETED, CANCELLED`
- **PaymentMethod:** `CASH, EWALLET, BANK_TRANSFER, CARD`
- **PaymentStatus:** `PENDING, PAID, FAILED, REFUNDED`
- **DriverStatus:** `OFFLINE, ONLINE, BUSY`
- **UserStatus:** `ACTIVE, INACTIVE, SUSPENDED, PENDING`
- **AttendanceStatus:** `PRESENT, FLAGGED`

---

## ⚠️ Belum tersedia (perlu dibangun bila mobile butuh)

1. **Alur GoFood** — customer pesan makanan ke merchant, merchant terima/proses order. Order saat ini hanya **ride/kirim** (customer→driver).
2. **Customer lapor kendala** — `/api/complaints` sekarang hanya DRIVER/MERCHANT.
3. **Lupa password / OTP / verifikasi nomor HP.**
4. **Refresh token** — token 7 hari, tanpa refresh.
5. **Payment gateway asli** — masih mock (belum Midtrans/Xendit/dll).
6. **Push notification (FCM/OneSignal)** — notifikasi baru tersimpan di DB, belum dikirim ke perangkat.

> Semua endpoint di atas sudah **live & teruji** di `https://api.kilatgo.com`.
