'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

/* ─── Inline SVG Icon helper ─── */
const icons: Record<string, JSX.Element> = {
  book: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
  calendar: <><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  clipboardCheck: <><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></>,
  pen: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  barChart: <><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>,
  grid: <><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  chevron: <><polyline points="9 18 15 12 9 6"/></>,
  checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  alertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
};
const SvgIcon = ({ name, size = 20 }: { name: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>
);

export default function FacultyDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({ sessions: 0, present: 0, absent: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user?.faculty?.id) { loadData(); } }, [user]);

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/login'); return; }
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (!userData || (userData.role !== 'faculty' && userData.role !== 'super_admin')) { router.push('/login'); return; }
    const { data: facultyData } = await supabase.from('faculty').select('*').eq('user_id', userData.id).single();
    setUser({ ...userData, faculty: facultyData });
  };

  const loadData = async () => {
    // My classes (class teacher)
    const { data: classes } = await supabase.from('classes').select('id, name')
      .eq('class_teacher_id', user.faculty.id).eq('is_active', true).order('name');
    setMyClasses(classes || []);

    // My subjects
    const { data: assignments } = await supabase.from('faculty_subject_assignments').select('id, subjects(name, code), classes(name)')
      .eq('faculty_id', user.faculty.id).eq('is_active', true);
    setMySubjects(assignments || []);

    // Today's sessions
    const today = new Date().toISOString().split('T')[0];
    const { data: sessions } = await supabase.from('lecture_sessions').select('id, lecture_attendance(status)')
      .eq('faculty_id', user.faculty.id).eq('date', today);
    if (sessions) {
      let p = 0, a = 0;
      sessions.forEach((s: any) => s.lecture_attendance?.forEach((la: any) => { la.status === 'present' ? p++ : a++; }));
      setTodayStats({ sessions: sessions.length, present: p, absent: a });
    }
    setLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const navItems = [
    { label: 'Dashboard', href: '/faculty/dashboard', icon: 'home', color: 'from-slate-600 to-slate-700', active: true },
    { label: 'Mark Lecture Attendance', href: '/faculty/lecture-attendance', icon: 'pen', color: 'from-indigo-500 to-indigo-600' },
    { label: 'Daily Class Attendance', href: '/faculty/attendance', icon: 'clipboardCheck', color: 'from-emerald-500 to-emerald-600' },
    { label: 'Daily Overview', href: '/faculty/daily-overview', icon: 'eye', color: 'from-purple-500 to-purple-600' },
    { label: 'Reports', href: '/super-admin/reports', icon: 'barChart', color: 'from-emerald-500 to-green-600' },
  ];

  const quickActions = [
    { label: 'Mark Lecture Attendance', desc: 'Record per-lecture attendance for your subjects', href: '/faculty/lecture-attendance', icon: 'pen', color: 'from-indigo-500 to-indigo-600' },
    { label: 'Daily Class Attendance', desc: 'Mark full-day attendance for your class', href: '/faculty/attendance', icon: 'clipboardCheck', color: 'from-emerald-500 to-emerald-600' },
    { label: 'Daily Overview', desc: 'View all lecture sessions for today', href: '/faculty/daily-overview', icon: 'eye', color: 'from-purple-500 to-purple-600' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
            <span className="text-white"><SvgIcon name="book" size={24} /></span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const firstName = user?.faculty?.first_name || user?.full_name?.split(' ')[0] || 'Teacher';

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ═══════ SIDEBAR ═══════ */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300 fixed inset-y-0 left-0 z-30`}>
        <div className="h-16 flex items-center px-5 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <span className="text-white"><SvgIcon name="book" size={18} /></span>
          </div>
          {sidebarOpen && (
            <span className="ml-3 text-[17px] font-bold tracking-tight animate-fade-in" style={{ fontFamily: 'var(--font-display)' }}>
              Faculty Portal
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item, i) => (
            <button
              key={i}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                item.active ? 'bg-white/[0.08] text-white' : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              } ${!sidebarOpen ? 'justify-center' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shrink-0 opacity-80 group-hover:opacity-100 transition-all`}>
                <span className="text-white"><SvgIcon name={item.icon} size={16} /></span>
              </div>
              {sidebarOpen && <span className="font-medium truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* My Classes */}
        {sidebarOpen && myClasses.length > 0 && (
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <div className="text-[10px] font-bold text-slate-500 tracking-[0.15em] mb-2">CLASS TEACHER</div>
            {myClasses.map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-slate-300">{c.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-white/[0.06] p-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {sidebarOpen && <span className="font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ═══════ MAIN ═══════ */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200/60 flex items-center justify-between px-6 sticky top-0 z-20">
          <div>
            <h1 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Faculty Dashboard</h1>
            <p className="text-xs text-slate-400 -mt-0.5">
              {currentTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {user?.faculty?.employee_id && (
              <div className="hidden md:flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-2 border border-slate-100">
                <span className="text-xs font-mono text-slate-500">ID: {user.faculty.employee_id}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {firstName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-slate-800 leading-tight">{user?.faculty?.first_name} {user?.faculty?.last_name}</div>
                <div className="text-[11px] text-slate-400">Faculty</div>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Logout">
              <SvgIcon name="logout" size={18} />
            </button>
          </div>
        </header>

        <main className="p-6">
          {/* Greeting */}
          <div className="mb-8 animate-fade-up">
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>
              Good {currentTime.getHours() < 12 ? 'morning' : currentTime.getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}
            </h2>
            <p className="text-slate-500 mt-1">Here&apos;s your teaching summary for today.</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'My Classes', value: myClasses.length, gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', icon: 'grid' },
              { label: 'My Subjects', value: mySubjects.length, gradient: 'from-indigo-500 to-purple-500', bg: 'bg-indigo-50', icon: 'book' },
              { label: 'Sessions Today', value: todayStats.sessions, gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', icon: 'clock' },
              { label: 'Students Present', value: todayStats.present, gradient: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-50', icon: 'checkCircle' },
            ].map((card, i) => (
              <div key={i} className={`${card.bg} rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-up group`}
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-white"><SvgIcon name={card.icon} size={18} /></span>
                </div>
                <div className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{card.value}</div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mb-6 animate-fade-up" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            <h3 className="text-lg font-bold text-slate-900 mb-4" style={{ fontFamily: 'var(--font-display)' }}>Quick Actions</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {quickActions.map((item, i) => (
              <button key={i} onClick={() => router.push(item.href)}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all duration-300 text-left group animate-fade-up"
                style={{ animationDelay: `${450 + i * 60}ms`, animationFillMode: 'backwards' }}>
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-white"><SvgIcon name={item.icon} size={20} /></span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-300 mt-1"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
                <h4 className="text-[15px] font-semibold text-slate-900 mt-4" style={{ fontFamily: 'var(--font-display)' }}>{item.label}</h4>
                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
              </button>
            ))}
          </div>

          {/* My Subjects Table */}
          {mySubjects.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-up" style={{ animationDelay: '650ms', animationFillMode: 'backwards' }}>
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>My Subject Assignments</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {mySubjects.map((a: any, i: number) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <SvgIcon name="book" size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{(a.subjects as any)?.name || 'N/A'}</div>
                        <div className="text-xs text-slate-400">{(a.subjects as any)?.code || ''}</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-full">{(a.classes as any)?.name || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 text-center text-xs text-slate-400 pb-4">
            EduAttend v1.0 · Faculty Portal
          </div>
        </main>
      </div>
    </div>
  );
}
