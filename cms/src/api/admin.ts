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

export async function getPendingMerchants(): Promise<Merchant[]> {
  const r = await apiClient.get<ApiResponse<Merchant[]>>('/admin/merchants/pending');
  return r.data.data || [];
}

export async function approveMerchant(id: string, isApproved: boolean): Promise<void> {
  await apiClient.post(`/admin/merchants/${id}/approve`, { isApproved });
}

export async function getAttendance(date?: string): Promise<Attendance[]> {
  const r = await apiClient.get<ApiResponse<Attendance[]>>('/admin/attendance', { params: date ? { date } : undefined });
  return r.data.data || [];
}

export async function verifyKyc(subjectType: 'driver' | 'merchant', subjectId: string, approve: boolean, notes?: string): Promise<void> {
  await apiClient.post(`/admin/kyc/${subjectType}/${subjectId}/verify`, { approve, notes });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<ApiResponse<DashboardStats>>('/admin/dashboard');
  return response.data.data!;
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

export async function approveDriver(driverId: string, isApproved: boolean): Promise<Driver> {
  const response = await apiClient.patch<ApiResponse<Driver>>(
    `/users/drivers/${driverId}/approve`,
    { isApproved }
  );
  return response.data.data!;
}

export async function suspendUser(userId: string): Promise<User> {
  const response = await apiClient.post<ApiResponse<User>>(`/admin/users/${userId}/suspend`);
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



export async function getEarningsReport(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<EarningsReport> {
  const response = await apiClient.get<ApiResponse<EarningsReport>>('/admin/earnings', {
    params,
  });
  return response.data.data!;
}
