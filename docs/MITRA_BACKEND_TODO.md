# Mitra (Merchant) — Backend TODO

Merchant/mitra features that are UI-ready or planned but blocked because the backend
(`localhost:3000/api`) has no endpoint yet. Implement the endpoints below, then wire the
Flutter side (`kilatgo_mitra`).

**Conventions (match existing endpoints):**
- Response envelope: `{ "success": true, "data": { ... } }`. App reads `res.data['data']`.
- Auth: `Authorization: Bearer <accessToken>`; 401 → app does one silent `/auth/refresh` + retry.
- JSON keys camelCase. Money = integer rupiah (no decimals). Menu photo = filename only;
  app builds URL as `<imageBase>/menus/<filename>`.

> Single outlet only — multi-outlet is **not** a product requirement. Do not build outlet
> endpoints; the "Tambah cabang / Ganti outlet" buttons should be removed on the app side.

---

### 1. Home: saldo + statistik hari ini  (Home merchant — currently hardcoded `Rp 0`)
`GET /merchants/me/summary`
```json
{ "data": {
  "balance": 0,                 // saldo rupiah
  "today": { "orders": 0, "grossSales": 0 },
  "performaScore": 0,           // 0–100, null if none
  "updatedAt": "2026-07-12T10:00:00Z"
}}
```
Wire: `merchant_home_view.dart` _saldoCard/_performaCard (replace hardcoded values).

### 2. Tab Transaksi  (dashboard index 1 — currently placeholder MerchantSoonView)
- `GET /merchants/orders?status=&page=&limit=` → `{ data: { orders: [Order], page, total } }`
- `GET /merchants/orders/:id` → `{ data: Order }`
- `PATCH /merchants/orders/:id/status` body `{ "status": "ACCEPTED|REJECTED|PREPARING|READY|COMPLETED" }`
```
Order: { id, code, status, customerName, items:[{name, qty, price, note}],
         subtotal, total, paymentMethod, createdAt }
```
Wire: replace `MerchantSoonView(title:'Transaksi')` in dashboard_controller with a real view + controller.

### 3. Restoran buka/tutup — persist server-side  (now local-only via SharedPreferences)
`PATCH /merchants/me` body `{ "isOpen": true }` → `{ data: { isOpen } }`
And add `isOpen` to `GET /merchants/me` response.
Wire: `merchant_controller.setRestoranBuka` currently writes only local prefs — add the PATCH call.

### 4. Atur Stok  (Home tile → currently _soon)
Per-menu stock. Extend menu: add `stock` (int, null = unlimited) to menu objects in
`GET /merchants/me`, and accept it on `PATCH /merchants/menus/:id` (multipart already exists).
Wire: new "Atur Stok" view listing menus with stock stepper.

### 5. Tab Promo  (dashboard index 3 — placeholder)
- `GET /merchants/promos` → `{ data: { promos: [Promo] } }`
- `POST /merchants/promos` body `{ title, type:"PERCENT|AMOUNT", value, minSpend, startAt, endAt }`
- `PATCH /merchants/promos/:id`, `DELETE /merchants/promos/:id`
```
Promo: { id, title, type, value, minSpend, startAt, endAt, isActive }
```

### 6. Laporan  (Home tile → _soon)
`GET /merchants/reports?range=today|week|month` →
`{ data: { grossSales, netSales, orders, avgOrderValue, series:[{date, sales}] } }`

### 7. Payment Link  (Home tile → _soon)
`POST /merchants/payment-links` body `{ amount, note }` → `{ data: { id, url, amount, expiresAt } }`
`GET /merchants/payment-links` → list.

---

**Already-done Flutter side (no backend needed):** tab Lainnya + logout, restoran-buka
local persistence, removed fake trend badge.

**Priority order (highest value first):** 1 (saldo/stats) → 2 (Transaksi) → 3 (isOpen persist)
→ 4 (stok) → 6 (laporan) → 5 (promo) → 7 (payment link).
