'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DayInfo { date: string; day: number; status: string; }
interface SubjectAtt { subjectName: string; totalLectures: number; attended: number; pct: number; }
interface DashData {
  student: { id: string; first_name: string; last_name: string; roll_number: string; gr_number: string; class_name: string; gender: string; };
  institution: { name: string };
  academicYear: { name: string };
  cumulative: { workingDays: number; present: number; absent: number; pct: number; streak: number; };
  monthly: { workingDays: number; present: number; pct: number; days: DayInfo[]; };
  subjectAtt: SubjectAtt[];
  role: string;
}

export default function StudentDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const router = useRouter();

  useEffect(() => { loadData(); }, [selMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/dashboard-data?month=${selMonth}`);
      if (res.status === 401) { router.push('/student-login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Load error:', err);
      router.push('/student-login');
    } finally { setLoading(false); }
  };

  const logout = async () => { await fetch('/api/auth/student-session', { method: 'DELETE' }); router.push('/student-login'); };

  const statusColor = (s: string) => {
    const map: Record<string, string> = { P: 'bg-emerald-500 text-white', A: 'bg-red-500 text-white', H: 'bg-amber-400 text-white', S: 'bg-slate-300 text-slate-600', L: 'bg-yellow-500 text-white', F: 'bg-slate-100 text-slate-300' };
    return map[s] || 'bg-white text-slate-200 border border-slate-100';
  };

  const monthLabel = (m: string) => { const [yr, mo] = m.split('-').map(Number); return new Date(yr, mo - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
  const prevMonth = () => { const [yr, mo] = selMonth.split('-').map(Number); const d = new Date(yr, mo - 2, 1); setSelMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const nextMonth = () => { const [yr, mo] = selMonth.split('-').map(Number); const d = new Date(yr, mo, 1); if (d > new Date()) return; setSelMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const firstDayOffset = (() => { const [yr, mo] = selMonth.split('-').map(Number); return new Date(yr, mo - 1, 1).getDay(); })();

  if (loading && !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading your dashboard...</p>
      </div>
    </div>
  );

  if (!data) return null;

  const { student: s, cumulative: cum, monthly: mon, subjectAtt, academicYear: ay } = data;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>🎓 {s.first_name} {s.last_name}</h1>
            <p className="text-sm text-white/70">{s.class_name} · Roll No. {s.roll_number} · GR: {s.gr_number}</p>
            <p className="text-xs text-white/50">{data.institution.name}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium backdrop-blur-sm transition-all">Logout</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Low Attendance Warning */}
        {cum.workingDays > 0 && cum.pct < 75 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-800">Low Attendance Alert!</p>
              <p className="text-xs text-red-600">Your attendance is <strong>{cum.pct}%</strong> — below the required 75%. Attend regularly to avoid consequences.</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Overall Attendance</p>
            <p className={`text-3xl font-bold ${cum.pct >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>{cum.pct}%</p>
            <p className="text-[10px] text-slate-400 mt-1">{cum.present}/{cum.workingDays} days</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">This Month</p>
            <p className={`text-3xl font-bold ${mon.pct >= 75 ? 'text-blue-600' : 'text-red-600'}`}>{mon.pct}%</p>
            <p className="text-[10px] text-slate-400 mt-1">{mon.present}/{mon.workingDays} days</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Days Absent</p>
            <p className="text-3xl font-bold text-red-500">{cum.absent}</p>
            <p className="text-[10px] text-slate-400 mt-1">of {cum.workingDays} working days</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Current Streak</p>
            <p className="text-3xl font-bold text-violet-600">{cum.streak} 🔥</p>
            <p className="text-[10px] text-slate-400 mt-1">consecutive days</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-700">Overall Progress</span>
            <span className={`text-sm font-bold ${cum.pct >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>{cum.pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4 relative overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${cum.pct >= 90 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : cum.pct >= 75 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`} style={{ width: `${Math.min(cum.pct, 100)}%` }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-600" style={{ left: '75%' }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-400">0%</span>
            <span className="text-[10px] text-red-400 font-medium" style={{ marginLeft: '50%' }}>75% required</span>
            <span className="text-[10px] text-slate-400">100%</span>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
            <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'var(--font-display)' }}>{monthLabel(selMonth)}</h3>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}
            {mon.days.map(d => (
              <div key={d.day} className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all ${statusColor(d.status)}`} title={`${d.date}: ${d.status || 'N/A'}`}>
                <span className="text-[11px]">{d.day}</span>
                {d.status && d.status !== 'F' && d.status !== '' && <span className="text-[8px] opacity-80">{d.status}</span>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-100">
            {[{ l: 'Present', c: 'bg-emerald-500' }, { l: 'Absent', c: 'bg-red-500' }, { l: 'Holiday', c: 'bg-amber-400' }, { l: 'Weekly Off', c: 'bg-slate-300' }, { l: 'Late', c: 'bg-yellow-500' }].map(x => (
              <div key={x.l} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${x.c}`} /><span className="text-[10px] text-slate-500">{x.l}</span></div>
            ))}
          </div>
        </div>

        {/* Subject-wise */}
        {subjectAtt.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-4" style={{ fontFamily: 'var(--font-display)' }}>Subject-wise Attendance</h3>
            <div className="space-y-3">
              {subjectAtt.map((sub, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 font-medium">{sub.subjectName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{sub.attended}/{sub.totalLectures}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sub.pct >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{sub.pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div className={`h-full rounded-full ${sub.pct >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(sub.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
          <h3 className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>📊 Quick Facts</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/10 rounded-xl p-3"><p className="text-xs text-white/60">Class</p><p className="font-bold">{s.class_name}</p></div>
            <div className="bg-white/10 rounded-xl p-3"><p className="text-xs text-white/60">Academic Year</p><p className="font-bold">{ay.name || '—'}</p></div>
            <div className="bg-white/10 rounded-xl p-3"><p className="text-xs text-white/60">Working Days</p><p className="font-bold">{cum.workingDays}</p></div>
            <div className="bg-white/10 rounded-xl p-3"><p className="text-xs text-white/60">Status</p><p className="font-bold">{cum.pct >= 75 ? '✅ On Track' : '⚠️ Need Improvement'}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
