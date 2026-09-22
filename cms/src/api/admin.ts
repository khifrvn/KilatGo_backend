import { apiClient } from './client';
import type {
  ApiResponse,
  DashboardStats,
  Driver,
  EarningsReport,
  Order,
  User,
  Merchant,
  Attendance,
} from '../types';

export interface CustomerKyc {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  ktpPhoto?: string | null;
  selfiePhoto?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankHolder?: string | null;
  note?: string | null;
  updatedAt: string;
}
export async function getCustomerKyc(status?: string): Promise<CustomerKyc[]> {
  const r = await apiClient.get<ApiResponse<CustomerKyc[]>>('/admin/kyc/customers', { params: status ? { status } : undefined });
  return r.data.data ?? [];
}
export async function verifyCustomerKyc(customerId: string, approve: boolean, notes?: string): Promise<void> {
  await apiClient.post(`/admin/kyc/customer/${customerId}/verify`, { approve, notes });
}
export async function resetCustomerKyc(customerId: string): Promise<void> {
  await apiClient.delete(`/admin/kyc/customer/${customerId}`);
}

export interface Withdrawal {
  id: string;
  type?: 'driver' | 'merchant' | 'customer';
  partyName?: string;
  partyPhone?: string | null;
  driverName: string;
  driverPhone?: string | null;
  amount: number;
  adminFee: number;
  netAmount: number;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  status: string;
  rejectionReason: string | null;
  referenceNumber: string | null;
  createdAt: string;
  processedAt: string | null;
}

export async function getWithdrawals(status?: string): Promise<Withdrawal[]> {
  const r = await apiClient.get<ApiResponse<Withdrawal[]>>('/admin/withdrawals', { params: status ? { status } : undefined });
  return r.data.data || [];
}
export async function approveWithdrawal(id: string, referenceNumber: string): Promise<void> {
  await apiClient.post(`/admin/withdrawals/${id}/approve`, { referenceNumber });
}
export async function rejectWithdrawal(id: string, reason: string): Promise<void> {
  await apiClient.post(`/admin/withdrawals/${id}/reject`, { reason });
}

export async function getMerchants(): Promise<Merchant[]> {
  const r = await apiClient.get<ApiResponse<Merchant[]>>('/admin/merchants');
  return r.data.data || [];
}

export async function getPendingMerchants(): Promise<Merchant[]> {
  const r = await apiClient.get<ApiResponse<Merchant[]>>('/admin/merchants/pending');
  return r.data.data || [];
}

export async function approveMerchant(id: string, isApproved: boolean): Promise<void> {
  await apiClient.post(`/admin/merchants/${id}/approve`, { isApproved });
}

export interface MerchantReport {
  balance: number | string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  activeOrders: number;
  grossSales: number;
  todayOrders: number;
  todaySales: number;
  avgOrderValue: number;
}

export async function getMerchantReport(id: string): Promise<MerchantReport> {
  const r = await apiClient.get<ApiResponse<MerchantReport>>(`/admin/merchants/${id}/report`);
  return r.data.data as MerchantReport;
}

export async function setMenuAvailability(menuId: string, isAvailable: boolean): Promise<void> {
  await apiClient.patch(`/admin/menus/${menuId}`, { isAvailable });
}

export interface Promo {
  id: string;
  title: string;
  description?: string | null;
  audience: 'CUSTOMER' | 'DRIVER' | 'MERCHANT';
  placement: 'ALL' | 'FOOD' | 'SEND' | 'RIDE' | 'CAR';
  image?: string | null;
  voucherCode?: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function getPromos(): Promise<Promo[]> {
  const r = await apiClient.get<ApiResponse<Promo[]>>('/admin/promos');
  return r.data.data || [];
}

export interface AdminTopup {
  id: string;
  amount: number;
  status: string;
  referenceId: string;
  role: 'CUSTOMER' | 'DRIVER' | 'MERCHANT';
  who: string;
  note?: string | null;
  createdAt: string;
  paidAt?: string | null;
}
export async function getTopups(): Promise<AdminTopup[]> {
  const r = await apiClient.get<ApiResponse<AdminTopup[]>>('/admin/topups');
  return r.data.data || [];
}
export async function manualTopup(payload: {
  role: 'CUSTOMER' | 'DRIVER' | 'MERCHANT';
  targetId: string;
  amount: number;
  pin: string;
  note?: string;
}): Promise<void> {
  await apiClient.post('/admin/topups/manual', payload);
}
// ===== Voucher (kupon transaksi) =====
export interface Voucher {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discountType: 'PERCENT' | 'FIXED' | 'FREE_ONGKIR';
  value: number;
  maxDiscount?: number | null;
  minSpend: number;
  services: string[];
  startAt: string;
  endAt: string;
  totalQuota?: number | null;
  usedCount: number;
  perUserLimit: number;
  newUserOnly: boolean;
  isActive: boolean;
  createdAt: string;
}
export type VoucherInput = Omit<Voucher, 'id' | 'usedCount' | 'createdAt'>;
export async function getVouchers(): Promise<Voucher[]> {
  const r = await apiClient.get<ApiResponse<Voucher[]>>('/admin/vouchers');
  return r.data.data ?? [];
}
export async function createVoucher(payload: VoucherInput): Promise<void> {
  await apiClient.post('/admin/vouchers', payload);
}
export async function updateVoucher(id: string, payload: VoucherInput): Promise<void> {
  await apiClient.patch(`/admin/vouchers/${id}`, payload);
}
export async function deleteVoucher(id: string): Promise<void> {
  await apiClient.delete(`/admin/vouchers/${id}`);
}

// ===== RBAC: kelola admin (superadmin only) =====
export interface AdminAccount {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string | null;
  status: string;
  isSuperAdmin: boolean;
  permissions: string[];
  createdAt: string;
}
export async function getAdmins(): Promise<AdminAccount[]> {
  const r = await apiClient.get<ApiResponse<AdminAccount[]>>('/admin/admins');
  return r.data.data ?? [];
}
export async function createAdminAccount(payload: {
  name: string; email: string; phone: string; password: string; permissions: string[]; isSuperAdmin?: boolean;
}): Promise<void> {
  await apiClient.post('/admin/admins', payload);
}
export async function updateAdminAccount(id: string, patch: {
  name?: string; permissions?: string[]; isSuperAdmin?: boolean; status?: string; password?: string;
}): Promise<void> {
  await apiClient.patch(`/admin/admins/${id}`, patch);
}
export async function deleteAdminAccount(id: string): Promise<void> {
  await apiClient.delete(`/admin/admins/${id}`);
}

export async function getTopupPinStatus(): Promise<{ isSet: boolean }> {
  const r = await apiClient.get<ApiResponse<{ isSet: boolean }>>('/admin/topup-pin');
  return r.data.data ?? { isSet: false };
}
export async function setTopupPin(pin: string): Promise<void> {
  await apiClient.post('/admin/topup-pin', { pin });
}
export async function resetTopupPin(password: string, newPin: string): Promise<void> {
  await apiClient.post('/admin/topup-pin/reset', { password, newPin });
}
export async function createPromo(form: FormData): Promise<Promo> {
  const r = await apiClient.post<ApiResponse<Promo>>('/admin/promos', form, { headers: { 'Content-Type': undefined } });
  return r.data.data as Promo;
}
export async function updatePromo(id: string, form: FormData): Promise<Promo> {
  const r = await apiClient.patch<ApiResponse<Promo>>(`/admin/promos/${id}`, form, { headers: { 'Content-Type': undefined } });
  return r.data.data as Promo;
}
export async function deletePromo(id: string): Promise<void> {
  await apiClient.delete(`/admin/promos/${id}`);
}

export async function getAttendance(date?: string): Promise<Attendance[]> {
  const r = await apiClient.get<ApiResponse<Attendance[]>>('/admin/attendance', { params: date ? { date } : undefined });
  return r.data.data || [];
}
export async function deleteAttendance(id: string): Promise<void> {
  await apiClient.delete(`/admin/attendance/${id}`);
}

export async function verifyKyc(subjectType: 'driver' | 'merchant', subjectId: string, approve: boolean, notes?: string): Promise<void> {
  await apiClient.post(`/admin/kyc/${subjectType}/${subjectId}/verify`, { approve, notes });
}

export async function getSettings(): Promise<Record<string, string>> {
  const r = await apiClient.get<ApiResponse<Record<string, string>>>('/admin/settings');
  return r.data.data || {};
}
export async function updateSettings(patch: Record<string, string>): Promise<Record<string, string>> {
  const r = await apiClient.put<ApiResponse<Record<string, string>>>('/admin/settings', patch);
  return r.data.data || {};
}

// ===== PPOB (Digiflazz) =====
// Sisa deposit di akun vendor — dipakai admin untuk memastikan saldo cukup
// sebelum mengaktifkan layanan.
export async function getPpobVendorBalance(): Promise<number> {
  const r = await apiClient.get<ApiResponse<{ deposit: number }>>('/admin/ppob/vendor-balance');
  return r.data.data?.deposit ?? 0;
}

export type PpobCatalogItem = {
  sku: string; name: string; category: string; brand: string; type: string; seller: string;
  cost: number; price: number; buyerStatus: boolean; sellerStatus: boolean;
  unlimitedStock: boolean; stock: number; available: boolean; active: boolean;
  startCutOff: string; endCutOff: string; desc: string;
};
export type PpobCatalog = { items: PpobCatalogItem[]; total: number; availableCount: number; selectAll: boolean };

// Katalog MENTAH dari vendor (tanpa filter) — dipakai halaman Produk PPOB.
export async function getPpobCatalog(): Promise<PpobCatalog> {
  const r = await apiClient.get<ApiResponse<PpobCatalog>>('/admin/ppob/catalog');
  return r.data.data ?? { items: [], total: 0, availableCount: 0, selectAll: true };
}

// Daftar SKU yang boleh dijual di app. Kirim array kosong = jual semua.
export async function savePpobActiveSkus(skus: string[]): Promise<number> {
  const r = await apiClient.put<ApiResponse<{ count: number }>>('/admin/ppob/active-skus', { skus });
  return r.data.data?.count ?? 0;
}

// Katalog di-cache 10 menit di backend; ini memaksa ambil ulang dari vendor.
export async function refreshPpobCatalog(): Promise<number> {
  const r = await apiClient.post<ApiResponse<{ count: number }>>('/admin/ppob/refresh-catalog');
  return r.data.data?.count ?? 0;
}

// Unggah musik latar layar perbaikan; server menyimpan URL-nya ke settings.
export async function uploadMaintenanceMusic(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('music', file);
  // Content-Type harus dikosongkan agar axios memasang boundary multipart sendiri.
  const r = await apiClient.post<ApiResponse<{ url: string }>>('/admin/settings/music', fd, { headers: { 'Content-Type': undefined } });
  return r.data.data?.url || '';
}

// Publik (landing) — info kontak, tanpa auth.
export async function getPublicSettings(): Promise<Record<string, string>> {
  const r = await apiClient.get<ApiResponse<Record<string, string>>>('/settings/public');
  return r.data.data || {};
}


export interface ErrorLog {
  id: string;
  level: string;
  statusCode?: number | null;
  message: string;
  path?: string | null;
  method?: string | null;
  stack?: string | null;
  userId?: string | null;
  createdAt: string;
}
export async function getErrors(level?: string): Promise<ErrorLog[]> {
  const r = await apiClient.get<ApiResponse<ErrorLog[]>>('/admin/errors', { params: level ? { level } : undefined });
  return r.data.data || [];
}
export async function clearErrors(): Promise<void> {
  await apiClient.delete('/admin/errors');
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<ApiResponse<DashboardStats>>('/admin/dashboard');
  return response.data.data!;
}

export interface PendingCounts { approval: number; packages: number; withdrawals: number }

export async function getPendingCounts(): Promise<PendingCounts> {
  const response = await apiClient.get<ApiResponse<PendingCounts>>('/admin/pending-counts');
  return response.data.data!;
}

// ===== Akses semua akun (bantuan helpdesk, superadmin) =====
export interface DriverProfile {
  id: string;
  nik?: string | null; birthDate?: string | null; address?: string | null; city?: string | null; serviceType?: string | null;
  simType?: string | null; simNumber?: string | null; simExpiry?: string | null;
  vehicleType?: string | null; vehiclePlate?: string | null; vehicleBrand?: string | null; vehicleYear?: number | null; vehicleColor?: string | null; stnkNumber?: string | null; licenseNumber?: string | null;
  bankName?: string | null; bankAccount?: string | null; bankHolder?: string | null; npwp?: string | null;
  creditBalance: number | string; earningsBalance: number | string;
  selfiePhoto?: string | null; ktpPhoto?: string | null; simPhoto?: string | null; stnkPhoto?: string | null; skckPhoto?: string | null;
}
export interface MerchantProfile {
  id: string; businessName: string; category?: string | null; description?: string | null; ownerName?: string | null; nik?: string | null;
  phone?: string | null; address?: string | null; city?: string | null; operatingHours?: string | null;
  bankName?: string | null; bankAccount?: string | null; bankHolder?: string | null; npwp?: string | null; nib?: string | null; siup?: string | null;
  balance: number | string;
  logo?: string | null; ktpPhoto?: string | null; outletPhoto?: string | null; npwpPhoto?: string | null;
}
export interface UserAccount {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar?: string | null;
  role: 'CUSTOMER' | 'DRIVER' | 'MERCHANT' | 'ADMIN';
  status: string;
  createdAt: string;
  customer?: { id: string; balance: number | string; address?: string | null } | null;
  driver?: DriverProfile | null;
  merchant?: MerchantProfile | null;
}
export async function getUserAccount(userId: string): Promise<UserAccount> {
  const r = await apiClient.get<ApiResponse<UserAccount>>(`/admin/users/${userId}/account`);
  return r.data.data as UserAccount;
}
export async function updateUserAccount(userId: string, patch: {
  name?: string; email?: string; phone?: string;
  driver?: Record<string, unknown>; merchant?: Record<string, unknown>; customer?: Record<string, unknown>;
  password?: string; resetPassword?: boolean;
}): Promise<{ tempPassword?: string; account: UserAccount }> {
  const r = await apiClient.patch<ApiResponse<{ tempPassword?: string; account: UserAccount }>>(`/admin/users/${userId}/account`, patch);
  return r.data.data!;
}
export async function deleteUserAccount(userId: string): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}`);
}
export async function adjustUserBalance(userId: string, payload: {
  amount: number; wallet?: 'CREDIT' | 'EARNINGS'; note?: string; pin: string;
}): Promise<{ account: UserAccount }> {
  const r = await apiClient.post<ApiResponse<{ account: UserAccount }>>(`/admin/users/${userId}/balance`, payload);
  return r.data.data!;
}

// ===== Broadcast notifikasi (FCM + in-app) =====
export interface Broadcast {
  id: string;
  title: string;
  body: string;
  audiences: ('CUSTOMER' | 'DRIVER' | 'MERCHANT')[];
  recipients: number;
  pushed: number;
  createdAt: string;
}
export interface BroadcastResult { recipients: number; withToken: number; pushed: number; fcmReady: boolean; }
export async function broadcastNotification(payload: {
  audiences: ('CUSTOMER' | 'DRIVER' | 'MERCHANT')[]; title: string; body: string;
}): Promise<BroadcastResult> {
  const r = await apiClient.post<ApiResponse<BroadcastResult>>('/admin/notifications/broadcast', payload);
  return r.data.data!;
}
export async function getBroadcasts(): Promise<Broadcast[]> {
  const r = await apiClient.get<ApiResponse<Broadcast[]>>('/admin/notifications/broadcast');
  return r.data.data ?? [];
}

// ===== Live Chat Support (CS) =====
export interface SupportTicketRow {
  id: string;
  subject: string;
  role: 'CUSTOMER' | 'DRIVER' | 'MERCHANT';
  fromName?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  needsAdmin: boolean;
  handledByAdmin: boolean;
  rating?: number | null;
  lastMessage?: string | null;
  unread: number;
  photo?: string | null;
  photoKind?: 'selfie' | 'logo' | 'avatar' | null;
  createdAt: string;
  updatedAt: string;
}
export interface SupportMessage {
  id: string;
  sender: 'USER' | 'BOT' | 'ADMIN';
  body: string;
  createdAt: string;
}
export interface SupportTicketDetail {
  id: string;
  subject: string;
  category?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  needsAdmin: boolean;
  handledByAdmin: boolean;
  closedBy?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  role: 'CUSTOMER' | 'DRIVER' | 'MERCHANT';
  fromName?: string | null;
  messages: SupportMessage[];
  user?: { name: string; email: string; phone: string } | null;
  photo?: string | null;
  photoKind?: 'selfie' | 'logo' | 'avatar' | null;
  createdAt: string;
  resolvedAt?: string | null;
}
export async function getSupportTickets(status?: string): Promise<SupportTicketRow[]> {
  const r = await apiClient.get<ApiResponse<SupportTicketRow[]>>('/admin/support', { params: status ? { status } : undefined });
  return r.data.data ?? [];
}
export async function getSupportTicket(id: string): Promise<SupportTicketDetail> {
  const r = await apiClient.get<ApiResponse<SupportTicketDetail>>(`/admin/support/${id}`);
  return r.data.data!;
}
export async function replySupportTicket(id: string, body: string): Promise<SupportTicketDetail> {
  const r = await apiClient.post<ApiResponse<SupportTicketDetail>>(`/admin/support/${id}/reply`, { body });
  return r.data.data!;
}
export async function closeSupportTicket(id: string): Promise<SupportTicketDetail> {
  const r = await apiClient.post<ApiResponse<SupportTicketDetail>>(`/admin/support/${id}/close`, {});
  return r.data.data!;
}

// ===== Order Manual =====
export interface ManualOrder {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'ACCEPTED' | 'DRIVER_ARRIVED' | 'ON_RIDE' | 'COMPLETED' | 'CANCELLED';
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  custLat: number; custLng: number;
  storeLat: number; storeLng: number;
  items: string | null;
  itemsTotal: number | null;
  itemsKnown: boolean;
  baseFare: number;
  serviceFee: number;
  totalFare: number;
  paymentMethod: 'CASH' | 'EWALLET' | 'BALANCE';
  paymentUrl: string | null;
  paymentPaid: boolean;
  linked: { name: string; email: string; phone: string } | null;
  driver: { id: string; name: string; phone: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ManualOrderInput {
  customerName: string; customerPhone: string; customerAddress: string;
  custLat: number; custLng: number; storeLat: number; storeLng: number;
  items: string; itemsTotal?: number | null;
  paymentMethod: 'CASH' | 'EWALLET' | 'BALANCE';
  linkedCustomerId?: string | null; notes?: string;
}
export async function createManualOrder(payload: ManualOrderInput): Promise<ManualOrder> {
  const r = await apiClient.post<ApiResponse<ManualOrder>>('/admin/manual-orders', payload);
  return r.data.data!;
}
export async function getManualOrders(): Promise<ManualOrder[]> {
  const r = await apiClient.get<ApiResponse<ManualOrder[]>>('/admin/manual-orders');
  return r.data.data ?? [];
}
export async function getManualOrder(id: string): Promise<ManualOrder> {
  const r = await apiClient.get<ApiResponse<ManualOrder>>(`/admin/manual-orders/${id}`);
  return r.data.data!;
}
export async function updateManualOrderPrice(id: string, itemsTotal: number): Promise<ManualOrder> {
  const r = await apiClient.patch<ApiResponse<ManualOrder>>(`/admin/manual-orders/${id}/price`, { itemsTotal });
  return r.data.data!;
}
export async function manualOrderPaymentLink(id: string): Promise<ManualOrder> {
  const r = await apiClient.post<ApiResponse<ManualOrder>>(`/admin/manual-orders/${id}/payment-link`, {});
  return r.data.data!;
}
export async function dispatchManualOrder(id: string, payload: { driverId?: string; auto?: boolean }): Promise<void> {
  await apiClient.post(`/admin/manual-orders/${id}/dispatch`, payload);
}
export async function confirmManualOrderPayment(id: string): Promise<ManualOrder> {
  const r = await apiClient.post<ApiResponse<ManualOrder>>(`/admin/manual-orders/${id}/confirm-payment`, {});
  return r.data.data!;
}
export interface OnlineDriver { id: string; name: string; phone: string; rating: number; }
export async function getOnlineDrivers(): Promise<OnlineDriver[]> {
  const r = await apiClient.get<ApiResponse<OnlineDriver[]>>('/admin/manual-orders/online-drivers');
  return r.data.data ?? [];
}
export interface LinkCustomer { id: string; name: string; email: string; phone: string; }
export async function searchLinkCustomers(q: string): Promise<LinkCustomer[]> {
  const r = await apiClient.get<ApiResponse<LinkCustomer[]>>('/admin/manual-orders/search-customers', { params: { q } });
  return r.data.data ?? [];
}

// ===== Paket Mitra Driver =====
export const PACKAGE_STATUSES = ['PENDING_PAYMENT', 'VERIFIED', 'PROCESSING', 'SHIPPING', 'RECEIVED', 'COMPLETED'] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];
export const PACKAGE_STATUS_LABEL: Record<PackageStatus, string> = {
  PENDING_PAYMENT: 'Verifikasi pembayaran',
  VERIFIED: 'Terverifikasi',
  PROCESSING: 'Proses',
  SHIPPING: 'Dalam Perjalanan',
  RECEIVED: 'Di terima',
  COMPLETED: 'Selesai',
};
export interface PackageOrder {
  id: string;
  amount: number;
  status: PackageStatus;
  referenceId: string;
  adminNote?: string | null;
  items: string[];
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  driverName?: string;
  driverPhone?: string;
}
export async function getPackagePrice(): Promise<{ price: number; items: string[] }> {
  const r = await apiClient.get<ApiResponse<{ price: number; items: string[] }>>('/admin/packages/price');
  return r.data.data!;
}
export async function setPackagePrice(price: number): Promise<void> {
  await apiClient.put('/admin/packages/price', { price });
}
export async function getPackageOrders(): Promise<PackageOrder[]> {
  const r = await apiClient.get<ApiResponse<PackageOrder[]>>('/admin/packages');
  return r.data.data ?? [];
}
export async function updatePackageOrder(id: string, patch: { status?: PackageStatus; adminNote?: string }): Promise<void> {
  await apiClient.patch(`/admin/packages/${id}`, patch);
}

export async function getAllUsers(role?: string): Promise<User[]> {
  const response = await apiClient.get<ApiResponse<User[]>>('/users', {
    params: role ? { role } : undefined,
  });
  return response.data.data || [];
}

export async function getCustomers(): Promise<User[]> {
  const response = await apiClient.get<ApiResponse<User[]>>('/users/customers');
  return response.data.data || [];
}

export async function getDrivers(): Promise<Driver[]> {
  const response = await apiClient.get<ApiResponse<Driver[]>>('/users/drivers');
  return response.data.data || [];
}

export async function getPendingDrivers(): Promise<Driver[]> {
  const response = await apiClient.get<ApiResponse<Driver[]>>('/admin/drivers/pending');
  return response.data.data || [];
}

export async function approveDriver(driverId: string, isApproved: boolean, notes?: string): Promise<Driver> {
  const response = await apiClient.patch<ApiResponse<Driver>>(
    `/users/drivers/${driverId}/approve`,
    { isApproved, ...(notes ? { notes } : {}) }
  );
  return response.data.data!;
}

export async function suspendUser(userId: string, reason?: string): Promise<User> {
  const response = await apiClient.post<ApiResponse<User>>(`/admin/users/${userId}/suspend`, { reason });
  return response.data.data!;
}

export async function activateUser(userId: string): Promise<User> {
  const response = await apiClient.post<ApiResponse<User>>(`/admin/users/${userId}/activate`);
  return response.data.data!;
}

export interface OrdersResponse {
  data: Order[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getAllOrders(params?: {
  status?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<OrdersResponse> {
  const response = await apiClient.get<ApiResponse<Order[], OrdersResponse['meta']>>(
    '/admin/orders',
    { params }
  );
  return {
    data: response.data.data || [],
    meta: response.data.meta!,
  };
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  await apiClient.patch(`/admin/orders/${orderId}/status`, { status });
}



// ===== Rating & ulasan =====
export interface RatingRow {
  id: string;
  target: 'DRIVER' | 'MERCHANT' | 'CUSTOMER';
  byRole: 'CUSTOMER' | 'DRIVER';
  stars: number;
  comment: string | null;
  tip: number;
  createdAt: string;
  order: { id: string; orderNumber: string; serviceType: string };
  subject: { type: string; id: string | null; name: string | null };
  author: { role: string; name: string | null };
}
export interface RatingsResponse {
  summary: { total: number; average: number | null; distribution: Record<string, number> };
  ratings: RatingRow[];
}

export async function getRatings(params?: {
  target?: string;
  subjectId?: string;
  stars?: number;
  withComment?: '1';
  q?: string;
  limit?: number;
}): Promise<RatingsResponse> {
  const res = await apiClient.get<ApiResponse<RatingsResponse>>('/admin/ratings', { params });
  return res.data.data ?? { summary: { total: 0, average: null, distribution: {} }, ratings: [] };
}

export async function getEarningsReport(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<EarningsReport> {
  const response = await apiClient.get<ApiResponse<EarningsReport>>('/admin/earnings', {
    params,
  });
  return response.data.data!;
}
