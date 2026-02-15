'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentLoginPage() {
  const [grNumber, setGrNumber] = useState('');
  const [dob, setDob] = useState('');
  const [loginAs, setLoginAs] = useState<'student' | 'parent'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grNumber.trim() || !dob) { setError('Please enter GR Number and Date of Birth'); return; }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gr_number: grNumber.trim(), date_of_birth: dob, login_as: loginAs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push(loginAs === 'parent' ? '/parent/dashboard' : '/student/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-body)' }}>
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 30%, #7c3aed 60%, #a855f7 100%)',
          animation: 'meshShift 12s ease-in-out infinite alternate',
        }} />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5"/></svg>
              </div>
              <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>EduTrack</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight mt-12 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Student &amp; Parent<br />Portal
            </h1>
            <p className="text-lg text-white/70 max-w-md">
              Track attendance, view reports, and stay updated with your academic progress.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-white/80">
              <span className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-sm">📊</span>
              <span className="text-sm">View your attendance percentage and daily records</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-sm">📅</span>
              <span className="text-sm">Monthly calendar with present, absent and holiday markers</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-sm">📋</span>
              <span className="text-sm">Subject-wise attendance breakdown</span>
            </div>
          </div>
          <p className="text-xs text-white/40">Powered by EduTrack Attendance Management System</p>
        </div>
      </div>

      {/* RIGHT PANEL — Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5"/></svg>
            </div>
            <span className="text-xl font-bold text-slate-800">EduTrack</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Welcome Back</h2>
          <p className="text-sm text-slate-500 mb-8">Login with your GR Number and Date of Birth</p>

          {/* Login As Toggle */}
          <div className="flex bg-slate-200 rounded-xl p-1 mb-6">
            <button onClick={() => setLoginAs('student')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${loginAs === 'student' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              🎓 Student
            </button>
            <button onClick={() => setLoginAs('parent')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${loginAs === 'parent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              👨‍👩‍👧 Parent
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GR Number / Admission Number</label>
              <input
                type="text"
                value={grNumber}
                onChange={e => setGrNumber(e.target.value)}
                placeholder="Enter GR Number"
                autoFocus
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl text-sm font-bold hover:from-blue-500 hover:to-violet-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                loginAs === 'parent' ? 'Login as Parent' : 'Login as Student'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-400 text-center mb-3">Are you a teacher or administrator?</p>
            <button onClick={() => router.push('/login')} className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all">
              Faculty / Admin Login →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
