# KilatFood — Build Plan (order makanan end-to-end)

Tujuan: customer pesan makanan → mitra terima → driver antar → selesai (bukti foto).
Keputusan produk (2026-07-12): **pakai driver**, **full GoFood-style**, **FCM push + polling**.

## Alur & status order (FOOD)

| # | Langkah | OrderStatus | Aktor |
|---|---|---|---|
| 1 | Customer checkout keranjang | `PENDING` | customer |
| 2 | Notif ke merchant (FCM) + muncul di Transaksi | — | sistem |
| 3 | Merchant terima | `MERCHANT_ACCEPTED` | merchant |
| 4 | Auto-dispatch cari driver | (dispatch jalan) | sistem |
| 5–6 | Driver terima tawaran | `ACCEPTED` | driver |
| 7 | Driver sampai resto, merchant kasih **kode pickup** | `DRIVER_ARRIVED` | merchant→driver |
| 8 | Driver input kode + konfirmasi | `ON_RIDE` (=delivering) | driver |
| 9 | Driver antar | `ON_RIDE` | driver |
| 10 | Sampai customer + **bukti foto** | `COMPLETED` (proofPhoto) | driver |
| 11 | Selesai | `COMPLETED` | — |

Merchant tolak = `CANCELLED` + reason. Reuse enum lama; hanya tambah `MERCHANT_ACCEPTED`.

## Phase 1 — Backend fondasi ✅ DEPLOYED (2026-07-12)
- [x] Schema: `Order` +merchantId +itemsTotal +pickupCode +proofPhoto +items[]; new `OrderItem`; `Merchant` +isOpen +fcmToken +orders[]; enum +`MERCHANT_ACCEPTED`. Migrasi `20260712172423_food_orders`.
- [x] `createOrder` FOOD: terima merchantId+items, pickup=koordinat merchant, dropoff=customer, hitung itemsTotal (+ongkir), generate pickupCode 4-digit, JANGAN dispatch (tunggu merchant).
- [x] Public browse: `GET /merchants` (approved+isOpen), `GET /merchants/:id` (menu publik available).
- [x] Merchant order: `GET /merchants/orders?status=`, `GET /merchants/orders/:id`, `PATCH /merchants/orders/:id/status` body `{action:'accept'|'reject',reason?}`. Accept → `startDispatch`.
- [x] Merchant FCM: `PATCH /merchants/me/fcm-token`; `notifyMerchantNewOrder` saat order FOOD baru.
- [x] Driver: `POST /orders/:id/verify-pickup` {code} (DRIVER_ARRIVED→ON_RIDE), `POST /orders/:id/complete` (multipart photo → COMPLETED+proofPhoto). pickupCode di-strip dari semua response driver.
- [x] State machine: MERCHANT_ACCEPTED→ACCEPTED; dispatch `isOfferable` = PENDING|MERCHANT_ACCEPTED.
- Endpoint live (401), dist terverifikasi. Foto bukti disajikan di `/uploads/proofs`.
- ⚠️ ponytail: kalau semua driver decline, order FOOD nyangkut di MERCHANT_ACCEPTED (tak ada re-dispatch). Tambah retry/notify kalau perlu.

## Phase 2 — Customer app (kilatgo) ✅ CODE DONE (2026-07-12)
- [x] `MerchantsController` + `MerchantProvider.listPublic/getPublic`; `kilat_food_view` di-rewrite → daftar warung asli `GET /merchants` (ganti mockup).
- [x] `merchant_detail_view` — menu publik + add-to-cart, foto menu via `HttpService.imageBaseUrl` (env-aware, ditambah).
- [x] `FoodCartController` (per-warung) + `food_checkout_view` — lokasi dropoff via LocationService+GeocodingService, `POST /orders` serviceType FOOD + merchantId + items + CASH.
- [x] `food_tracking_view` — polling 4s `detailRaw`, timeline 6-status + driver + item + total.
- ⚠️ `outletPhoto` di folder privat (KYC) → kartu warung pakai ikon; foto menu (publik) tampil di detail. Perlu build device utk verifikasi.

## Phase 3 — Mitra app (kilatgo_mitra) ✅ CODE DONE (2026-07-12)
- [x] FCM: plugin google-services dinyalakan (settings + app build.gradle.kts), `firebase_messaging: ^16.0.4`, init di `main_common` (+bg handler), register token di `MerchantController._registerFcm` → `PATCH /merchants/me/fcm-token`, onMessage → refresh Transaksi.
- [x] Tab Transaksi: `TransaksiController` (polling 8s) + `TransaksiView` — list order, Terima/Tolak, status chip, **kode pickup besar** saat DRIVER_ARRIVED. Dipasang di dashboard index 1 (ganti placeholder).
- ⚠️ Perlu build device untuk verifikasi FCM/visual (tak bisa dari sini). Order uji butuh Phase 2 atau seed manual (auto-mode blokir insert prod).

## Phase 4 — Driver app (kilatgo_driver) ✅ CODE DONE (2026-07-12)
- [x] Terima tawaran FOOD — infra offer/dispatch sudah include merchant+items (Phase 1).
- [x] `active_trip_view` cabang FOOD: ACCEPTED→DRIVER_ARRIVED (tiba di resto), DRIVER_ARRIVED→dialog kode → `POST /orders/:id/verify-pickup`, ON_RIDE→kamera bukti → `POST /orders/:id/complete` (multipart).
- ⚠️ Driver harus punya FOOD di enabledServices agar ditawari. Perlu build device utk verifikasi.

## Status: SEMUA PHASE CODE-COMPLETE (2026-07-12)
Backend deployed & verified. 3 Flutter app (customer/mitra/driver) code done, `dart analyze` bersih — perlu `flutter run`/build device untuk verifikasi visual + FCM + kamera. Loop 11-langkah tersambung penuh.

Konvensi: envelope `{success,data}`, Bearer, camelCase, rupiah integer. Deploy tiap perubahan (mysql CLI utk migrasi, kirim dist+client via ssh, pkill). Lihat [[deploy-after-every-change]] / [[prisma-migrate-host-workaround]].
