'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { setMounted(true); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: userData, error: userError } = await fetch('/api/auth/get-user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.user.id }),
      }).then(res => res.json());

      if (userError) throw new Error('Could not fetch user role');

      const role = userData?.role || 'student';
      const routes: Record<string, string> = {
        super_admin: '/super-admin',
        institution_admin: '/admin/dashboard',
        faculty: '/faculty/dashboard',
        student: '/student/dashboard',
        parent: '/parent/dashboard',
      };
      router.push(routes[role] || '/');
    } catch (error: any) {
      setError(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ═══════ LEFT PANEL — Animated gradient + branding ═══════ */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Animated mesh gradient background */}
        <div
          className="absolute inset-0 animate-mesh"
          style={{
            background: 'linear-gradient(-45deg, #0f172a, #1e3a5f, #0c4a6e, #164e63, #134e4a, #1e3a5f, #0f172a)',
          }}
        />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating orbs */}
        <div className="absolute w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #38bdf8, transparent)', top: '10%', left: '15%', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent)', bottom: '5%', right: '10%', animation: 'float 10s ease-in-out infinite reverse' }} />
        <div className="absolute w-48 h-48 rounded-full opacity-10 blur-2xl"
          style={{ background: 'radial-gradient(circle, #34d399, transparent)', top: '55%', left: '50%', animation: 'float 7s ease-in-out infinite 2s' }} />

        {/* Orbiting dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="animate-orbit">
            <div className="w-2 h-2 rounded-full bg-cyan-400/60" />
          </div>
        </div>

        {/* Geometric accents */}
        <div className="absolute top-20 right-16 w-20 h-20 border border-white/10 rounded-2xl rotate-12" style={{ animation: 'float 9s ease-in-out infinite 1s' }} />
        <div className="absolute bottom-32 left-20 w-14 h-14 border border-cyan-400/15 rounded-xl -rotate-6" style={{ animation: 'float 7s ease-in-out infinite 0.5s' }} />
        <div className="absolute top-[40%] right-[30%] w-3 h-3 bg-emerald-400/30 rounded-full" style={{ animation: 'float 5s ease-in-out infinite 2s' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo / Brand */}
          <div className={`${mounted ? 'animate-fade-up' : 'opacity-0'}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <span className="text-white/90 text-xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                EduAttend
              </span>
            </div>
          </div>

          {/* Hero text */}
          <div className="max-w-lg">
            <h1
              className={`text-5xl xl:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6 ${mounted ? 'animate-fade-up delay-200' : 'opacity-0'}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Attendance,{' '}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300 bg-clip-text text-transparent">
                simplified.
              </span>
            </h1>
            <p className={`text-lg text-slate-300/80 leading-relaxed max-w-md ${mounted ? 'animate-fade-up delay-300' : 'opacity-0'}`}>
              Manage students, track attendance, generate reports — all in one powerful platform built for modern institutions.
            </p>

            {/* Stats pills */}
            <div className={`flex gap-4 mt-10 ${mounted ? 'animate-fade-up delay-500' : 'opacity-0'}`}>
              {[
                { n: '500+', l: 'Institutions' },
                { n: '50K+', l: 'Students' },
                { n: '99.9%', l: 'Uptime' },
              ].map((s, i) => (
                <div key={i} className="glass rounded-xl px-5 py-3">
                  <div className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>{s.n}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className={`text-slate-500 text-sm ${mounted ? 'animate-fade-up delay-700' : 'opacity-0'}`}>
            © 2025 EduAttend. Built for The Andhra Education Society.
          </div>
        </div>
      </div>

      {/* ═══════ RIGHT PANEL — Login Form ═══════ */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className={`w-full max-w-md px-8 relative z-10 ${mounted ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <span className="text-slate-800 text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>EduAttend</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Welcome back
            </h2>
            <p className="text-slate-500 mt-2 text-[15px]">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 animate-fade-up">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email address</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@institution.edu"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all shadow-sm hover:border-slate-300"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all shadow-sm hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password link */}
            <div className="flex justify-end">
              <button type="button" className="text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 text-white rounded-xl text-[15px] font-semibold transition-all duration-300 shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <>
                  <span className="relative z-10">Sign in</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/0 via-cyan-600/10 to-cyan-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-50 px-4 text-sm text-slate-400">or</span>
            </div>
          </div>

          {/* Register CTA */}
          <a
            href="/register"
            className="block w-full text-center py-3.5 border-2 border-slate-200 hover:border-slate-300 rounded-xl text-slate-700 hover:text-slate-900 text-[15px] font-medium transition-all duration-200 hover:bg-white hover:shadow-sm"
          >
            Create a new account
          </a>

          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-xs text-slate-400 text-center mb-3">Are you a student or parent?</p>
            <a href="/student-login" className="block w-full text-center py-2.5 bg-gradient-to-r from-blue-50 to-violet-50 text-blue-700 rounded-xl text-sm font-medium hover:from-blue-100 hover:to-violet-100 transition-all border border-blue-200">
              🎓 Student / Parent Login →
            </a>
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            Protected by enterprise-grade encryption
          </p>
        </div>
      </div>
    </div>
  );
}
