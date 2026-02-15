'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Printer, RefreshCw, FileSpreadsheet } from 'lucide-react';

interface StudentRow {
  sr_no: number;
  roll_number: string;
  student_name: string;
  gender: 'B' | 'G' | '-';
  std: string;
  div: string;
  days: Record<number, 'P' | 'A' | 'H' | 'S' | 'L' | ''>;
  current_present: number;
  current_wd: number;
  current_pct: number;
  prev_present: number;
  prev_wd: number;
  cumul_present: number;
  cumul_wd: number;
  cumul_pct: number;
}

export default function MonthlyCumulativeReport() {
  const [user, setUser] = useState<any>(null);
  const [institution, setInstitution] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());
  const [offDaySet, setOffDaySet] = useState<Set<string>>(new Set());
  const [overrideSet, setOverrideSet] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<StudentRow[]>([]);

  const [selYear, setSelYear] = useState('');
  const [selClass, setSelClass] = useState('');
  const [selMonth, setSelMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // ────────────── Auth & Data Loading ──────────────
  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user) { loadInstitution(); loadAcademicYears(); } }, [user]);
  useEffect(() => { if (selYear) { loadClasses(); loadHolidays(); } }, [selYear]);

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

    // If institution_id is missing, auto-detect
    let instId = u.institution_id;
    if (!instId) {
      const { data: institutions } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
      if (institutions && institutions.length > 0) {
        instId = institutions[0].id;
        await supabase.from('users').update({ institution_id: instId }).eq('id', u.id);
      }
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
    const { data } = await supabase.from('academic_years').select('*')
      .eq('institution_id', user.institution_id).eq('is_active', true)
      .order('start_date', { ascending: false });
    setAcademicYears(data || []);
    const current = data?.find((y: any) => y.is_current) || data?.[0];
    if (current) setSelYear(current.id);
    const now = new Date();
    setSelMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setLoading(false);
  };

  const loadClasses = async () => {
    if (!user?.institution_id) return;
    let query = supabase.from('classes').select('*')
      .eq('institution_id', user.institution_id).eq('academic_year_id', selYear)
      .eq('is_active', true).order('name');
    // Faculty: only show their class-teacher classes
    if (user.role === 'faculty' && user.faculty_id) {
      query = query.eq('class_teacher_id', user.faculty_id);
    }
    const { data } = await query;
    setClasses(data || []);
  };

  const loadHolidays = async () => {
    if (!user?.institution_id) return;
    const yr = academicYears.find(y => y.id === selYear);
    if (!yr) return;
    const { data } = await supabase.from('holidays').select('date, holiday_type')
      .eq('institution_id', user.institution_id)
      .gte('date', yr.start_date).lte('date', yr.end_date);
    
    const hSet = new Set<string>();
    const oSet = new Set<string>();
    (data || []).forEach((h: any) => {
      if (h.holiday_type === 'working_override') oSet.add(h.date);
      else hSet.add(h.date);
    });

    // Compute all weekly off days in academic year
    const offDays: number[] = Array.isArray(institution?.weekly_off_days) ? institution.weekly_off_days : [0];
    const dSet = new Set<string>();
    const start = new Date(yr.start_date);
    const end = new Date(yr.end_date);
    const cur = new Date(start);
    while (cur <= end) {
      if (offDays.includes(cur.getDay())) dSet.add(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    setHolidaySet(hSet);
    setOffDaySet(dSet);
    setOverrideSet(oSet);
  };

  // ────────────── Helpers ──────────────
  const numDays = (() => {
    if (!selMonth) return 31;
    const [y, m] = selMonth.split('-');
    return new Date(parseInt(y), parseInt(m), 0).getDate();
  })();

  const monthName = (() => {
    if (!selMonth) return '';
    const [y, m] = selMonth.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  })();

  const cls = classes.find(c => c.id === selClass);

  const availableMonths = (() => {
    const yr = academicYears.find(y => y.id === selYear);
    if (!yr) return [];
    const out: { value: string; label: string }[] = [];
    const start = new Date(yr.start_date);
    const end = new Date(yr.end_date);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      out.push({
        value: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`,
        label: cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  })();

  // ────────────── Generate Report ──────────────
  const generate = async () => {
    if (!selClass || !selMonth) { alert('Select class and month'); return; }
    setGenerating(true);
    setGenerated(false);
    try {
      const [yearStr, monthStr] = selMonth.split('-');
      const yr = parseInt(yearStr), mo = parseInt(monthStr);
      const nd = new Date(yr, mo, 0).getDate();
      const acYear = academicYears.find(y => y.id === selYear);

      // Students
      const { data: students } = await supabase.from('students')
        .select('id, roll_number, first_name, last_name, gender')
        .eq('class_id', selClass).eq('is_active', true).order('roll_number');
      const sorted = (students || []).sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0));

      // Current month attendance
      const mStart = `${selMonth}-01`;
      const mEnd = `${selMonth}-${String(nd).padStart(2, '0')}`;
      const { data: curAtt } = await supabase.from('attendance')
        .select('student_id, date, status, is_late')
        .eq('class_id', selClass).gte('date', mStart).lte('date', mEnd);

      // Get class-specific start date
      const { data: classInfo } = await supabase.from('classes').select('classes_start_date, classes_end_date').eq('id', selClass).single();
      const classStartDate = classInfo?.classes_start_date || acYear?.start_date || mStart;

      // Previous months attendance (from class start date, not academic year)
      const prevEnd = new Date(yr, mo - 1, 0);
      let prevAtt: any[] = [];
      if (new Date(classStartDate) <= prevEnd) {
        const { data } = await supabase.from('attendance')
          .select('student_id, date, status')
          .eq('class_id', selClass)
          .gte('date', classStartDate)
          .lte('date', prevEnd.toISOString().split('T')[0]);
        prevAtt = data || [];
      }

      // Working days: current month (clip to class start if class started mid-month)
      let curWD = 0;
      for (let d = 1; d <= nd; d++) {
        const ds = `${selMonth}-${String(d).padStart(2, '0')}`;
        if (ds < classStartDate) continue; // Skip days before class started
        const dt = new Date(yr, mo - 1, d);
        if ((!offDaySet.has(ds) && !holidaySet.has(ds)) || overrideSet.has(ds)) curWD++;
      }

      // Working days: previous months (from class start date)
      let prevWD = 0;
      if (new Date(classStartDate) <= prevEnd) {
        const cursor = new Date(classStartDate);
        const pEnd = new Date(yr, mo - 1, 0);
        while (cursor <= pEnd) {
          const ds = cursor.toISOString().split('T')[0];
          if ((!offDaySet.has(ds) && !holidaySet.has(ds)) || overrideSet.has(ds)) prevWD++;
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      // Build maps
      const curMap: Record<string, Record<string, { status: string; is_late: boolean }>> = {};
      (curAtt || []).forEach(a => {
        if (!curMap[a.student_id]) curMap[a.student_id] = {};
        curMap[a.student_id][a.date] = { status: a.status, is_late: !!a.is_late };
      });

      const prevMap: Record<string, number> = {};
      prevAtt.forEach(a => { if (a.status === 'present') prevMap[a.student_id] = (prevMap[a.student_id] || 0) + 1; });

      // Build rows
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const selCls = classes.find(c => c.id === selClass);

      const newRows: StudentRow[] = sorted.map((s, idx) => {
        const days: StudentRow['days'] = {};
        let curPresent = 0;

        for (let d = 1; d <= nd; d++) {
          const ds = `${selMonth}-${String(d).padStart(2, '0')}`;
          const dt = new Date(yr, mo - 1, d);

          if (ds < classStartDate) {
            days[d] = ''; // Before class started
          } else if ((offDaySet.has(ds)) && !overrideSet.has(ds)) {
            days[d] = 'S';
          } else if (holidaySet.has(ds) && !overrideSet.has(ds)) {
            days[d] = 'H';
          } else {
            const att = curMap[s.id]?.[ds];
            if (att) {
              if (att.status === 'present') { days[d] = att.is_late ? 'L' : 'P'; curPresent++; }
              else { days[d] = 'A'; }
            } else if (dt > today) {
              days[d] = '';
            } else {
              days[d] = 'A';
            }
          }
        }

        const pp = prevMap[s.id] || 0;
        return {
          sr_no: idx + 1,
          roll_number: s.roll_number,
          student_name: `${s.last_name || ''} ${s.first_name || ''}`.trim().toUpperCase(),
          gender: (() => {
            const g = (s.gender || '').toLowerCase().trim();
            if (g === 'male' || g === 'm' || g === 'b' || g === 'boy') return 'B' as const;
            if (g === 'female' || g === 'f' || g === 'g' || g === 'girl') return 'G' as const;
            return '-' as const;
          })(),
          std: selCls?.name?.replace(/\s+/g, '') || '',
          div: selCls?.division || selCls?.name?.split(' ').pop() || 'A',
          days,
          current_present: curPresent,
          current_wd: curWD,
          current_pct: curWD > 0 ? Math.round((curPresent / curWD) * 10000) / 100 : 0,
          prev_present: pp,
          prev_wd: prevWD,
          cumul_present: pp + curPresent,
          cumul_wd: prevWD + curWD,
          cumul_pct: (prevWD + curWD) > 0 ? Math.round(((pp + curPresent) / (prevWD + curWD)) * 10000) / 100 : 0,
        };
      });

      setRows(newRows);
      setGenerated(true);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally { setGenerating(false); }
  };

  // ────────────── Summary ──────────────
  const computeSummary = () => {
    const boys = rows.filter(r => r.gender === 'B');
    const girls = rows.filter(r => r.gender === 'G');
    const ds: Record<number, { pB: number; pG: number; aB: number; aG: number }> = {};

    for (let d = 1; d <= numDays; d++) {
      ds[d] = { pB: 0, pG: 0, aB: 0, aG: 0 };
      rows.forEach(r => {
        const v = r.days[d];
        if (v === 'P' || v === 'L') { r.gender === 'B' ? ds[d].pB++ : ds[d].pG++; }
        else if (v === 'A') { r.gender === 'B' ? ds[d].aB++ : ds[d].aG++; }
      });
    }
    return { boys, girls, ds };
  };

  const isNonWorking = (d: number) => {
    const v = rows[0]?.days[d];
    return v === 'H' || v === 'S' || !v;
  };

  // ────────────── Cell Styling ──────────────
  const cellBg = (v: string) => {
    switch (v) {
      case 'P': return 'bg-green-50 text-green-900';
      case 'A': return 'bg-red-50 text-red-700 font-black';
      case 'H': return 'bg-blue-50 text-blue-500';
      case 'S': return 'bg-gray-100 text-gray-400';
      case 'L': return 'bg-yellow-50 text-yellow-700';
      default: return 'text-gray-200';
    }
  };

  // ────────────── Export Excel ──────────────
  const exportExcel = () => {
    if (!rows.length) return;
    const { boys, girls, ds } = computeSummary();

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>
  td, th { mso-number-format:\\@; font-family: Arial; font-size: 9pt; border: 1px solid #000; padding: 2px 4px; text-align: center; vertical-align: middle; }
  th { background-color: #f0f0f0; font-weight: bold; }
  .left { text-align: left; }
  .bold { font-weight: bold; }
  .red { color: #cc0000; font-weight: bold; }
  .yellow { color: #b45309; background: #fef3c7; font-weight: bold; }
  .green { background-color: #e6ffe6; }
  .blue { background-color: #e6f0ff; }
  .purple { background-color: #f0e6ff; }
  .greenrow { background-color: #ccffcc; font-weight: bold; }
  .redrow { background-color: #ffcccc; font-weight: bold; }
  .bluerow { background-color: #cce0ff; font-weight: bold; }
  .pinkrow { background-color: #ffe0f0; font-weight: bold; }
  .noborder { border: none; }
  .head { font-size: 14pt; font-weight: bold; text-align: center; border: none; }
  .subhead { font-size: 10pt; text-align: center; border: none; }
  .rpthead { font-size: 12pt; font-weight: bold; text-align: center; border: none; text-decoration: underline; }
</style></head><body>
<table>`;

    const totalCols = 4 + numDays + 5;

    // Header
    if (institution?.logo_url) {
      html += `<tr><td class="noborder" colspan="${totalCols}" style="text-align:center;padding:4px"><img src="${institution.logo_url}" style="height:50px;object-fit:contain" /></td></tr>`;
    }
    html += `<tr><td class="head" colspan="${totalCols}">${(institution?.name || 'INSTITUTION').toUpperCase()}</td></tr>`;
    const addr = institution?.address;
    const addrStr = typeof addr === 'string' ? addr : addr ? [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') : '';
    if (addrStr) html += `<tr><td class="subhead" colspan="${totalCols}">${addrStr}</td></tr>`;
    const contact = institution?.contact;
    if (contact) html += `<tr><td class="subhead" colspan="${totalCols}">Phone: ${contact.phone || ''} / Email: ${contact.email || ''}</td></tr>`;
    html += `<tr><td class="rpthead" colspan="${totalCols}">Monthly Cumulative Attendance Report</td></tr>`;
    html += `<tr><td class="noborder" colspan="${totalCols}"></td></tr>`;

    // Standard & Month row
    html += `<tr><td class="bold left noborder" colspan="4">Standard : ${cls?.name || ''}</td>`;
    for (let i = 0; i < numDays - 1; i++) html += `<td class="noborder"></td>`;
    html += `<td class="bold noborder" colspan="4">Month : ${monthName}</td></tr>`;

    // Column headers - Row 1
    html += `<tr>
      <th rowspan="2">Sr<br/>No.</th><th rowspan="2">Roll<br/>No</th>
      <th rowspan="2" class="left">Student Name</th><th rowspan="2">G</th>`;
    for (let d = 1; d <= numDays; d++) html += `<th rowspan="2">${d}</th>`;
    html += `<th colspan="2" class="green">CURRENT MONTH</th>
      <th class="blue">PREVIOUS MONTHS</th>
      <th colspan="2" class="purple">CUMULATIVE ATTENDANCE</th></tr>`;

    // Column headers - Row 2
    html += `<tr>
      <th class="green">W.D=${rows[0]?.current_wd || 0}</th><th class="green">%</th>
      <th class="blue">W.D=${rows[0]?.prev_wd || 0}</th>
      <th class="purple">W.D=${rows[0]?.cumul_wd || 0}</th><th class="purple">%</th></tr>`;

    // Student rows
    rows.forEach(r => {
      html += `<tr><td>${r.sr_no}</td><td>${r.roll_number}</td>
        <td class="left bold">${r.student_name}</td><td>${r.gender}</td>`;
      for (let d = 1; d <= numDays; d++) {
        const v = r.days[d] || '';
        html += `<td${v === 'A' ? ' class="red"' : v === 'L' ? ' class="yellow"' : ''}>${v}</td>`;
      }
      html += `<td class="green bold">${r.current_present}</td>
        <td class="green bold">${r.current_pct}%</td>
        <td class="blue">${r.prev_present}</td>
        <td class="purple bold">${r.cumul_present}</td>
        <td class="purple bold${r.cumul_pct < 75 ? ' red' : ''}">${r.cumul_pct}%</td></tr>`;
    });

    // Summary rows helper
    const sumRow = (label: string, fn: (d: number) => number, cssClass: string, avgLabel: string, avgVal: string | number) => {
      html += `<tr class="${cssClass}"><td class="bold left" colspan="4">${label}</td>`;
      for (let d = 1; d <= numDays; d++) html += `<td>${isNonWorking(d) ? 0 : fn(d)}</td>`;
      html += `<td colspan="2" class="bold">${avgLabel}</td><td colspan="3" class="bold">${avgVal}</td></tr>`;
    };

    sumRow('TOTAL PRESENT BOYS', d => ds[d].pB, 'bluerow', 'AVG. PRESENT BOYS', boys.length);
    sumRow('TOTAL PRESENT GIRLS', d => ds[d].pG, 'pinkrow', 'AVG. PRESENT GIRLS', girls.length);
    sumRow('TOTAL ABSENT BOYS', d => ds[d].aB, 'bluerow', 'AVG. ABSENT BOYS', 0);
    sumRow('TOTAL ABSENT GIRLS', d => ds[d].aG, 'pinkrow', 'AVG. ABSENT GIRLS', 0);
    sumRow('TOTAL PRESENT', d => ds[d].pB + ds[d].pG, 'greenrow', 'AVG. PRESENT', rows.length);
    sumRow('TOTAL ABSENT', d => ds[d].aB + ds[d].aG, 'redrow', 'AVG. ABSENT', '');

    // Percentage rows
    const pctRow = (label: string, fn: (d: number) => number, cssClass: string, avgLabel: string, avgVal: string) => {
      html += `<tr class="${cssClass}"><td class="bold left" colspan="4">${label}</td>`;
      for (let d = 1; d <= numDays; d++) {
        const pct = !isNonWorking(d) && rows.length ? Math.round((fn(d) / rows.length) * 100) : 0;
        html += `<td>${isNonWorking(d) ? '0%' : pct + '%'}</td>`;
      }
      html += `<td colspan="2" class="bold">${avgLabel}</td><td colspan="3" class="bold">${avgVal}</td></tr>`;
    };

    const avgPres = rows.length ? Math.round(rows.reduce((s, r) => s + r.current_pct, 0) / rows.length) + '%' : '0%';
    const avgAbs = rows.length ? Math.round(rows.reduce((s, r) => s + (100 - r.current_pct), 0) / rows.length) + '%' : '0%';
    pctRow('PERCENTAGE OF PRESENT', d => ds[d].pB + ds[d].pG, 'greenrow', 'AVG. % OF PRESENT', avgPres);
    pctRow('PERCENTAGE OF ABSENT', d => ds[d].aB + ds[d].aG, 'redrow', 'AVG. % OF ABSENT', avgAbs);

    html += `</table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Monthly_Attendance_${cls?.name || 'Report'}_${monthName}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ────────────── RENDER ──────────────
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-lg">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow print:hidden">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center">
              <button onClick={() => router.push('/super-admin/reports')} className="mr-4 p-2 rounded-md hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Monthly Cumulative Attendance Report</h1>
                <p className="text-sm text-gray-500">Matches sppspay.net format — P / A / H / S for each day</p>
              </div>
            </div>
            {generated && rows.length > 0 && (
              <div className="flex gap-2">
                <button onClick={exportExcel} className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium">
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
                </button>
                <button onClick={() => window.print()} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
                  <Printer className="w-4 h-4 mr-2" /> Print
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 print:hidden">
        <div className="bg-white rounded-lg shadow p-5 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Standard / Class</label>
              <select value={selClass} onChange={e => setSelClass(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="">— Select Class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Month</label>
              <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="">— Select Month —</option>
                {availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <button onClick={generate} disabled={generating || !selClass || !selMonth}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium h-[42px]">
              {generating ? <span className="flex items-center justify-center"><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</span> : 'Generate Report'}
            </button>
          </div>
        </div>

        {!generated && !generating && (
          <div className="bg-white rounded-lg shadow p-16 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900">Select a class and month to generate report</h3>
            <p className="mt-2 text-sm text-gray-500">The report matches the sppspay.net Monthly Cumulative Attendance format</p>
          </div>
        )}
      </div>

      {/* Report Output */}
      {generated && rows.length > 0 && (() => {
        const { boys, girls, ds } = computeSummary();
        return (
          <div className="mx-auto px-2 sm:px-4 pb-8">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden print:shadow-none print:rounded-none">
              {/* Letterhead */}
              <div className="text-center py-3 border-b-2 border-gray-800">
                {institution?.logo_url && (
                  <img src={institution.logo_url} alt="" className="h-14 mx-auto mb-1 object-contain print:h-12" />
                )}
                <h2 className="text-base font-bold uppercase tracking-wide">{institution?.name || 'INSTITUTION'}</h2>
                {institution?.address && (
                  <p className="text-[11px] text-gray-600">
                    {typeof institution.address === 'string' ? institution.address
                      : [institution.address.street, institution.address.city, institution.address.state, institution.address.pincode].filter(Boolean).join(', ')}
                  </p>
                )}
                {institution?.contact && (
                  <p className="text-[11px] text-gray-600">
                    Phone: {institution.contact.phone || ''} / Email: {institution.contact.email || ''}
                  </p>
                )}
                <h3 className="text-sm font-bold mt-2 underline">Monthly Cumulative Attendance Report</h3>
              </div>

              {/* Standard / Month bar */}
              <div className="flex justify-between px-4 py-2 border-b bg-gray-50 text-sm font-bold">
                <span>Standard : {cls?.name || ''}</span>
                <span>Month : {monthName}</span>
              </div>

              {/* ═══ MAIN TABLE ═══ */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize: '10px' }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-500 px-1 py-1" rowSpan={2} style={{ minWidth: 26 }}>Sr<br/>No.</th>
                      <th className="border border-gray-500 px-1 py-1" rowSpan={2} style={{ minWidth: 26 }}>Roll<br/>No</th>
                      <th className="border border-gray-500 px-1 py-1 text-left" rowSpan={2} style={{ minWidth: 130 }}>Student Name</th>
                      <th className="border border-gray-500 px-1 py-1" rowSpan={2}>G</th>
                      {Array.from({ length: numDays }, (_, i) => (
                        <th key={i} className="border border-gray-500 px-0 py-1" rowSpan={2} style={{ width: 22, minWidth: 22 }}>{i + 1}</th>
                      ))}
                      <th className="border border-gray-500 px-1 py-1 bg-green-100" colSpan={2}>CURRENT<br/>MONTH</th>
                      <th className="border border-gray-500 px-1 py-1 bg-blue-100">PREVIOUS<br/>MONTHS</th>
                      <th className="border border-gray-500 px-1 py-1 bg-purple-100" colSpan={2}>CUMULATIVE<br/>ATTENDANCE</th>
                    </tr>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-500 px-1 py-0.5 bg-green-100 text-[9px]">W.D={rows[0].current_wd}</th>
                      <th className="border border-gray-500 px-1 py-0.5 bg-green-100 text-[9px]">%</th>
                      <th className="border border-gray-500 px-1 py-0.5 bg-blue-100 text-[9px]">W.D={rows[0].prev_wd}</th>
                      <th className="border border-gray-500 px-1 py-0.5 bg-purple-100 text-[9px]">W.D={rows[0].cumul_wd}</th>
                      <th className="border border-gray-500 px-1 py-0.5 bg-purple-100 text-[9px]">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Student rows */}
                    {rows.map((r, i) => (
                      <tr key={i} className={i % 2 ? 'bg-gray-50/40' : ''}>
                        <td className="border border-gray-300 px-1 py-0.5 text-center">{r.sr_no}</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{r.roll_number}</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-left font-semibold whitespace-nowrap" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.student_name}
                        </td>
                        <td className="border border-gray-300 px-0.5 py-0.5 text-center">{r.gender}</td>
                        {Array.from({ length: numDays }, (_, d) => {
                          const v = r.days[d + 1] || '';
                          return <td key={d} className={`border border-gray-300 px-0 py-0.5 text-center font-bold ${cellBg(v)}`} style={{ width: 22 }}>{v}</td>;
                        })}
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-bold bg-green-50">{r.current_present}</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-bold bg-green-50">{r.current_pct}%</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center bg-blue-50">{r.prev_present}</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-bold bg-purple-50">{r.cumul_present}</td>
                        <td className={`border border-gray-300 px-1 py-0.5 text-center font-bold bg-purple-50 ${r.cumul_pct < 75 ? 'text-red-600' : ''}`}>
                          {r.cumul_pct}%
                        </td>
                      </tr>
                    ))}

                    {/* ═══ SUMMARY ROWS ═══ */}
                    {[
                      { label: 'TOTAL PRESENT BOYS', fn: (d: number) => ds[d].pB, bg: 'bg-blue-50', avg: boys.length },
                      { label: 'TOTAL PRESENT GIRLS', fn: (d: number) => ds[d].pG, bg: 'bg-pink-50', avg: girls.length },
                      { label: 'TOTAL ABSENT BOYS', fn: (d: number) => ds[d].aB, bg: 'bg-blue-50', avg: 0 },
                      { label: 'TOTAL ABSENT GIRLS', fn: (d: number) => ds[d].aG, bg: 'bg-pink-50', avg: 0 },
                      { label: 'TOTAL PRESENT', fn: (d: number) => ds[d].pB + ds[d].pG, bg: 'bg-green-100', avg: rows.length },
                      { label: 'TOTAL ABSENT', fn: (d: number) => ds[d].aB + ds[d].aG, bg: 'bg-red-100', avg: '' },
                    ].map((def, ri) => (
                      <tr key={`s${ri}`} className={`${def.bg} font-bold`}>
                        <td className="border border-gray-500 px-1 py-1 text-left text-[9px]" colSpan={4}>{def.label}</td>
                        {Array.from({ length: numDays }, (_, d) => (
                          <td key={d} className="border border-gray-400 px-0 py-1 text-center text-[9px]">
                            {isNonWorking(d + 1) ? 0 : def.fn(d + 1)}
                          </td>
                        ))}
                        <td className="border border-gray-500 px-1 py-1 text-center text-[8px]" colSpan={2}>
                          AVG. {def.label.replace('TOTAL ', '')}
                        </td>
                        <td className="border border-gray-500 px-1 py-1 text-center text-[9px]" colSpan={3}>{def.avg}</td>
                      </tr>
                    ))}

                    {/* Percentage Present */}
                    <tr className="bg-green-200 font-bold">
                      <td className="border border-gray-500 px-1 py-1 text-left text-[9px]" colSpan={4}>PERCENTAGE OF PRESENT</td>
                      {Array.from({ length: numDays }, (_, d) => {
                        const nw = isNonWorking(d + 1);
                        const p = !nw && rows.length ? Math.round(((ds[d + 1].pB + ds[d + 1].pG) / rows.length) * 100) : 0;
                        return <td key={d} className="border border-gray-400 px-0 py-1 text-center text-[9px]">{nw ? '0%' : `${p}%`}</td>;
                      })}
                      <td className="border border-gray-500 px-1 py-1 text-center text-[8px]" colSpan={2}>AVG. % OF PRESENT</td>
                      <td className="border border-gray-500 px-1 py-1 text-center text-[9px]" colSpan={3}>
                        {rows.length ? Math.round(rows.reduce((s, r) => s + r.current_pct, 0) / rows.length) : 0}%
                      </td>
                    </tr>
                    {/* Percentage Absent */}
                    <tr className="bg-red-200 font-bold">
                      <td className="border border-gray-500 px-1 py-1 text-left text-[9px]" colSpan={4}>PERCENTAGE OF ABSENT</td>
                      {Array.from({ length: numDays }, (_, d) => {
                        const nw = isNonWorking(d + 1);
                        const a = !nw && rows.length ? Math.round(((ds[d + 1].aB + ds[d + 1].aG) / rows.length) * 100) : 0;
                        return <td key={d} className="border border-gray-400 px-0 py-1 text-center text-[9px]">{nw ? '0%' : `${a}%`}</td>;
                      })}
                      <td className="border border-gray-500 px-1 py-1 text-center text-[8px]" colSpan={2}>AVG. % OF ABSENT</td>
                      <td className="border border-gray-500 px-1 py-1 text-center text-[9px]" colSpan={3}>
                        {rows.length ? Math.round(rows.reduce((s, r) => s + (100 - r.current_pct), 0) / rows.length) : 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap gap-4 text-[10px] print:text-[8px]">
                <span className="flex items-center gap-1"><span className="inline-block w-5 h-4 bg-green-50 border text-center font-bold text-green-900 leading-4">P</span> Present</span>
                <span className="flex items-center gap-1"><span className="inline-block w-5 h-4 bg-red-50 border text-center font-bold text-red-700 leading-4">A</span> Absent</span>
                <span className="flex items-center gap-1"><span className="inline-block w-5 h-4 bg-blue-50 border text-center font-bold text-blue-500 leading-4">H</span> Holiday</span>
                <span className="flex items-center gap-1"><span className="inline-block w-5 h-4 bg-gray-100 border text-center font-bold text-gray-400 leading-4">S</span> Weekly Off</span>
                <span className="flex items-center gap-1"><span className="inline-block w-5 h-4 bg-yellow-50 border text-center font-bold text-yellow-700 leading-4">L</span> Late</span>
                <span className="ml-auto text-gray-500">Students below 75% shown in <span className="text-red-600 font-bold">red</span></span>
              </div>
            </div>
          </div>
        );
      })()}

      {generated && rows.length === 0 && (
        <div className="mx-auto px-4 pb-8 print:hidden">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-900">No students found</h3>
            <p className="text-sm text-gray-500 mt-2">Make sure students are enrolled and active in this class.</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          @page { size: landscape; margin: 3mm; }
          table { font-size: 7px !important; border-collapse: collapse; width: 100%; table-layout: fixed; }
          td, th { padding: 1px 1px !important; overflow: hidden; word-break: break-all; }
          th { font-size: 7px !important; }
        }
      `}</style>
    </div>
  );
}
