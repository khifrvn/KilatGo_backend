import { apiClient } from './client';
import type { ApiResponse, Merchant, MerchantMenu } from '../types';

export async function getMyMerchant(): Promise<Merchant> {
  const r = await apiClient.get<ApiResponse<Merchant>>('/merchants/me');
  return r.data.data!;
}

export async function addMenu(form: FormData): Promise<MerchantMenu> {
  const r = await apiClient.post<ApiResponse<MerchantMenu>>('/merchants/menus', form, {
    headers: { 'Content-Type': undefined },
  });
  return r.data.data!;
}
