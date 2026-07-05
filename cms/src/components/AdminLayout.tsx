import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Car,
  ShieldCheck,
  ClipboardList,
  DollarSign,
  LogOut,
  Menu,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/drivers', label: 'Drivers', icon: Car },
  { path: '/admin/approval', label: 'Approval', icon: ShieldCheck },
  { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { path: '/admin/earnings', label: 'Earnings', icon: DollarSign },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const currentPage = navItems.find((item) => item.path === location.pathname);

  return (
    <div className="min-h-screen flex bg-kilatgo-50">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-kilatgo-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky inset-y-0 left-0 z-50 w-72 bg-kilatgo-950 text-white transform transition-transform duration-300 ease-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-20 flex items-center px-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img
                src="/logo_kilatgo_bg.png"
                alt="KilatGo"
                className="w-10 h-10 object-contain bg-white rounded-xl p-1"
              />
              <div>
                <span className="text-lg font-bold text-white tracking-tight block leading-none">
                  KilatGo
                </span>
                <span className="text-[10px] uppercase tracking-wider text-kilatgo-300 font-medium">
                  Admin Panel
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 px-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-kilatgo-800 text-white shadow-lg shadow-kilatgo-950/30'
                      : 'text-kilatgo-200 hover:bg-kilatgo-900/70 hover:text-white'
                  }`
                }
              >
                <item.icon
                  className={`w-5 h-5 mr-3 transition-colors ${
                    location.pathname === item.path
                      ? 'text-kilatgo-accent'
                      : 'text-kilatgo-300 group-hover:text-kilatgo-accent'
                  }`}
                />
                <span className="font-medium text-sm">{item.label}</span>
                {location.pathname === item.path && (
                  <ChevronRight className="w-4 h-4 ml-auto text-kilatgo-accent" />
                )}
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 m-4 bg-kilatgo-900/60 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-kilatgo-700 flex items-center justify-center font-semibold text-kilatgo-accent border border-kilatgo-accent/30">
                {user?.name.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-medium text-sm text-white truncate">{user?.name}</p>
                <p className="text-xs text-kilatgo-300 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2.5 rounded-xl hover:bg-slate-100 transition"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>

            <div className="hidden lg:block">
              <p className="text-xs font-medium text-kilatgo-500 uppercase tracking-wider">
                {currentPage?.label || 'Dashboard'}
              </p>
              <h1 className="text-lg font-semibold text-kilatgo-950 leading-tight">
                {currentPage?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-kilatgo-50 rounded-lg border border-kilatgo-100">
              <Zap className="w-4 h-4 text-kilatgo-accent-dark" />
              <span className="text-xs font-medium text-kilatgo-800">
                {user?.role}
              </span>
            </div>
            <span className="text-sm text-slate-500 hidden md:block">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
