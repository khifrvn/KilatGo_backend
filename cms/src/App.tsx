import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLayout from './components/AdminLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterDriverPage from './pages/RegisterDriverPage';
import RegisterMerchantPage from './pages/RegisterMerchantPage';
import AttendancePage from './pages/AttendancePage';
import MerchantPortalPage from './pages/MerchantPortalPage';
import SettingsPage from './pages/SettingsPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import DriversPage from './pages/DriversPage';
import ApprovalPage from './pages/ApprovalPage';
import OrdersPage from './pages/OrdersPage';
import EarningsPage from './pages/EarningsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/daftar-driver" element={<RegisterDriverPage />} />
          <Route path="/daftar-merchant" element={<RegisterMerchantPage />} />
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
            <Route path="users" element={<UsersPage />} />
            <Route path="drivers" element={<DriversPage />} />
            <Route path="approval" element={<ApprovalPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
