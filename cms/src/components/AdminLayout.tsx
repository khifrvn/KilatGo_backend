import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Car,
  Store,
  ShieldCheck,
  CalendarClock,
  ClipboardList,
  DollarSign,
  Banknote,
  Wallet,
  Settings,
  Bug,
  Tag,
  LogOut,
  Menu,
  Zap,
  ChevronRight,
  UserCog,
  TicketPercent,
  UserSearch,
  Bell,
  Package,
  ClipboardPen,
  Headphones,
  Star,
  Smartphone,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { hasPerm } from '../constants/permissions';
import { getPendingCounts, type PendingCounts } from '../api/admin';

// perm: key izin (undefined = boleh semua admin, mis. Dasbor). superOnly: hanya superadmin.
// section: judul kategori di sidebar (dikelompokkan berurutan).
// badgeKey: kunci hitungan "butuh tindakan" dari /admin/pending-counts → badge angka di sidebar.
const navItems: { path: string; label: string; icon: any; perm?: string; superOnly?: boolean; section: string; badgeKey?: 'approval' | 'packages' | 'withdrawals' }[] = [
  { path: '/admin', label: 'Dasbor', icon: LayoutDashboard, section: 'Ringkasan' },
  { path: '/admin/users', label: 'Pelanggan', icon: Users, perm: 'customers', section: 'Pengguna' },
  { path: '/admin/drivers', label: 'Driver', icon: Car, perm: 'drivers', section: 'Pengguna' },
  { path: '/admin/merchants', label: 'Mitra', icon: Store, perm: 'merchants', section: 'Pengguna' },
  { path: '/admin/promos', label: 'Promo Banner', icon: Tag, perm: 'promos', section: 'Operasional' },
  { path: '/admin/broadcast', label: 'Broadcast Notifikasi', icon: Bell, perm: 'notifications', section: 'Operasional' },
  { path: '/admin/support', label: 'Live Chat Support', icon: Headphones, perm: 'support', section: 'Operasional' },
  { path: '/admin/packages', label: 'Paket Mitra', icon: Package, perm: 'packages', section: 'Operasional', badgeKey: 'packages' },
  { path: '/admin/vouchers', label: 'Voucher', icon: TicketPercent, perm: 'vouchers', section: 'Operasional' },
  { path: '/admin/approval', label: 'Persetujuan', icon: ShieldCheck, perm: 'approval', section: 'Operasional', badgeKey: 'approval' },
  { path: '/admin/attendance', label: 'Absensi', icon: CalendarClock, perm: 'attendance', section: 'Operasional' },
  { path: '/admin/orders', label: 'Pesanan', icon: ClipboardList, perm: 'orders', section: 'Operasional' },
  { path: '/admin/manual-orders', label: 'Order Manual', icon: ClipboardPen, perm: 'manual_orders', section: 'Operasional' },
  { path: '/admin/ratings', label: 'Rating & Ulasan', icon: Star, perm: 'ratings', section: 'Operasional' },
  { path: '/admin/earnings', label: 'Pendapatan', icon: DollarSign, perm: 'earnings', section: 'Keuangan' },
  { path: '/admin/withdrawals', label: 'Penarikan', icon: Banknote, perm: 'withdrawals', section: 'Keuangan', badgeKey: 'withdrawals' },
  { path: '/admin/topups', label: 'Isi Saldo', icon: Wallet, perm: 'topups', section: 'Keuangan' },
  { path: '/admin/ppob', label: 'Produk PPOB', icon: Smartphone, perm: 'ppob', section: 'Keuangan' },
  { path: '/admin/settings', label: 'Pengaturan', icon: Settings, perm: 'settings', section: 'Sistem' },
  { path: '/admin/errors', label: 'Log Error', icon: Bug, perm: 'errors', section: 'Sistem' },
  { path: '/admin/accounts', label: 'Akses Akun', icon: UserSearch, superOnly: true, section: 'Sistem' },
  { path: '/admin/admins', label: 'Admin & Hak Akses', icon: UserCog, superOnly: true, section: 'Sistem' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [counts, setCounts] = useState<PendingCounts>({ approval: 0, packages: 0, withdrawals: 0 });

  // Badge "butuh tindakan" di sidebar — refresh saat pindah halaman & tiap 30 detik.
  useEffect(() => {
    let alive = true;
    const load = () => getPendingCounts().then((c) => { if (alive) setCounts(c); }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [location.pathname]);

  // Judul tab hanya untuk admin (di-set via JS). HTML statis tetap "KilatGo" agar
  // pratinjau tautan publik (WhatsApp/sosial) tak menampilkan "Admin".
  useEffect(() => { document.title = 'KilatGo Admin'; return () => { document.title = 'KilatGo'; }; }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Sembunyikan menu yang tak diizinkan (superadmin lihat semua).
  const visibleNav = navItems.filter((item) => (item.superOnly ? user?.isSuperAdmin : hasPerm(user, item.perm)));
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
                  Panel Admin
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
            {visibleNav.map((item, i) => (
              <div key={item.path}>
                {item.section !== visibleNav[i - 1]?.section && (
                  <p className={`px-4 text-[10px] font-semibold uppercase tracking-wider text-kilatgo-400/80 ${i === 0 ? 'mb-2' : 'mt-5 mb-2'}`}>
                    {item.section}
                  </p>
                )}
                <NavLink
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
                  {item.badgeKey && counts[item.badgeKey] > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none">
                      {counts[item.badgeKey] > 99 ? '99+' : counts[item.badgeKey]}
                    </span>
                  )}
                  {location.pathname === item.path && !(item.badgeKey && counts[item.badgeKey] > 0) && (
                    <ChevronRight className="w-4 h-4 ml-auto text-kilatgo-accent" />
                  )}
                </NavLink>
              </div>
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
              Keluar
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
                {currentPage?.label || 'Dasbor'}
              </p>
              <h1 className="text-lg font-semibold text-kilatgo-950 leading-tight">
                {currentPage?.label || 'Dasbor'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-kilatgo-50 rounded-lg border border-kilatgo-100">
              <Zap className="w-4 h-4 text-kilatgo-accent-dark" />
              <span className="text-xs font-medium text-kilatgo-800">
                {user?.isSuperAdmin ? 'SUPERADMIN' : user?.role}
              </span>
            </div>
            <span className="text-sm text-slate-500 hidden md:block">
              {new Date().toLocaleDateString('id-ID', {
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
