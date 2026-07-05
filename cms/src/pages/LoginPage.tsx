import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login } from '../api/auth';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@kilatgo.com');
  const [password, setPassword] = useState('KilatGo!Admin2026');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await login({ email, password });
      authLogin(response.token, response.user);
      navigate(response.user.role === 'MERCHANT' ? '/merchant' : '/admin', { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Login failed. Please check your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-kilatgo-950">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-kilatgo-800/40 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-kilatgo-accent/10 blur-3xl" />
        <div className="absolute top-1/4 left-1/3 w-2 h-2 rounded-full bg-kilatgo-accent shadow-[0_0_40px_12px_rgba(250,204,21,0.4)]" />
        <div className="absolute bottom-1/3 right-1/3 w-1.5 h-1.5 rounded-full bg-kilatgo-400 shadow-[0_0_30px_10px_rgba(79,133,246,0.4)]" />
      </div>

      {/* Logo watermark */}
      <div className="absolute top-8 left-8 flex items-center gap-3 z-10">
        <img
          src="/logo_kilatgo_bg.png"
          alt="KilatGo"
          className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-lg shadow-kilatgo-950/50"
        />
        <span className="text-xl font-bold text-white tracking-tight">KilatGo</span>
      </div>

      <div className="w-full max-w-[420px] mx-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl shadow-kilatgo-950/40 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-kilatgo-50 mb-5 ring-1 ring-kilatgo-100">
              <img
                src="/logo_kilatgo_bg.png"
                alt="KilatGo"
                className="w-10 h-10 object-cover rounded-lg"
              />
            </div>
            <h1 className="text-2xl font-bold text-kilatgo-950 mb-2">
              Admin Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Sign in to manage your ride-hailing platform
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-700 leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
                placeholder="admin@kilatgo.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-kilatgo-accent hover:bg-kilatgo-accent-dark disabled:bg-kilatgo-accent-light text-kilatgo-950 font-semibold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-kilatgo-accent/25 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-kilatgo-950/30 border-t-kilatgo-950 rounded-full animate-spin"></div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
