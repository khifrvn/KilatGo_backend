export interface ApiResponse<T = unknown, M = Record<string, unknown>> {
  success: boolean;
  message: string;
  data?: T;
  meta?: M;
  errors?: unknown;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'MERCHANT';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
  createdAt: string;
  updatedAt: string;
}

export interface MerchantMenu {
  id: string;
  name: string;
  price: number | string;
  description?: string | null;
  category?: string | null;
  photo?: string | null;
  isAvailable: boolean;
}

export interface Merchant {
  id: string;
  userId: string;
  businessName: string;
  category?: string | null;
  ownerName: string;
  nik?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  operatingHours?: string | null;
  npwp?: string | null;
  nib?: string | null;
  siup?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankHolder?: string | null;
  ktpPhoto?: string | null;
  outletPhoto?: string | null;
  npwpPhoto?: string | null;
  kycStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  isApproved: boolean;
  user: User;
  menus?: MerchantMenu[];
}

export interface Attendance {
  id: string;
  driverId: string;
  latitude: number;
  longitude: number;
  selfiePhoto?: string | null;
  matchScore?: number | null;
  status: 'PRESENT' | 'FLAGGED';
  checkedAt: string;
  driver?: { user: { name: string; email: string; phone: string } };
}

export interface Driver {
  id: string;
  userId: string;
  vehicleType: string;
  vehiclePlate: string;
  licenseNumber: string;
  status: 'OFFLINE' | 'ONLINE' | 'BUSY';
  rating: number;
  totalRides: number;
  isApproved: boolean;
  user: User;
  // Data lengkap pendaftaran (Fase 1)
  nik?: string | null;
  birthDate?: string | null;
  address?: string | null;
  city?: string | null;
  serviceType?: 'RIDE' | 'CAR';
  simType?: string | null;
  simNumber?: string | null;
  simExpiry?: string | null;
  vehicleBrand?: string | null;
  vehicleYear?: number | null;
  vehicleColor?: string | null;
  stnkNumber?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankHolder?: string | null;
  npwp?: string | null;
  ktpPhoto?: string | null;
  selfiePhoto?: string | null;
  simPhoto?: string | null;
  stnkPhoto?: string | null;
  skckPhoto?: string | null;
  kycStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface Customer {
  id: string;
  userId: string;
  rating: number;
  totalRides: number;
  user: User;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  driverId?: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  distanceKm: number;
  baseFare: number;
  totalFare: number;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
  customer: { user: User };
  driver?: { user: User };
  payment?: Payment;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  status: string;
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
}

export interface DashboardStats {
  users: {
    total: number;
    customers: number;
    drivers: number;
  };
  orders: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
  };
  drivers: {
    pendingApproval: number;
  };
  earnings: number;
  earningsTrend: { date: string; amount: number }[];
  ordersTrend: { date: string; count: number }[];
  userGrowth: { date: string; count: number }[];
  driverStatusDistribution: { status: string; count: number; color: string }[];
  orderStatusDistribution: { status: string; count: number; color: string }[];
  recentOrders: Order[];
  topDrivers: Driver[];
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface EarningsReport {
  total: number;
  count: number;
  payments: Payment[];
}
