'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface DivRow {
  className: string;
  grade: string;
  stream: string;
  division: string;
  totalStudents: number;
  workingDays: number;
  avgPresent: number;
  avgAbsent: number;
  attendancePct: number;
  above75: number;
  below75: number;
  classStartDate: string;
}

export default function DivisionComparisonPage() {
  const [user, setUser] = useState<any>(null);
  const [institution, setInstitution] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selYear, setSelYear] = useState('');
  const [selGrade, setSelGrade] = useState('all');
  const [mode, setMode] = useState<'monthly' | 'cumulative'>('monthly');
  const [selMonth, setSelMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [rows, setRows] = useState<DivRow[]>([]);
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
    if (!u || (!['super_admin', 'institution_admin'].includes(u.role))) {
      alert('Access denied. Admin only.'); router.push('/super-admin/reports'); return;
    }
    let instId = u.institution_id;
    if (!instId) {
      const { data: inst } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
      if (inst?.length) { instId = inst[0].id; }
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
    const { data } = await supabase.from('classes').select('*').eq('institution_id', user.institution_id).eq('academic_year_id', selYear).eq('is_active', true).order('name');
    setClasses(data || []);
  };

  const calcWorkingDays = (from: string, to: string, holSet: Set<string>, overrideSet: Set<string>, offDays: number[]) => {
    let count = 0;
    const d = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (d <= end) {
      const ds = d.toISOString().split('T')[0];
      const isOff = offDays.includes(d.getDay());
      const isHol = holSet.has(ds);
      const isOverride = overrideSet.has(ds);
      if ((!isOff && !isHol) || isOverride) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const generate = async () => {
    setGenerating(true);
    setGenerated(false);

    const acYear = academicYears.find(y => y.id === selYear);
    if (!acYear) { setGenerating(false); return; }

    const today = new Date().toISOString().split('T')[0];
    const offDays: number[] = Array.isArray(institution?.weekly_off_days) ? institution.weekly_off_days : [0];

    // Holidays
    const { data: hols } = await supabase.from('holidays').select('date, holiday_type').eq('institution_id', user.institution_id);
    const holSet = new Set((hols || []).filter((h: any) => h.holiday_type !== 'working_override').map((h: any) => h.date));
    const overrideSet = new Set((hols || []).filter((h: any) => h.holiday_type === 'working_override').map((h: any) => h.date));

    let targetClasses = classes;
    if (selGrade !== 'all') targetClasses = classes.filter(c => c.grade === selGrade);
    if (!targetClasses.length) { setRows([]); setGenerating(false); setGenerated(true); return; }

    const result: DivRow[] = [];

    for (const cls of targetClasses) {
      const classStart = cls.classes_start_date || acYear.start_date;
      const classEnd = cls.classes_end_date || acYear.end_date;

      let fromDate: string, toDate: string;
      if (mode === 'monthly') {
        const [yr, mo] = selMonth.split('-').map(Number);
        fromDate = selMonth + '-01';
        const lastDay = new Date(yr, mo, 0).getDate();
        toDate = `${selMonth}-${String(lastDay).padStart(2, '0')}`;
        if (toDate > today) toDate = today;
        if (fromDate < classStart) fromDate = classStart;
        if (toDate > classEnd) toDate = classEnd;
      } else {
        fromDate = classStart;
        toDate = today < classEnd ? today : classEnd;
      }

      if (fromDate > toDate) {
        result.push({ className: cls.name, grade: cls.grade, stream: cls.stream || '', division: cls.division || '', totalStudents: 0, workingDays: 0, avgPresent: 0, avgAbsent: 0, attendancePct: 0, above75: 0, below75: 0, classStartDate: classStart });
        continue;
      }

      const wd = calcWorkingDays(fromDate, toDate, holSet, overrideSet, offDays);

      // Students
      const { data: students } = await supabase.from('students').select('id').eq('class_id', cls.id).eq('is_active', true);
      const stuIds = (students || []).map(s => s.id);

      if (!stuIds.length) {
        result.push({ className: cls.name, grade: cls.grade, stream: cls.stream || '', division: cls.division || '', totalStudents: 0, workingDays: wd, avgPresent: 0, avgAbsent: 0, attendancePct: 0, above75: 0, below75: 0, classStartDate: classStart });
        continue;
      }

      // Attendance - deduplicate by student_id + date
      const { data: att } = await supabase.from('attendance').select('student_id, date, status').eq('class_id', cls.id).gte('date', fromDate).lte('date', toDate);
      const stuPresent: Record<string, number> = {};
      const seen: Set<string> = new Set();
      (att || []).forEach(a => {
        const key = `${a.student_id}_${a.date}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (a.status === 'present') stuPresent[a.student_id] = (stuPresent[a.student_id] || 0) + 1;
      });

      let totalPresent = 0;
      let above75 = 0, below75 = 0;
      stuIds.forEach(sid => {
        const p = stuPresent[sid] || 0;
        totalPresent += p;
        const pct = wd > 0 ? (p / wd) * 100 : 0;
        if (pct >= 75) above75++; else below75++;
      });

      const avgP = stuIds.length > 0 ? totalPresent / stuIds.length : 0;
      const pct = wd > 0 ? Math.min((avgP / wd) * 100, 100) : 0;

      result.push({
        className: cls.name, grade: cls.grade, stream: cls.stream || '', division: cls.division || '',
        totalStudents: stuIds.length, workingDays: wd,
        avgPresent: Math.round(avgP * 10) / 10, avgAbsent: Math.round((wd - avgP) * 10) / 10,
        attendancePct: Math.round(pct * 10) / 10,
        above75, below75, classStartDate: classStart,
      });
    }

    result.sort((a, b) => b.attendancePct - a.attendancePct);
    setRows(result);
    setGenerating(false);
    setGenerated(true);
  };

  const uniqueGrades = Array.from(new Set(classes.map(c => c.grade))).sort();
  const exportExcel = () => {
    const table = document.getElementById('div-comp-table');
    if (!table) return;
    const html = `<html><head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px 8px;font-size:11px}</style></head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `division-comparison-${mode}.xls`; a.click();
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
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Division Comparison Report</h1>
            <p className="text-sm text-slate-500">Compare attendance across classes/divisions</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setMode('monthly')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'monthly' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📅 Monthly</button>
            <button onClick={() => setMode('cumulative')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'cumulative' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📊 Cumulative</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name || y.year_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Filter by Grade</label>
              <select value={selGrade} onChange={e => setSelGrade(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <option value="all">All Grades</option>
                {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {mode === 'monthly' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
                <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
            )}
            <button onClick={generate} disabled={generating}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60">
              {generating ? '⏳ Generating...' : '📊 Generate'}
            </button>
          </div>
        </div>

        {generated && rows.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">No data found for the selected filters.</div>
        )}

        {generated && rows.length > 0 && (
          <>
            {/* Letterhead for Print */}
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
              <h3 className="text-sm font-bold mt-1 underline">Division Comparison Report</h3>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Total Classes</p>
                <p className="text-2xl font-bold text-slate-800">{rows.length}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Total Students</p>
                <p className="text-2xl font-bold text-slate-800">{rows.reduce((s, r) => s + r.totalStudents, 0)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Avg Attendance %</p>
                <p className="text-2xl font-bold text-emerald-600">{rows.length > 0 ? (rows.reduce((s, r) => s + r.attendancePct, 0) / rows.length).toFixed(1) : 0}%</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Students Below 75%</p>
                <p className="text-2xl font-bold text-red-600">{rows.reduce((s, r) => s + r.below75, 0)}</p>
              </div>
            </div>

            {/* Bar Chart Visualization */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Attendance % by Class</h3>
              <div className="space-y-3">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-32 text-xs font-medium text-slate-600 text-right truncate">{r.className}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-7 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${r.attendancePct >= 75 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                        style={{ width: `${Math.min(r.attendancePct, 100)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
                        {r.attendancePct}%
                      </span>
                    </div>
                    <span className="w-16 text-xs text-slate-400 text-right">{r.totalStudents} stu</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700">🖨️ Print</button>
              <button onClick={exportExcel} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">📥 Excel</button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div id="div-comp-table-wrapper">
                <table id="div-comp-table" className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-3 py-3 text-left text-xs font-bold">#</th>
                      <th className="px-3 py-3 text-left text-xs font-bold">Class</th>
                      <th className="px-3 py-3 text-left text-xs font-bold">Grade</th>
                      <th className="px-3 py-3 text-center text-xs font-bold">Students</th>
                      <th className="px-3 py-3 text-center text-xs font-bold">Start Date</th>
                      <th className="px-3 py-3 text-center text-xs font-bold">W.D</th>
                      <th className="px-3 py-3 text-center text-xs font-bold">Avg Present</th>
                      <th className="px-3 py-3 text-center text-xs font-bold">Avg Absent</th>
                      <th className="px-3 py-3 text-center text-xs font-bold">Att %</th>
                      <th className="px-3 py-3 text-center text-xs font-bold">≥75%</th>
                      <th className="px-3 py-3 text-center text-xs font-bold">&lt;75%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={`border-b border-slate-100 ${r.attendancePct < 75 ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-800">{r.className}</td>
                        <td className="px-3 py-2.5"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{r.grade}</span></td>
                        <td className="px-3 py-2.5 text-center font-mono">{r.totalStudents}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-500">{r.classStartDate}</td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold">{r.workingDays}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-emerald-600">{r.avgPresent}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-red-500">{r.avgAbsent}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.attendancePct >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {r.attendancePct}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-emerald-600">{r.above75}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-red-600 font-bold">{r.below75}</td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                      <td className="px-3 py-2.5" colSpan={3}>TOTAL</td>
                      <td className="px-3 py-2.5 text-center font-mono">{rows.reduce((s, r) => s + r.totalStudents, 0)}</td>
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">
                          {rows.length > 0 ? (rows.reduce((s, r) => s + r.attendancePct, 0) / rows.length).toFixed(1) : 0}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-emerald-600">{rows.reduce((s, r) => s + r.above75, 0)}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-red-600">{rows.reduce((s, r) => s + r.below75, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
