'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function DailySummaryReport() {
  const [user, setUser] = useState<any>(null);
  const [institution, setInstitution] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selYear, setSelYear] = useState('');
  const [selDate, setSelDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user) { loadInstitution(); loadAcademicYears(); } }, [user]);

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

  const generateReport = async () => {
    if (!selYear || !selDate) return;
    setGenerating(true);

    // Load all classes for this academic year
    let classQuery = supabase.from('classes').select('id, name, classes_start_date, classes_end_date')
      .eq('institution_id', user.institution_id).eq('academic_year_id', selYear).eq('is_active', true).order('name');
    // Faculty: only their class-teacher classes
    if (user.role === 'faculty' && user.faculty_id) {
      classQuery = classQuery.eq('class_teacher_id', user.faculty_id);
    }
    const { data: classes } = await classQuery;

    if (!classes?.length) { setReportData([]); setGenerating(false); return; }

    // Load holidays
    const { data: hols } = await supabase.from('holidays').select('date, holiday_type').eq('institution_id', user.institution_id);
    const holDates = (hols || []).filter((h: any) => h.holiday_type !== 'working_override').map((h: any) => h.date);
    const overrideDates = (hols || []).filter((h: any) => h.holiday_type === 'working_override').map((h: any) => h.date);
    setHolidays(holDates);

    // Check if selected date is a weekly off day or holiday
    const dateObj = new Date(selDate + 'T00:00:00');
    const offDays: number[] = Array.isArray(institution?.weekly_off_days) ? institution.weekly_off_days : [0];
    const isWeeklyOff = offDays.includes(dateObj.getDay());
    const isHoliday = holDates.includes(selDate);
    const isOverride = overrideDates.includes(selDate);

    // Load all attendance records for this date
    const classIds = classes.map(c => c.id);
    const { data: attendance } = await supabase.from('attendance').select('student_id, class_id, status, is_late')
      .in('class_id', classIds).eq('date', selDate);

    // Load student counts per class with gender
    const { data: allStudents } = await supabase.from('students').select('id, class_id, gender')
      .in('class_id', classIds).eq('is_active', true);

    const rows = classes.map(cls => {
      // Check if class hasn't started yet on the selected date
      const notStarted = cls.classes_start_date && selDate < cls.classes_start_date;
      const classEnded = cls.classes_end_date && selDate > cls.classes_end_date;
      
      const classStudents = (allStudents || []).filter(s => s.class_id === cls.id);
      const classAtt = (attendance || []).filter(a => a.class_id === cls.id);
      const boys = classStudents.filter(s => ['male', 'Male', 'M', 'm', 'B', 'b', 'Boy', 'boy'].includes(s.gender || ''));
      const girls = classStudents.filter(s => ['female', 'Female', 'F', 'f', 'G', 'g', 'Girl', 'girl'].includes(s.gender || ''));

      const presentIds = classAtt.filter(a => a.status === 'present').map(a => a.student_id);
      const absentIds = classAtt.filter(a => a.status === 'absent').map(a => a.student_id);
      const lateIds = classAtt.filter(a => a.is_late).map(a => a.student_id);

      const presentBoys = boys.filter(b => presentIds.includes(b.id)).length;
      const presentGirls = girls.filter(g => presentIds.includes(g.id)).length;
      const absentBoys = boys.filter(b => absentIds.includes(b.id)).length;
      const absentGirls = girls.filter(g => absentIds.includes(g.id)).length;

      const total = classStudents.length;
      const present = presentIds.length;
      const absent = absentIds.length;
      const pct = total > 0 ? ((present / total) * 100) : 0;

      return {
        className: cls.name,
        totalBoys: boys.length,
        totalGirls: girls.length,
        total,
        presentBoys,
        presentGirls,
        present,
        absentBoys,
        absentGirls,
        absent,
        late: lateIds.length,
        unmarked: total - present - absent,
        pct: pct.toFixed(1),
        isSunday: isWeeklyOff && !isOverride,
        isHoliday: isHoliday && !isOverride,
        notStarted: !!notStarted,
        classEnded: !!classEnded,
      };
    });

    setReportData(rows);
    setGenerating(false);
  };

  const totals = reportData.reduce((acc, r) => ({
    total: acc.total + r.total, totalBoys: acc.totalBoys + r.totalBoys, totalGirls: acc.totalGirls + r.totalGirls,
    present: acc.present + r.present, presentBoys: acc.presentBoys + r.presentBoys, presentGirls: acc.presentGirls + r.presentGirls,
    absent: acc.absent + r.absent, absentBoys: acc.absentBoys + r.absentBoys, absentGirls: acc.absentGirls + r.absentGirls,
    late: acc.late + r.late, unmarked: acc.unmarked + r.unmarked,
  }), { total: 0, totalBoys: 0, totalGirls: 0, present: 0, presentBoys: 0, presentGirls: 0, absent: 0, absentBoys: 0, absentGirls: 0, late: 0, unmarked: 0 });

  const exportExcel = () => {
    const table = document.getElementById('daily-summary-table');
    if (!table) return;
    const html = `<html><head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px 8px;font-size:11px}</style></head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `daily-summary-${selDate}.xls`; a.click();
  };

  const dayLabel = new Date(selDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-500">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center gap-4">
          <button onClick={() => router.push('/super-admin/reports')} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Daily Attendance Summary</h1>
            <p className="text-sm text-slate-500">Present/Absent count for a specific date across all classes</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
            </div>
            <button onClick={generateReport} disabled={generating}
              className="py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-60">
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Report */}
        {reportData.length > 0 && (
          <>
            {/* Actions */}
            <div className="flex gap-3 mb-4 print:hidden">
              <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">🖨️ Print</button>
              <button onClick={exportExcel} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">📊 Export Excel</button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Print Header */}
              <div className="text-center py-4 border-b border-slate-100">
                {institution?.logo_url && <img src={institution.logo_url} alt="" className="h-14 mx-auto mb-1 object-contain" />}
                <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{institution?.name || 'Institution'}</h2>
                {institution?.address && <p className="text-xs text-slate-500">{typeof institution.address === 'string' ? institution.address : [institution.address.line1, institution.address.line2, institution.address.city, institution.address.state, institution.address.pincode].filter(Boolean).join(', ')}</p>}
                <h3 className="text-base font-bold text-slate-800 mt-2 underline">Daily Attendance Summary</h3>
                <p className="text-sm text-slate-600 mt-1">{dayLabel}</p>
                {reportData[0]?.isSunday && <p className="text-sm font-bold text-blue-600 mt-1">⚠️ Weekly Off Day — Non-working day</p>}
                {reportData[0]?.isHoliday && <p className="text-sm font-bold text-red-600 mt-1">⚠️ Holiday</p>}
              </div>

              <div className="overflow-x-auto">
                <table id="daily-summary-table" className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Sr</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-700">Class</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">Total Boys</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">Total Girls</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">Total</th>
                      <th className="px-3 py-3 text-center font-bold text-emerald-700 bg-emerald-50">Present Boys</th>
                      <th className="px-3 py-3 text-center font-bold text-emerald-700 bg-emerald-50">Present Girls</th>
                      <th className="px-3 py-3 text-center font-bold text-emerald-700 bg-emerald-50">Total Present</th>
                      <th className="px-3 py-3 text-center font-bold text-red-700 bg-red-50">Absent Boys</th>
                      <th className="px-3 py-3 text-center font-bold text-red-700 bg-red-50">Absent Girls</th>
                      <th className="px-3 py-3 text-center font-bold text-red-700 bg-red-50">Total Absent</th>
                      <th className="px-3 py-3 text-center font-bold text-amber-700 bg-amber-50">Late</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700 bg-slate-50">Unmarked</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-700">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {r.className}
                          {r.notStarted && <span className="ml-2 text-xs text-amber-500 font-normal">⏳ Not started</span>}
                          {r.classEnded && <span className="ml-2 text-xs text-slate-400 font-normal">✓ Ended</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">{r.totalBoys}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600">{r.totalGirls}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-800">{r.total}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-700 bg-emerald-50/50">{r.presentBoys}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-700 bg-emerald-50/50">{r.presentGirls}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-emerald-700 bg-emerald-50/50">{r.present}</td>
                        <td className="px-3 py-2.5 text-center text-red-600 bg-red-50/50">{r.absentBoys}</td>
                        <td className="px-3 py-2.5 text-center text-red-600 bg-red-50/50">{r.absentGirls}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-red-600 bg-red-50/50">{r.absent}</td>
                        <td className="px-3 py-2.5 text-center text-amber-600 bg-amber-50/50">{r.late}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500 bg-slate-50/50">{r.unmarked}</td>
                        <td className={`px-3 py-2.5 text-center font-bold ${parseFloat(r.pct) < 75 ? 'text-red-600' : 'text-emerald-600'}`}>{r.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                      <td className="px-3 py-3" colSpan={2}>GRAND TOTAL</td>
                      <td className="px-3 py-3 text-center">{totals.totalBoys}</td>
                      <td className="px-3 py-3 text-center">{totals.totalGirls}</td>
                      <td className="px-3 py-3 text-center">{totals.total}</td>
                      <td className="px-3 py-3 text-center text-emerald-700">{totals.presentBoys}</td>
                      <td className="px-3 py-3 text-center text-emerald-700">{totals.presentGirls}</td>
                      <td className="px-3 py-3 text-center text-emerald-700">{totals.present}</td>
                      <td className="px-3 py-3 text-center text-red-600">{totals.absentBoys}</td>
                      <td className="px-3 py-3 text-center text-red-600">{totals.absentGirls}</td>
                      <td className="px-3 py-3 text-center text-red-600">{totals.absent}</td>
                      <td className="px-3 py-3 text-center text-amber-600">{totals.late}</td>
                      <td className="px-3 py-3 text-center text-slate-500">{totals.unmarked}</td>
                      <td className="px-3 py-3 text-center">{totals.total > 0 ? ((totals.present / totals.total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {reportData.length === 0 && !generating && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg font-medium">Select a date and generate report</p>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: landscape; margin: 8mm; } }
      `}</style>
    </div>
  );
}
