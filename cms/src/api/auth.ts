import { apiClient } from './client';
import type { ApiResponse, LoginResponse } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
  return response.data.data!;
}

// Pendaftaran driver: multipart (data + dokumen). Content-Type dibiarkan agar browser set boundary.
export async function registerDriver(form: FormData): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/register/driver', form, {
    headers: { 'Content-Type': undefined },
  });
  return response.data.data!;
}
