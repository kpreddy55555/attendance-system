'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface AlertRow {
  sr: number; rollNo: string; studentName: string; gender: string; className: string;
  totalWorking: number; present: number; absent: number; pct: number;
  parentName: string; parentPhone: string;
}

export default function LowAttendanceReport() {
  const [user, setUser] = useState<any>(null);
  const [institution, setInstitution] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selYear, setSelYear] = useState('');
  const [selClass, setSelClass] = useState('all');
  const [threshold, setThreshold] = useState(75);
  const [mode, setMode] = useState<'monthly' | 'cumulative'>('monthly');
  const [selMonth, setSelMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [alertData, setAlertData] = useState<AlertRow[]>([]);
  const [reportMeta, setReportMeta] = useState({ date: '', periodLabel: '', fromDate: '', toDate: '', workingDays: 0, totalStudents: 0 });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user) { loadInstitution(); loadAcademicYears(); } }, [user]);
  useEffect(() => { if (selYear) loadClasses(); }, [selYear]);

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/login'); return; }
    const { data: u } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (!u) { router.push('/login'); return; }
    // Role check: admin or class teacher
    if (!['super_admin', 'institution_admin'].includes(u.role)) {
      if (u.role === 'faculty') {
        const { data: fac } = await supabase.from('faculty').select('id').eq('user_id', u.id).single();
        if (fac) {
          const { data: ct } = await supabase.from('classes').select('id').eq('class_teacher_id', fac.id);
          if (!ct || ct.length === 0) { alert('Access denied. Class teachers only.'); router.push('/super-admin/reports'); return; }
          u.faculty_id = fac.id;
        } else { router.push('/login'); return; }
      } else { router.push('/login'); return; }
    }
    let instId = u.institution_id;
    if (!instId) {
      const { data: inst } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
      if (inst?.length) { instId = inst[0].id; await supabase.from('users').update({ institution_id: instId }).eq('id', u.id); }
    }
    setUser({ ...u, institution_id: instId });
  };

  const loadInstitution = async () => {
    if (!user?.institution_id) return;
    const { data } = await supabase.from('institutions').select('*').eq('id', user.institution_id).single();
    setInstitution(data);
  };

  const loadAcademicYears = async () => {
    if (!user?.institution_id) { setLoading(false); return; }
    const { data } = await supabase.from('academic_years').select('*').eq('institution_id', user.institution_id).eq('is_active', true).order('start_date', { ascending: false });
    setAcademicYears(data || []);
    const current = data?.find((y: any) => y.is_current) || data?.[0];
    if (current) setSelYear(current.id);
    setLoading(false);
  };

  const loadClasses = async () => {
    if (!user?.institution_id) return;
    let query = supabase.from('classes').select('*').eq('institution_id', user.institution_id).eq('academic_year_id', selYear).eq('is_active', true).order('name');
    if (user.role === 'faculty' && user.faculty_id) {
      query = query.eq('class_teacher_id', user.faculty_id);
    }
    const { data } = await query;
    setClasses(data || []);
  };

  // ─── Calculate working days for a date range ───
  // Uses institution.weekly_off_days (e.g. [0,6] for Sun+Sat)
  // Subtracts holidays, adds back working_override days
  const calcWorkingDays = (from: string, to: string, holSet: Set<string>, overrideSet: Set<string>) => {
    const offDays: number[] = Array.isArray(institution?.weekly_off_days) ? institution.weekly_off_days : [0];
    let count = 0;
    const d = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (d <= end) {
      const ds = d.toISOString().split('T')[0];
      const isWeeklyOff = offDays.includes(d.getDay());
      const isHoliday = holSet.has(ds);
      const isOverride = overrideSet.has(ds);
      
      // Working day = (not weekly off AND not holiday) OR working override
      if ((!isWeeklyOff && !isHoliday) || isOverride) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const generateReport = async () => {
    if (!selYear) return;
    setGenerating(true);

    const acYear = academicYears.find(y => y.id === selYear);
    if (!acYear) { setGenerating(false); return; }

    // Determine date range based on mode
    const today = new Date().toISOString().split('T')[0];
    let fromDate: string;
    let toDate: string;
    let periodLabel: string;

    if (mode === 'monthly') {
      const [yr, mo] = selMonth.split('-').map(Number);
      fromDate = `${selMonth}-01`;
      const lastDay = new Date(yr, mo, 0).getDate();
      const monthEnd = `${selMonth}-${String(lastDay).padStart(2, '0')}`;
      toDate = monthEnd <= today ? monthEnd : today;
      periodLabel = new Date(yr, mo - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } else {
      fromDate = acYear.start_date;
      toDate = today;
      periodLabel = `${acYear.name} (Cumulative to ${new Date(today + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    }

    // Get classes to query (with their start/end dates)
    let targetClasses = classes;
    if (selClass !== 'all') targetClasses = classes.filter(c => c.id === selClass);
    if (!targetClasses.length) { setAlertData([]); setGenerating(false); return; }

    const classIds = targetClasses.map(c => c.id);
    const classMap: Record<string, any> = {};
    targetClasses.forEach(c => classMap[c.id] = c);

    // Load full class data with start/end dates
    const { data: classData } = await supabase.from('classes').select('id, name, classes_start_date, classes_end_date')
      .in('id', classIds);
    (classData || []).forEach((c: any) => {
      if (classMap[c.id]) {
        classMap[c.id].classes_start_date = c.classes_start_date;
        classMap[c.id].classes_end_date = c.classes_end_date;
      }
    });

    // Load students
    const { data: students } = await supabase.from('students').select('id, roll_number, first_name, last_name, gender, class_id, parent_name, parent_phone')
      .in('class_id', classIds).eq('is_active', true);

    if (!students?.length) { setAlertData([]); setGenerating(false); return; }

    // Calculate effective date range per class
    // In cumulative mode: use class start date if available
    // In monthly mode: use month start, but not before class start date
    const getClassDateRange = (classId: string): { from: string; to: string } => {
      const cls = classMap[classId];
      const classStart = cls?.classes_start_date || acYear.start_date;
      const classEnd = cls?.classes_end_date || acYear.end_date;
      
      if (mode === 'cumulative') {
        return { from: classStart, to: today < classEnd ? today : classEnd };
      } else {
        // Monthly: clip to month but respect class start/end
        const effectiveFrom = fromDate > classStart ? fromDate : classStart;
        const effectiveTo = toDate < classEnd ? toDate : classEnd;
        return { from: effectiveFrom, to: effectiveTo };
      }
    };

    // Load all attendance records using widest possible date range
    const earliestStart = Object.values(classMap).reduce((min: string, c: any) => {
      const s = c.classes_start_date || acYear.start_date;
      return s < min ? s : min;
    }, fromDate);
    
    const { data: attendance } = await supabase.from('attendance').select('student_id, date, status, class_id')
      .in('class_id', classIds).gte('date', earliestStart).lte('date', toDate);

    // Load holidays (including working_overrides)
    const { data: hols } = await supabase.from('holidays').select('date, holiday_type').eq('institution_id', user.institution_id);
    const holSet = new Set((hols || []).filter((h: any) => h.holiday_type !== 'working_override').map((h: any) => h.date));
    const overrideSet = new Set((hols || []).filter((h: any) => h.holiday_type === 'working_override').map((h: any) => h.date));

    // Calculate working days PER CLASS
    const classWorkingDays: Record<string, number> = {};
    classIds.forEach(cid => {
      const range = getClassDateRange(cid);
      classWorkingDays[cid] = calcWorkingDays(range.from, range.to, holSet, overrideSet);
    });

    // Build per-student attendance summary (only count dates within class range)
    const attMap: Record<string, number> = {};
    (attendance || []).forEach((a: any) => {
      if (a.status === 'present') {
        const range = getClassDateRange(a.class_id);
        if (a.date >= range.from && a.date <= range.to) {
          attMap[a.student_id] = (attMap[a.student_id] || 0) + 1;
        }
      }
    });

    const genderMap = (g: string) => {
      const gl = (g || '').toLowerCase().trim();
      if (['male', 'm', 'b', 'boy'].includes(gl)) return 'B';
      if (['female', 'f', 'g', 'girl'].includes(gl)) return 'G';
      return '-';
    };

    const rows: AlertRow[] = [];
    let sr = 1;

    students
      .sort((a, b) => ((classMap[a.class_id]?.name || '').localeCompare(classMap[b.class_id]?.name || '')) || (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0))
      .forEach(s => {
        const wd = classWorkingDays[s.class_id] || 0;
        const present = attMap[s.id] || 0;
        const absent = wd - present;
        const pct = wd > 0 ? (present / wd) * 100 : 0;

        if (pct < threshold) {
          rows.push({
            sr: sr++,
            rollNo: s.roll_number || '',
            studentName: `${s.last_name || ''} ${s.first_name || ''}`.trim().toUpperCase(),
            gender: genderMap(s.gender),
            className: classMap[s.class_id]?.name || '',
            totalWorking: wd,
            present,
            absent,
            pct: Math.round(pct * 100) / 100,
            parentName: s.parent_name || '-',
            parentPhone: s.parent_phone || '-',
          });
        }
      });

    // Calculate summary stats
    const wdValues = Object.values(classWorkingDays);
    const maxWD = Math.max(...wdValues, 0);
    const minWD = Math.min(...wdValues, 0);

    setAlertData(rows);
    setReportMeta({
      date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
      periodLabel: mode === 'cumulative' && minWD !== maxWD 
        ? `${periodLabel} (W.D varies by class: ${minWD}–${maxWD})` 
        : periodLabel,
      fromDate: new Date(fromDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      toDate: new Date(toDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      workingDays: maxWD,
      totalStudents: students.length,
    });
    setGenerating(false);
  };

  const exportExcel = () => {
    const table = document.getElementById('low-att-table');
    if (!table) return;
    const html = `<html><head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px 8px;font-size:11px}</style></head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `low-attendance-alert-${mode === 'monthly' ? selMonth : 'cumulative'}.xls`; a.click();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-500">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center gap-4">
          <button onClick={() => router.push('/super-admin/reports')} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Low Attendance Alert Report</h1>
            <p className="text-sm text-slate-500">Students below threshold — monthly or cumulative</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 print:hidden">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setMode('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'monthly' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              📅 Monthly
            </button>
            <button
              onClick={() => setMode('cumulative')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'cumulative' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              📊 Cumulative (Year to Date)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select value={selClass} onChange={e => setSelClass(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500">
                <option value="all">— All Classes —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {mode === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Threshold %</label>
              <input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))} min={1} max={100}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
            </div>
            <button onClick={generateReport} disabled={generating}
              className="py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-60">
              {generating ? 'Generating...' : '⚠️ Generate Alert'}
            </button>
          </div>

          {/* Info box explaining calculation */}
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>Weekly off days:</strong> {(Array.isArray(institution?.weekly_off_days) ? institution.weekly_off_days : [0]).map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}.{' '}
            {mode === 'monthly' ? (
              <>Working days = weekdays in selected month minus off days &amp; holidays, plus any extra working days. Attendance % = (days present ÷ working days) × 100.</>
            ) : (
              <>Working days = all days from academic year start to today, minus off days &amp; holidays, plus any extra working days. Attendance % = (total days present ÷ total working days) × 100.</>
            )}
          </div>
        </div>

        {/* Working Days Summary */}
        {reportMeta.workingDays > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 print:hidden">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-500 font-medium">Period</div>
              <div className="text-sm font-bold text-slate-800 mt-1">{reportMeta.fromDate} → {reportMeta.toDate}</div>
            </div>
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
              <div className="text-xs text-amber-600 font-medium">Working Days</div>
              <div className="text-2xl font-bold text-amber-700" style={{ fontFamily: 'var(--font-display)' }}>{reportMeta.workingDays}</div>
            </div>
            <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
              <div className="text-xs text-red-600 font-medium">Below {threshold}%</div>
              <div className="text-2xl font-bold text-red-700" style={{ fontFamily: 'var(--font-display)' }}>{alertData.length}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <div className="text-xs text-slate-500 font-medium">Total Students</div>
              <div className="text-2xl font-bold text-slate-700" style={{ fontFamily: 'var(--font-display)' }}>{reportMeta.totalStudents}</div>
            </div>
          </div>
        )}

        {/* Alert Banner */}
        {alertData.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-red-800" style={{ fontFamily: 'var(--font-display)' }}>{alertData.length} of {reportMeta.totalStudents} students below {threshold}% attendance</p>
              <p className="text-sm text-red-600">{reportMeta.periodLabel} | {reportMeta.workingDays} working days | Immediate action recommended</p>
            </div>
          </div>
        )}

        {alertData.length > 0 && (
          <>
            <div className="flex gap-3 mb-4 print:hidden">
              <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">🖨️ Print</button>
              <button onClick={exportExcel} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">📊 Export Excel</button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="text-center py-4 border-b border-slate-100">
                {institution?.logo_url && <img src={institution.logo_url} alt="" className="h-14 mx-auto mb-1 object-contain" />}
                <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{institution?.name || 'Institution'}</h2>
                <h3 className="text-base font-bold text-red-700 mt-1 underline">Low Attendance Alert Report</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {reportMeta.periodLabel} | {reportMeta.fromDate} to {reportMeta.toDate}
                </p>
                <p className="text-sm text-slate-500">Working Days: <strong>{reportMeta.workingDays}</strong> | Threshold: Below {threshold}%</p>
              </div>

              <div className="overflow-x-auto">
                <table id="low-att-table" className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50 border-b-2 border-red-200">
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Sr</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Roll No</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Student Name</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">G</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Class</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">W.D</th>
                      <th className="px-3 py-3 text-center font-bold text-emerald-700">Present</th>
                      <th className="px-3 py-3 text-center font-bold text-red-700">Absent</th>
                      <th className="px-3 py-3 text-center font-bold text-red-700">Att. %</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Parent Name</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Parent Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertData.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-red-50/30">
                        <td className="px-3 py-2.5 text-slate-500">{r.sr}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-700">{r.rollNo}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{r.studentName}</td>
                        <td className="px-3 py-2.5 text-center">{r.gender}</td>
                        <td className="px-3 py-2.5 text-slate-600">{r.className}</td>
                        <td className="px-3 py-2.5 text-center font-medium">{r.totalWorking}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-700 font-medium">{r.present}</td>
                        <td className="px-3 py-2.5 text-center text-red-600 font-bold">{r.absent}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-red-700 bg-red-50">{r.pct}%</td>
                        <td className="px-3 py-2.5 text-slate-600">{r.parentName}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-mono">{r.parentPhone}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-100 border-t-2 border-red-300 font-bold text-sm">
                      <td className="px-3 py-3" colSpan={5}>TOTAL: {alertData.length} students below {threshold}%</td>
                      <td className="px-3 py-3 text-center">{reportMeta.workingDays}</td>
                      <td className="px-3 py-3 text-center text-emerald-700">—</td>
                      <td className="px-3 py-3 text-center text-red-700">—</td>
                      <td className="px-3 py-3 text-center text-red-700">—</td>
                      <td className="px-3 py-3" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {/* All clear state */}
        {alertData.length === 0 && !generating && reportMeta.workingDays > 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-lg font-bold text-emerald-700" style={{ fontFamily: 'var(--font-display)' }}>All students above {threshold}% attendance!</p>
            <p className="text-sm text-slate-500 mt-1">{reportMeta.periodLabel} | {reportMeta.workingDays} working days</p>
          </div>
        )}

        {/* Initial state */}
        {alertData.length === 0 && !generating && reportMeta.workingDays === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-lg font-medium">Select filters and generate alert report</p>
            <p className="text-sm mt-1">Choose Monthly for per-month analysis or Cumulative for year-to-date</p>
          </div>
        )}
      </div>

      <style jsx global>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: landscape; margin: 8mm; } }`}</style>
    </div>
  );
}
