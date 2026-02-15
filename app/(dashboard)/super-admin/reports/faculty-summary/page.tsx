'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface FacultyRow {
  facultyName: string; employeeId: string;
  subjects: { name: string; code: string; className: string; lectures: number }[];
  totalLectures: number; totalStudentsMarked: number; avgAttendancePct: number;
}

export default function FacultySummaryReport() {
  const [user, setUser] = useState<any>(null);
  const [institution, setInstitution] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selYear, setSelYear] = useState('');
  const [selMonth, setSelMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<FacultyRow[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user) { loadInstitution(); loadAcademicYears(); } }, [user]);

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/login'); return; }
    const { data: u } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (!u) { router.push('/login'); return; }
    // Admin only
    if (!['super_admin', 'institution_admin'].includes(u.role)) {
      alert('Access denied. Admin only.'); router.push('/super-admin/reports'); return;
    }
    let instId = u.institution_id;
    if (!instId) {
      const { data: inst } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
      if (inst?.length) { instId = inst[0].id; }
    }
    setUser({ ...u, institution_id: instId });
  };
  const loadInstitution = async () => { if (!user?.institution_id) return; const { data } = await supabase.from('institutions').select('*').eq('id', user.institution_id).single(); setInstitution(data); };
  const loadAcademicYears = async () => {
    if (!user?.institution_id) { setLoading(false); return; }
    const { data } = await supabase.from('academic_years').select('*').eq('institution_id', user.institution_id).eq('is_active', true).order('start_date', { ascending: false });
    setAcademicYears(data || []);
    const current = data?.find((y: any) => y.is_current) || data?.[0];
    if (current) setSelYear(current.id);
    const now = new Date();
    setSelMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setLoading(false);
  };

  const generateReport = async () => {
    if (!selYear || !selMonth) return;
    setGenerating(true);

    const [yr, mo] = selMonth.split('-').map(Number);
    const mStart = `${selMonth}-01`;
    const mEnd = `${selMonth}-${new Date(yr, mo, 0).getDate()}`;

    // Load all lecture sessions for this institution + month
    const { data: sessions, error: sessError } = await supabase.from('lecture_sessions')
      .select('id, faculty_id, subject_id, class_id, date, session_type, subjects(name, code), classes(name), faculty(first_name, last_name, employee_id), lecture_attendance(status)')
      .eq('institution_id', user.institution_id).gte('date', mStart).lte('date', mEnd)
      .order('faculty_id');

    if (sessError) {
      console.error('Error loading lecture sessions:', sessError);
      alert('Faculty Lecture Summary requires lecture sessions data.\n\nPlease ensure:\n1. lecture_sessions table exists (run migration-lecture-sessions.sql)\n2. Faculty have recorded lectures for the selected month');
      setGenerating(false); return;
    }

    if (!sessions?.length) { setReportData([]); setGenerating(false); return; }

    // Group by faculty
    const facultyMap: Record<string, FacultyRow & { subjectMap: Record<string, { name: string; code: string; className: string; lectures: number }> }> = {};

    sessions.forEach((s: any) => {
      const fId = s.faculty_id;
      const fac = s.faculty;
      const facName = fac ? `${fac.first_name} ${fac.last_name}` : 'Unknown';
      const empId = fac?.employee_id || '-';

      if (!facultyMap[fId]) {
        facultyMap[fId] = {
          facultyName: facName, employeeId: empId,
          subjects: [], totalLectures: 0, totalStudentsMarked: 0, avgAttendancePct: 0,
          subjectMap: {},
        };
      }

      const entry = facultyMap[fId];
      entry.totalLectures++;

      // Subject breakdown
      const subKey = `${s.subject_id}_${s.class_id}`;
      const subName = s.subjects?.name || 'Unknown';
      const subCode = s.subjects?.code || '';
      const className = s.classes?.name || '';
      if (!entry.subjectMap[subKey]) entry.subjectMap[subKey] = { name: subName, code: subCode, className, lectures: 0 };
      entry.subjectMap[subKey].lectures++;

      // Attendance stats
      const att = s.lecture_attendance || [];
      entry.totalStudentsMarked += att.length;
      const present = att.filter((a: any) => a.status === 'present').length;
      entry.avgAttendancePct += att.length > 0 ? (present / att.length) * 100 : 0;
    });

    const rows: FacultyRow[] = Object.values(facultyMap)
      .map(f => ({
        ...f,
        subjects: Object.values(f.subjectMap),
        avgAttendancePct: f.totalLectures > 0 ? Math.round((f.avgAttendancePct / f.totalLectures) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.totalLectures - a.totalLectures);

    setReportData(rows);
    setGenerating(false);
  };

  const monthLabel = selMonth ? new Date(parseInt(selMonth.split('-')[0]), parseInt(selMonth.split('-')[1]) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';
  const totalLectures = reportData.reduce((s, r) => s + r.totalLectures, 0);

  const exportExcel = () => {
    const table = document.getElementById('fac-summary-table');
    if (!table) return;
    const html = `<html><head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px 8px;font-size:11px}</style></head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `faculty-summary-${selMonth}.xls`; a.click();
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
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Faculty Lecture Summary</h1>
            <p className="text-sm text-slate-500">Lectures conducted per faculty per month</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
              <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
            </div>
            <button onClick={generateReport} disabled={generating}
              className="py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-60">
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {reportData.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <div className="text-2xl font-bold text-blue-700" style={{ fontFamily: 'var(--font-display)' }}>{reportData.length}</div>
              <div className="text-xs text-blue-600 font-medium">Faculty Active</div>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-700" style={{ fontFamily: 'var(--font-display)' }}>{totalLectures}</div>
              <div className="text-xs text-emerald-600 font-medium">Total Lectures</div>
            </div>
            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
              <div className="text-2xl font-bold text-purple-700" style={{ fontFamily: 'var(--font-display)' }}>{monthLabel}</div>
              <div className="text-xs text-purple-600 font-medium">Report Period</div>
            </div>
          </div>
        )}

        {reportData.length > 0 && (
          <>
            <div className="flex gap-3 mb-4 print:hidden">
              <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">🖨️ Print</button>
              <button onClick={exportExcel} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">📊 Export Excel</button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="text-center py-4 border-b border-slate-100">
                {institution?.logo_url && <img src={institution.logo_url} alt="" className="h-14 mx-auto mb-1 object-contain" />}
                <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{institution?.name || 'Institution'}</h2>
                <h3 className="text-base font-bold text-blue-700 mt-1 underline">Faculty Lecture Summary — {monthLabel}</h3>
              </div>

              <div className="overflow-x-auto">
                <table id="fac-summary-table" className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 border-b-2 border-blue-200">
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Sr</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Faculty Name</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Emp ID</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Subjects Taught</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">Total Lectures</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">Students Marked</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">Avg. Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3 py-3 text-slate-500">{i + 1}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{r.facultyName}</td>
                        <td className="px-3 py-3 font-mono text-slate-600 text-xs">{r.employeeId}</td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            {r.subjects.map((sub, si) => (
                              <div key={si} className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700">{sub.name}</span>
                                <span className="text-xs text-slate-400">{sub.className}</span>
                                <span className="text-xs font-mono text-slate-500">×{sub.lectures}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-lg">{r.totalLectures}</span>
                        </td>
                        <td className="px-3 py-3 text-center font-medium text-slate-700">{r.totalStudentsMarked}</td>
                        <td className={`px-3 py-3 text-center font-bold ${r.avgAttendancePct < 75 ? 'text-red-600' : 'text-emerald-600'}`}>{r.avgAttendancePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                      <td className="px-3 py-3" colSpan={4}>TOTAL</td>
                      <td className="px-3 py-3 text-center">{totalLectures}</td>
                      <td className="px-3 py-3 text-center">{reportData.reduce((s, r) => s + r.totalStudentsMarked, 0)}</td>
                      <td className="px-3 py-3 text-center">
                        {reportData.length > 0 ? Math.round(reportData.reduce((s, r) => s + r.avgAttendancePct, 0) / reportData.length * 100) / 100 : 0}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {reportData.length === 0 && !generating && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-4">👨‍🏫</div>
            <p className="text-lg font-medium">Select month to generate faculty summary</p>
            <p className="text-sm mt-1">Shows lectures conducted per faculty from lecture sessions</p>
          </div>
        )}
      </div>

      <style jsx global>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: landscape; margin: 8mm; } }`}</style>
    </div>
  );
}
