'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SubjectWiseReport() {
  const [user, setUser] = useState<any>(null);
  const [institution, setInstitution] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selYear, setSelYear] = useState('');
  const [selClass, setSelClass] = useState('');
  const [selMonth, setSelMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
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
    // Role check: admin, class teacher, or subject teacher
    if (!['super_admin', 'institution_admin'].includes(u.role)) {
      if (u.role === 'faculty') {
        const { data: fac } = await supabase.from('faculty').select('id').eq('user_id', u.id).single();
        if (!fac) { router.push('/login'); return; }
        u.faculty_id = fac.id;
      } else { router.push('/login'); return; }
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
  const loadClasses = async () => {
    if (!user?.institution_id) return;
    let query = supabase.from('classes').select('*').eq('institution_id', user.institution_id).eq('academic_year_id', selYear).eq('is_active', true).order('name');
    if (user.role === 'faculty' && user.faculty_id) {
      // For faculty: show classes they teach OR are class teacher of
      const { data: assignedClasses } = await supabase.from('faculty_assignments').select('class_id').eq('faculty_id', user.faculty_id);
      const { data: ctClasses } = await supabase.from('classes').select('id').eq('class_teacher_id', user.faculty_id);
      const classIds = new Set([
        ...(assignedClasses || []).map((a: any) => a.class_id),
        ...(ctClasses || []).map((c: any) => c.id)
      ]);
      if (classIds.size > 0) {
        query = query.in('id', Array.from(classIds));
      }
    }
    const { data } = await query;
    setClasses(data || []);
  };

  const generateReport = async () => {
    if (!selYear || !selClass || !selMonth) return;
    setGenerating(true);

    const [yr, mo] = selMonth.split('-').map(Number);
    const mStart = `${selMonth}-01`;
    const mEnd = `${selMonth}-${new Date(yr, mo, 0).getDate()}`;

    // Load lecture sessions for this class + month
    const { data: sessions, error: sessError } = await supabase.from('lecture_sessions')
      .select('id, subject_id, faculty_id, date, period_from, period_to, batch_name, session_type, subjects(name, code), faculty(first_name, last_name)')
      .eq('class_id', selClass).gte('date', mStart).lte('date', mEnd).order('date');

    if (sessError) {
      console.error('Error loading lecture sessions:', sessError);
      alert('Subject-wise report requires lecture sessions data. Please ensure lecture_sessions table exists and has data for this class/month.\n\nRun migration-lecture-sessions.sql if needed.');
      setGenerating(false); return;
    }

    if (!sessions?.length) { setReportData([]); setGenerating(false); return; }

    // Load all lecture attendance for these sessions
    const sessionIds = sessions.map(s => s.id);
    const { data: attendance } = await supabase.from('lecture_attendance').select('lecture_session_id, student_id, status').in('lecture_session_id', sessionIds);

    // Load students
    const { data: students } = await supabase.from('students').select('id, roll_number, first_name, last_name, gender').eq('class_id', selClass).eq('is_active', true);

    // Group sessions by subject
    const subjectMap: Record<string, { name: string; code: string; faculty: string; sessions: any[]; totalLectures: number }> = {};
    sessions.forEach((s: any) => {
      const subId = s.subject_id;
      const subName = s.subjects?.name || 'Unknown';
      const subCode = s.subjects?.code || '';
      const facName = s.faculty ? `${s.faculty.first_name} ${s.faculty.last_name}` : 'N/A';
      if (!subjectMap[subId]) subjectMap[subId] = { name: subName, code: subCode, faculty: facName, sessions: [], totalLectures: 0 };
      subjectMap[subId].sessions.push(s);
      subjectMap[subId].totalLectures++;
    });

    // Build subject-wise student data
    const genderMap = (g: string) => {
      const gl = (g || '').toLowerCase().trim();
      if (['male', 'm', 'b', 'boy'].includes(gl)) return 'B';
      if (['female', 'f', 'g', 'girl'].includes(gl)) return 'G';
      return '-';
    };

    const subjectReports = Object.entries(subjectMap).map(([subId, info]) => {
      const sessIds = info.sessions.map(s => s.id);
      const subAtt = (attendance || []).filter(a => sessIds.includes(a.lecture_session_id));

      const studentRows = (students || [])
        .sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0))
        .map(s => {
          const sAtt = subAtt.filter(a => a.student_id === s.id);
          const present = sAtt.filter(a => a.status === 'present').length;
          const total = info.totalLectures;
          const pct = total > 0 ? (present / total) * 100 : 0;
          return {
            rollNo: s.roll_number,
            name: `${s.last_name || ''} ${s.first_name || ''}`.trim().toUpperCase(),
            gender: genderMap(s.gender),
            total,
            present,
            absent: total - present,
            pct: Math.round(pct * 100) / 100,
          };
        });

      return { subjectName: info.name, subjectCode: info.code, faculty: info.faculty, totalLectures: info.totalLectures, students: studentRows };
    });

    setReportData(subjectReports);
    setGenerating(false);
  };

  const monthLabel = selMonth ? new Date(parseInt(selMonth.split('-')[0]), parseInt(selMonth.split('-')[1]) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';
  const classLabel = classes.find(c => c.id === selClass)?.name || '';

  const exportExcel = () => {
    const tables = document.querySelectorAll('.subject-table');
    let html = `<html><head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px 8px;font-size:11px}h3{margin:20px 0 8px}</style></head><body>`;
    tables.forEach(t => { html += t.outerHTML; });
    html += '</body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `subject-wise-${selMonth}.xls`; a.click();
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
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Subject-wise Lecture Report</h1>
            <p className="text-sm text-slate-500">Attendance per subject from lecture sessions</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select value={selClass} onChange={e => setSelClass(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500">
                <option value="">— Select Class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
              <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
            </div>
            <button onClick={generateReport} disabled={generating || !selClass}
              className="py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-60">
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {reportData.length > 0 && (
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
              <h3 className="text-sm font-bold mt-1 underline">Subject-wise Lecture Report</h3>
            </div>

            <div className="flex gap-3 mb-4 print:hidden">
              <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">🖨️ Print</button>
              <button onClick={exportExcel} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">📊 Export Excel</button>
            </div>

            {reportData.map((sub, si) => (
              <div key={si} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6 subject-table">
                <div className="px-5 py-4 border-b border-slate-100 bg-purple-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{sub.subjectName} ({sub.subjectCode})</h3>
                      <p className="text-sm text-slate-500">Faculty: {sub.faculty} | Class: {classLabel} | Month: {monthLabel}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-700" style={{ fontFamily: 'var(--font-display)' }}>{sub.totalLectures}</div>
                      <div className="text-xs text-slate-500">Lectures</div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <th className="px-3 py-2.5 text-left font-bold text-slate-700">Sr</th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-700">Roll No</th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-700">Student Name</th>
                        <th className="px-3 py-2.5 text-center font-bold text-slate-700">G</th>
                        <th className="px-3 py-2.5 text-center font-bold text-slate-700">Total Lectures</th>
                        <th className="px-3 py-2.5 text-center font-bold text-emerald-700">Present</th>
                        <th className="px-3 py-2.5 text-center font-bold text-red-700">Absent</th>
                        <th className="px-3 py-2.5 text-center font-bold text-slate-700">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sub.students.map((s: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{s.rollNo}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{s.name}</td>
                          <td className="px-3 py-2 text-center">{s.gender}</td>
                          <td className="px-3 py-2 text-center font-medium">{s.total}</td>
                          <td className="px-3 py-2 text-center text-emerald-700 font-medium">{s.present}</td>
                          <td className="px-3 py-2 text-center text-red-600 font-medium">{s.absent}</td>
                          <td className={`px-3 py-2 text-center font-bold ${s.pct < 75 ? 'text-red-600' : 'text-emerald-600'}`}>{s.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}

        {reportData.length === 0 && !generating && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-lg font-medium">Select class and month to generate report</p>
            <p className="text-sm mt-1">Report uses data from lecture sessions (per-period attendance)</p>
          </div>
        )}
      </div>

      <style jsx global>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: portrait; margin: 8mm; } }`}</style>
    </div>
  );
}
