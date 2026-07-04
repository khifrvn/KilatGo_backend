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
