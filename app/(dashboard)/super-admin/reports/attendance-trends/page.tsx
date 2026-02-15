'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface MonthData {
  month: string;
  label: string;
  workingDays: number;
  avgPresent: number;
  attendancePct: number;
  totalStudents: number;
}

export default function AttendanceTrendsPage() {
  const [user, setUser] = useState<any>(null);
  const [institution, setInstitution] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selYear, setSelYear] = useState('');
  const [selClass, setSelClass] = useState('all');
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user) { loadInstitution(); loadAcademicYears(); } }, [user]);
  useEffect(() => { if (selYear) loadClasses(); }, [selYear]);

  const loadUser = async () => {
    const { data: { user: au } } = await supabase.auth.getUser();
    if (!au) { router.push('/login'); return; }
    const { data: u } = await supabase.from('users').select('*').eq('id', au.id).single();
    if (!u || (!['super_admin', 'institution_admin', 'faculty'].includes(u.role))) { router.push('/login'); return; }
    // Store faculty_id for class filtering
    if (u.role === 'faculty') {
      const { data: fac } = await supabase.from('faculty').select('id').eq('user_id', u.id).single();
      if (fac) u.faculty_id = fac.id;
    }
    let instId = u.institution_id;
    if (!instId) {
      const { data: inst } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
      if (inst?.length) instId = inst[0].id;
    }
    setUser({ ...u, institution_id: instId });
  };
  const loadInstitution = async () => {
    if (!user?.institution_id) return;
    const { data } = await supabase.from('institutions').select('*').eq('id', user.institution_id).single();
    setInstitution(data);
  };
  const loadAcademicYears = async () => {
    const { data } = await supabase.from('academic_years').select('*').eq('institution_id', user.institution_id).eq('is_active', true).order('start_date', { ascending: false });
    setAcademicYears(data || []);
    const c = data?.find((y: any) => y.is_current) || data?.[0];
    if (c) setSelYear(c.id);
    setLoading(false);
  };
  const loadClasses = async () => {
    let query = supabase.from('classes').select('*').eq('institution_id', user.institution_id).eq('academic_year_id', selYear).eq('is_active', true).order('name');
    if (user.role === 'faculty' && user.faculty_id) {
      query = query.eq('class_teacher_id', user.faculty_id);
    }
    const { data } = await query;
    setClasses(data || []);
  };

  const generate = async () => {
    setGenerating(true); setGenerated(false);
    const acYear = academicYears.find(y => y.id === selYear);
    if (!acYear) { setGenerating(false); return; }

    const today = new Date().toISOString().split('T')[0];
    const offDays: number[] = Array.isArray(institution?.weekly_off_days) ? institution.weekly_off_days : [0];

    // Holidays
    const { data: hols } = await supabase.from('holidays').select('date, holiday_type').eq('institution_id', user.institution_id);
    const holSet = new Set((hols || []).filter((h: any) => h.holiday_type !== 'working_override').map((h: any) => h.date));
    const overrideSet = new Set((hols || []).filter((h: any) => h.holiday_type === 'working_override').map((h: any) => h.date));

    // Target classes
    let targetClasses = classes;
    if (selClass !== 'all') targetClasses = classes.filter(c => c.id === selClass);
    if (!targetClasses.length) { setData([]); setGenerating(false); setGenerated(true); return; }

    // Build month range from academic year
    const startD = new Date(acYear.start_date);
    const todayD = new Date(today);
    const months: { value: string; label: string; start: string; end: string }[] = [];
    const cursor = new Date(startD.getFullYear(), startD.getMonth(), 1);
    while (cursor <= todayD) {
      const y = cursor.getFullYear(), m = cursor.getMonth();
      const value = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const lastDay = new Date(y, m + 1, 0).getDate();
      const start = `${value}-01`;
      let end = `${value}-${String(lastDay).padStart(2, '0')}`;
      if (end > today) end = today;
      months.push({ value, label, start, end });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const classIds = targetClasses.map(c => c.id);
    const classStartDates: Record<string, string> = {};
    targetClasses.forEach(c => { classStartDates[c.id] = c.classes_start_date || acYear.start_date; });

    // Load all attendance for the year
    const { data: allAtt } = await supabase.from('attendance').select('student_id, date, status, class_id')
      .in('class_id', classIds).gte('date', acYear.start_date).lte('date', today);

    // Load student counts per class
    const { data: allStudents } = await supabase.from('students').select('id, class_id')
      .in('class_id', classIds).eq('is_active', true);
    const stuByClass: Record<string, string[]> = {};
    (allStudents || []).forEach(s => {
      if (!stuByClass[s.class_id]) stuByClass[s.class_id] = [];
      stuByClass[s.class_id].push(s.id);
    });

    // Process each month
    const result: MonthData[] = [];
    for (const month of months) {
      let totalWD = 0;
      let totalPresent = 0;
      let totalStudentDays = 0;

      for (const cls of targetClasses) {
        const classStart = classStartDates[cls.id];
        let mStart = month.start;
        if (mStart < classStart) mStart = classStart;
        if (mStart > month.end) continue;

        // Working days for this class in this month
        let wd = 0;
        const d = new Date(mStart + 'T00:00:00');
        const end = new Date(month.end + 'T00:00:00');
        while (d <= end) {
          const ds = d.toISOString().split('T')[0];
          if ((!offDays.includes(d.getDay()) && !holSet.has(ds)) || overrideSet.has(ds)) wd++;
          d.setDate(d.getDate() + 1);
        }

        const stuIds = stuByClass[cls.id] || [];
        totalWD += wd;
        totalStudentDays += stuIds.length * wd;

        // Count present days in this month for this class
        (allAtt || []).forEach(a => {
          if (a.class_id === cls.id && a.status === 'present' && a.date >= mStart && a.date <= month.end) {
            totalPresent++;
          }
        });
      }

      const totalStu = selClass === 'all'
        ? (allStudents || []).length
        : (stuByClass[selClass] || []).length;
      const avgWD = targetClasses.length > 0 ? Math.round(totalWD / targetClasses.length) : 0;
      const pct = totalStudentDays > 0 ? (totalPresent / totalStudentDays) * 100 : 0;

      result.push({
        month: month.value,
        label: month.label,
        workingDays: avgWD,
        avgPresent: Math.round(totalPresent / Math.max(totalStu, 1) * 10) / 10,
        attendancePct: Math.round(pct * 10) / 10,
        totalStudents: totalStu,
      });
    }

    setData(result);
    setGenerating(false);
    setGenerated(true);
  };

  const maxPct = Math.max(...data.map(d => d.attendancePct), 100);
  const chartH = 250;

  const exportExcel = () => {
    const table = document.getElementById('trends-table');
    if (!table) return;
    const html = `<html><head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px 8px;font-size:11px}</style></head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'attendance-trends.xls'; a.click();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-500">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center gap-4">
          <button onClick={() => router.push('/super-admin/reports')} className="p-2 rounded-lg hover:bg-slate-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Attendance Trends</h1>
            <p className="text-sm text-slate-500">Monthly attendance trends over the academic year</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name || y.year_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
              <select value={selClass} onChange={e => setSelClass(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <option value="all">All Classes (Institution-wide)</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={generate} disabled={generating}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:from-violet-500 hover:to-violet-600 disabled:opacity-60">
              {generating ? '⏳ Generating...' : '📈 Generate Trends'}
            </button>
          </div>
        </div>

        {generated && data.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">No attendance data found.</div>
        )}

        {generated && data.length > 0 && (
          <>
            {/* Letterhead */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 text-center">
              {institution?.logo_url && (
                <img src={institution.logo_url} alt="" className="h-14 mx-auto mb-1 object-contain" />
              )}
              <h2 className="text-lg font-bold text-slate-900">{institution?.name || 'Institution'}</h2>
              {institution?.address && (
                <p className="text-xs text-slate-500">
                  {typeof institution.address === 'string' ? institution.address
                    : [institution.address.line1, institution.address.city, institution.address.state, institution.address.pincode].filter(Boolean).join(', ')}
                </p>
              )}
              {institution?.contact && (
                <p className="text-xs text-slate-500">Phone: {institution.contact.phone || ''} / Email: {institution.contact.email || ''}</p>
              )}
              <h3 className="text-sm font-bold mt-1 underline">Attendance Trends Report</h3>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Months Tracked</p>
                <p className="text-2xl font-bold text-slate-800">{data.length}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Best Month</p>
                <p className="text-lg font-bold text-emerald-600">{data.reduce((best, d) => d.attendancePct > best.attendancePct ? d : best, data[0]).label} ({data.reduce((best, d) => d.attendancePct > best.attendancePct ? d : best, data[0]).attendancePct}%)</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Worst Month</p>
                <p className="text-lg font-bold text-red-600">{data.filter(d => d.workingDays > 0).reduce((worst, d) => d.attendancePct < worst.attendancePct ? d : worst, data.filter(d => d.workingDays > 0)[0])?.label || '—'} ({data.filter(d => d.workingDays > 0).reduce((worst, d) => d.attendancePct < worst.attendancePct ? d : worst, data.filter(d => d.workingDays > 0)[0])?.attendancePct || 0}%)</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Overall Average</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {data.filter(d => d.workingDays > 0).length > 0
                    ? (data.filter(d => d.workingDays > 0).reduce((s, d) => s + d.attendancePct, 0) / data.filter(d => d.workingDays > 0).length).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Monthly Attendance %</h3>
              <div className="relative" style={{ height: chartH + 40 }}>
                {/* Y-axis grid */}
                {[0, 25, 50, 75, 100].map(v => (
                  <div key={v} className="absolute left-8 right-0 flex items-center" style={{ bottom: (v / 100) * chartH + 20 }}>
                    <span className="text-xs text-slate-400 w-8 text-right mr-2">{v}%</span>
                    <div className={`flex-1 border-t ${v === 75 ? 'border-red-300 border-dashed' : 'border-slate-100'}`} />
                  </div>
                ))}
                {/* Bars */}
                <div className="absolute left-12 right-4 bottom-0 flex items-end gap-1 justify-around" style={{ height: chartH + 20 }}>
                  {data.map((d, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 min-w-0" style={{ height: chartH + 20 }}>
                      <div className="flex-1 w-full flex items-end justify-center px-0.5">
                        <div
                          className={`w-full max-w-10 rounded-t-lg transition-all duration-500 ${d.attendancePct >= 75 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-red-500 to-red-400'}`}
                          style={{ height: `${d.workingDays > 0 ? (d.attendancePct / 100) * chartH : 0}px` }}
                          title={`${d.label}: ${d.attendancePct}%`}
                        />
                      </div>
                      <div className="text-center mt-1">
                        <span className="text-[10px] text-slate-500 font-medium">{d.label}</span>
                        {d.workingDays > 0 && <p className="text-[9px] text-slate-400">{d.attendancePct}%</p>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* 75% threshold label */}
                <div className="absolute right-2 text-xs text-red-400 font-medium" style={{ bottom: 0.75 * chartH + 16 }}>75%</div>
              </div>
            </div>

            {/* Trend indicator */}
            {data.filter(d => d.workingDays > 0).length >= 2 && (() => {
              const valid = data.filter(d => d.workingDays > 0);
              const first = valid[0].attendancePct;
              const last = valid[valid.length - 1].attendancePct;
              const diff = last - first;
              return (
                <div className={`rounded-2xl border p-4 mb-6 ${diff >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <span className="text-lg mr-2">{diff >= 0 ? '📈' : '📉'}</span>
                  <span className={`text-sm font-medium ${diff >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    Attendance has {diff >= 0 ? 'improved' : 'declined'} by {Math.abs(diff).toFixed(1)}% from {valid[0].label} to {valid[valid.length - 1].label}
                  </span>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700">🖨️ Print</button>
              <button onClick={exportExcel} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">📥 Excel</button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table id="trends-table" className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-4 py-3 text-left text-xs font-bold">Month</th>
                    <th className="px-4 py-3 text-center text-xs font-bold">Working Days</th>
                    <th className="px-4 py-3 text-center text-xs font-bold">Students</th>
                    <th className="px-4 py-3 text-center text-xs font-bold">Avg Days Present</th>
                    <th className="px-4 py-3 text-center text-xs font-bold">Attendance %</th>
                    <th className="px-4 py-3 text-center text-xs font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${d.workingDays === 0 ? 'opacity-40' : d.attendancePct < 75 ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{d.label}</td>
                      <td className="px-4 py-2.5 text-center font-mono">{d.workingDays}</td>
                      <td className="px-4 py-2.5 text-center font-mono">{d.totalStudents}</td>
                      <td className="px-4 py-2.5 text-center font-mono">{d.avgPresent}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.attendancePct >= 75 ? 'bg-emerald-100 text-emerald-700' : d.workingDays === 0 ? 'bg-slate-100 text-slate-400' : 'bg-red-100 text-red-700'}`}>
                          {d.workingDays > 0 ? `${d.attendancePct}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm">
                        {d.workingDays === 0 ? '⏸️' : d.attendancePct >= 90 ? '🟢' : d.attendancePct >= 75 ? '🟡' : '🔴'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
