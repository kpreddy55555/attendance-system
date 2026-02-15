'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

// ─── Icon Components (inline SVGs for zero deps) ───
const Icon = ({ d, size = 20, cls = '' }: { d: string; size?: number; cls?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <path d={d} />
  </svg>
);

const icons = {
  building: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M10 6h4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M10 10h4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M10 14h4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M10 18h4" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M22 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  graduationCap: <><path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  calendar: <><rect width="18" height="18" x="3" y="4" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/></>,
  book: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  clock: <><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  clipboardCheck: <><rect width="8" height="4" x="8" y="2" rx="1" ry="1" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m9 14 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  barChart: <><line x1="12" y1="20" x2="12" y2="10" stroke="currentColor" strokeWidth="2"/><line x1="18" y1="20" x2="18" y2="4" stroke="currentColor" strokeWidth="2"/><line x1="6" y1="20" x2="6" y2="16" stroke="currentColor" strokeWidth="2"/></>,
  grid: <><rect width="7" height="7" x="3" y="3" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/><rect width="7" height="7" x="14" y="3" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/><rect width="7" height="7" x="14" y="14" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/><rect width="7" height="7" x="3" y="14" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  userCheck: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><polyline points="16 11 18 13 22 9" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  calendarX: <><rect width="18" height="18" x="3" y="4" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/><line x1="10" y1="14" x2="14" y2="18" stroke="currentColor" strokeWidth="2"/><line x1="14" y1="14" x2="10" y2="18" stroke="currentColor" strokeWidth="2"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" strokeWidth="2"/><polyline points="16 17 21 12 16 7" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2"/></>,
  chevronRight: <><polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  pen: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" fill="none" stroke="currentColor" strokeWidth="2"/></>,
  settings: <><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" strokeWidth="2"/></>,
};

const SvgIcon = ({ name, size = 20 }: { name: keyof typeof icons; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {icons[name]}
  </svg>
);

export default function SuperAdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [institution, setInstitution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({ institutions: 0, users: 0, students: 0, classes: 0, faculty: 0, subjects: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (userData?.role !== 'super_admin') { router.push('/login'); return; }

      // Auto-detect institution
      let instId = userData.institution_id;
      if (!instId) {
        const { data: inst } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
        if (inst?.length) {
          instId = inst[0].id;
          await supabase.from('users').update({ institution_id: instId }).eq('id', userData.id);
        }
      }
      setUser({ ...userData, institution_id: instId });

      // Load institution details
      if (instId) {
        const { data: instData } = await supabase.from('institutions').select('*').eq('id', instId).single();
        setInstitution(instData);
      }

      // Load all stats
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        supabase.from('institutions').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('faculty').select('*', { count: 'exact', head: true }),
        supabase.from('subjects').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        institutions: r1.count || 0,
        users: r2.count || 0,
        students: r3.count || 0,
        classes: r4.count || 0,
        faculty: r5.count || 0,
        subjects: r6.count || 0,
      });
      setLoading(false);
    };
    init();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ─── Navigation Sections ───
  const navSections: { title: string; items: { label: string; href: string; icon: string; color: string }[] }[] = [
    {
      title: 'SETUP',
      items: [
        { label: 'Institutions', href: '/super-admin/institutions', icon: 'building', color: 'from-blue-500 to-blue-600' },
        { label: 'Academic Years', href: '/super-admin/academic-years', icon: 'calendar', color: 'from-violet-500 to-violet-600' },
        { label: 'Classes', href: '/super-admin/classes', icon: 'grid', color: 'from-sky-500 to-sky-600' },
        { label: 'Class Configuration', href: '/super-admin/class-config', icon: 'settings', color: 'from-slate-500 to-slate-600' },
        { label: 'Subjects', href: '/super-admin/subjects', icon: 'book', color: 'from-amber-500 to-amber-600' },
        { label: 'Periods', href: '/super-admin/periods', icon: 'clock', color: 'from-cyan-500 to-cyan-600' },
      ]
    },
    {
      title: 'PEOPLE',
      items: [
        { label: 'Students', href: '/super-admin/students', icon: 'graduationCap', color: 'from-emerald-500 to-emerald-600' },
        { label: 'Faculty', href: '/super-admin/faculty', icon: 'users', color: 'from-purple-500 to-purple-600' },
        { label: 'Class Teachers', href: '/super-admin/class-teachers', icon: 'userCheck', color: 'from-indigo-500 to-indigo-600' },
        { label: 'Faculty Assignment', href: '/super-admin/faculty-assignment', icon: 'link', color: 'from-pink-500 to-pink-600' },
        { label: 'Student Enrollment', href: '/super-admin/student-enrollment', icon: 'clipboardCheck', color: 'from-teal-500 to-teal-600' },
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        { label: 'Mark Attendance', href: '/faculty/attendance', icon: 'pen', color: 'from-orange-500 to-orange-600' },
        { label: 'Holidays', href: '/super-admin/holidays', icon: 'calendarX', color: 'from-red-500 to-red-600' },
        { label: 'Reports', href: '/super-admin/reports', icon: 'barChart', color: 'from-emerald-500 to-green-600' },
      ]
    },
  ];

  // ─── Stats Config ───
  const statCards = [
    { label: 'Total Institutions', value: stats.institutions, gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50', icon: 'building' },
    { label: 'Total Students', value: stats.students, gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', icon: 'graduationCap' },
    { label: 'Faculty Members', value: stats.faculty, gradient: 'from-purple-500 to-violet-500', bg: 'bg-purple-50', icon: 'users' },
    { label: 'Active Classes', value: stats.classes, gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', icon: 'grid' },
    { label: 'Active Subjects', value: stats.subjects, gradient: 'from-pink-500 to-rose-500', bg: 'bg-pink-50', icon: 'book' },
    { label: 'System Users', value: stats.users, gradient: 'from-slate-600 to-slate-700', bg: 'bg-slate-50', icon: 'userCheck' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center animate-pulse">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <p className="text-slate-500 text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ═══════ SIDEBAR ═══════ */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out fixed inset-y-0 left-0 z-30`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          {sidebarOpen && (
            <span className="ml-3 text-[17px] font-bold tracking-tight animate-fade-in" style={{ fontFamily: 'var(--font-display)' }}>
              EduAttend
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navSections.map((section, si) => (
            <div key={si}>
              {sidebarOpen && (
                <div className="text-[10px] font-bold text-slate-500 tracking-[0.15em] mb-2 px-3">{section.title}</div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item, ii) => (
                  <button
                    key={ii}
                    onClick={() => router.push(item.href)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200 group ${!sidebarOpen ? 'justify-center' : ''}`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shrink-0 opacity-80 group-hover:opacity-100 group-hover:shadow-lg transition-all duration-200`}>
                      <SvgIcon name={item.icon} size={16} />
                    </div>
                    {sidebarOpen && <span className="font-medium truncate">{item.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
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

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>

        {/* ─── Top Bar ─── */}
        <header className="h-16 bg-white border-b border-slate-200/60 flex items-center justify-between px-6 sticky top-0 z-20">
          <div>
            <h1 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
            <p className="text-xs text-slate-400 -mt-0.5">
              {currentTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Institution badge */}
            {institution && (
              <div className="hidden md:flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-2 border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-600 max-w-[200px] truncate">{institution.name}</span>
              </div>
            )}
            {/* User */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-slate-800 leading-tight">{user?.full_name}</div>
                <div className="text-[11px] text-slate-400">Super Admin</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Logout"
            >
              <SvgIcon name="logout" size={18} />
            </button>
          </div>
        </header>

        {/* ─── Dashboard Content ─── */}
        <main className="p-6">
          {/* Greeting */}
          <div className="mb-8 animate-fade-up">
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>
              Good {currentTime.getHours() < 12 ? 'morning' : currentTime.getHours() < 17 ? 'afternoon' : 'evening'}, {user?.full_name?.split(' ')[0]}
            </h2>
            <p className="text-slate-500 mt-1">Here&apos;s your platform overview.</p>
          </div>

          {/* ─── Stat Cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {statCards.map((card, i) => (
              <div
                key={i}
                className={`${card.bg} rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-up group cursor-default`}
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-white"><SvgIcon name={card.icon} size={18} /></span>
                </div>
                <div className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>
                  {card.value.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">{card.label}</div>
              </div>
            ))}
          </div>

          {/* ─── Quick Actions Grid ─── */}
          <div className="mb-6 animate-fade-up" style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}>
            <h3 className="text-lg font-bold text-slate-900 mb-4" style={{ fontFamily: 'var(--font-display)' }}>Quick Actions</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {navSections.flatMap(s => s.items).map((item, i) => (
              <button
                key={i}
                onClick={() => router.push(item.href)}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all duration-300 text-left group animate-fade-up"
                style={{ animationDelay: `${550 + i * 50}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-white"><SvgIcon name={item.icon} size={20} /></span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-300 mt-1">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <h4 className="text-[15px] font-semibold text-slate-900 mt-4" style={{ fontFamily: 'var(--font-display)' }}>{item.label}</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {item.label === 'Institutions' && 'Add & manage institutions'}
                  {item.label === 'Academic Years' && 'Configure academic periods'}
                  {item.label === 'Classes' && 'Create standards & divisions'}
                  {item.label === 'Class Configuration' && 'Set class start/end dates'}
                  {item.label === 'Subjects' && 'Manage subjects & practicals'}
                  {item.label === 'Periods' && 'Set up period timings'}
                  {item.label === 'Students' && 'Import & manage students'}
                  {item.label === 'Faculty' && 'Add teachers & staff'}
                  {item.label === 'Class Teachers' && 'Assign class teachers'}
                  {item.label === 'Faculty Assignment' && 'Map faculty to subjects'}
                  {item.label === 'Student Enrollment' && 'Enroll in subjects & batches'}
                  {item.label === 'Mark Attendance' && 'Record daily attendance'}
                  {item.label === 'Holidays' && 'Configure holidays & Sundays'}
                  {item.label === 'Reports' && 'Monthly reports & analytics'}
                </p>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-12 text-center text-xs text-slate-400 pb-4">
            EduAttend v1.0 · Built for The Andhra Education Society
          </div>
        </main>
      </div>
    </div>
  );
}
