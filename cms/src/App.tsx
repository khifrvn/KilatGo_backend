import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getPublicSettings } from './api/admin';
import MaintenancePage from './pages/MaintenancePage';
import AdminLayout from './components/AdminLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterDriverPage from './pages/RegisterDriverPage';
import RegisterMerchantPage from './pages/RegisterMerchantPage';
import AttendancePage from './pages/AttendancePage';
import MerchantPortalPage from './pages/MerchantPortalPage';
import SettingsPage from './pages/SettingsPage';
import ErrorLogPage from './pages/ErrorLogPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import DriversPage from './pages/DriversPage';
import MerchantsPage from './pages/MerchantsPage';
import PromoPage from './pages/PromoPage';
import TopupsPage from './pages/TopupsPage';
import ApprovalPage from './pages/ApprovalPage';
import OrdersPage from './pages/OrdersPage';
import EarningsPage from './pages/EarningsPage';
import RatingsPage from './pages/RatingsPage';
import WithdrawalsPage from './pages/WithdrawalsPage';
import AdminsPage from './pages/AdminsPage';
import AccountAccessPage from './pages/AccountAccessPage';
import BroadcastPage from './pages/BroadcastPage';
import PackagesPage from './pages/PackagesPage';
import ManualOrdersPage from './pages/ManualOrdersPage';
import SupportPage from './pages/SupportPage';
import VouchersPage from './pages/VouchersPage';
import PpobProductsPage from './pages/PpobProductsPage';
import { FaqPage, RefundPage, TermsPage, ContactPage, PrivacyPage } from './pages/InfoPages';
import { hasPerm } from './constants/permissions';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Blokir sub-admin membuka menu di luar izinnya (walau tahu URL-nya).
function RequirePerm({ perm, superOnly, children }: { perm?: string; superOnly?: boolean; children: React.ReactNode }) {
  const { user } = useAuth();
  const ok = superOnly ? user?.isSuperAdmin : hasPerm(user, perm);
  return ok ? <>{children}</> : <Navigate to="/admin" replace />;
}

// Mode perbaikan: semua halaman publik diganti layar perbaikan. /login & /admin
// tetap terbuka supaya admin bisa masuk dan mematikannya lagi.
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [state, setState] = useState<{ on: boolean; msg: string; music: string } | null>(null);
  const exempt = pathname.startsWith('/login') || pathname.startsWith('/admin');

  useEffect(() => {
    if (exempt) return;
    const check = () =>
      getPublicSettings()
        .then((s) => setState({ on: s.maintenance_mode === '1', msg: s.maintenance_message || '', music: s.maintenance_music_url || '' }))
        .catch(() => setState({ on: false, msg: '', music: '' })); // server tak terjawab → jangan kunci halaman
    check();
    // Cek ulang berkala supaya halaman pulih sendiri begitu admin mematikan mode.
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [exempt]);

  if (exempt) return <>{children}</>;
  if (!state) return null; // sekejap, hindari kedip landing sebelum status diketahui
  return state.on ? <MaintenancePage message={state.msg} musicUrl={state.music} /> : <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MaintenanceGate>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/daftar-driver" element={<RegisterDriverPage />} />
          <Route path="/daftar-merchant" element={<RegisterMerchantPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/refund-policy" element={<RefundPage />} />
          <Route path="/syarat-ketentuan" element={<TermsPage />} />
          <Route path="/kebijakan-privasi" element={<PrivacyPage />} />
          <Route path="/kontak" element={<ContactPage />} />
          <Route path="/merchant" element={<ProtectedRoute><MerchantPortalPage /></ProtectedRoute>} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<RequirePerm perm="customers"><UsersPage /></RequirePerm>} />
            <Route path="drivers" element={<RequirePerm perm="drivers"><DriversPage /></RequirePerm>} />
            <Route path="merchants" element={<RequirePerm perm="merchants"><MerchantsPage /></RequirePerm>} />
            <Route path="promos" element={<RequirePerm perm="promos"><PromoPage /></RequirePerm>} />
            <Route path="broadcast" element={<RequirePerm perm="notifications"><BroadcastPage /></RequirePerm>} />
            <Route path="support" element={<RequirePerm perm="support"><SupportPage /></RequirePerm>} />
            <Route path="packages" element={<RequirePerm perm="packages"><PackagesPage /></RequirePerm>} />
            <Route path="vouchers" element={<RequirePerm perm="vouchers"><VouchersPage /></RequirePerm>} />
            <Route path="approval" element={<RequirePerm perm="approval"><ApprovalPage /></RequirePerm>} />
            <Route path="attendance" element={<RequirePerm perm="attendance"><AttendancePage /></RequirePerm>} />
            <Route path="orders" element={<RequirePerm perm="orders"><OrdersPage /></RequirePerm>} />
            <Route path="manual-orders" element={<RequirePerm perm="manual_orders"><ManualOrdersPage /></RequirePerm>} />
            <Route path="ratings" element={<RequirePerm perm="ratings"><RatingsPage /></RequirePerm>} />
            <Route path="earnings" element={<RequirePerm perm="earnings"><EarningsPage /></RequirePerm>} />
            <Route path="withdrawals" element={<RequirePerm perm="withdrawals"><WithdrawalsPage /></RequirePerm>} />
            <Route path="topups" element={<RequirePerm perm="topups"><TopupsPage /></RequirePerm>} />
            <Route path="ppob" element={<RequirePerm perm="ppob"><PpobProductsPage /></RequirePerm>} />
            <Route path="settings" element={<RequirePerm perm="settings"><SettingsPage /></RequirePerm>} />
            <Route path="errors" element={<RequirePerm perm="errors"><ErrorLogPage /></RequirePerm>} />
            <Route path="accounts" element={<RequirePerm superOnly><AccountAccessPage /></RequirePerm>} />
            <Route path="admins" element={<RequirePerm superOnly><AdminsPage /></RequirePerm>} />
          </Route>
        </Routes>
        </MaintenanceGate>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
