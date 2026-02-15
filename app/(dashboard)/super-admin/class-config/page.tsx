'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface ClassConfig {
  id: string;
  name: string;
  grade: string;
  stream: string;
  division: string;
  classes_start_date: string | null;
  classes_end_date: string | null;
  max_students: number;
  is_active: boolean;
  room_number: string;
  studentCount?: number;
  class_teacher?: { first_name: string; last_name: string } | null;
}

export default function ClassConfigPage() {
  const [user, setUser] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<ClassConfig[]>([]);
  const [selYear, setSelYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkGrade, setBulkGrade] = useState('');
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');
  const [editMap, setEditMap] = useState<Record<string, { start: string; end: string }>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user) loadAcademicYears(); }, [user]);
  useEffect(() => { if (selYear) loadClasses(); }, [selYear]);

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/login'); return; }
    const { data: u } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (!u || (u.role !== 'super_admin' && u.role !== 'institution_admin')) { router.push('/login'); return; }
    let instId = u.institution_id;
    if (!instId) {
      const { data: inst } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
      if (inst?.length) { instId = inst[0].id; await supabase.from('users').update({ institution_id: instId }).eq('id', u.id); }
    }
    setUser({ ...u, institution_id: instId });
  };

  const loadAcademicYears = async () => {
    const { data } = await supabase.from('academic_years').select('*')
      .eq('institution_id', user.institution_id).eq('is_active', true).order('start_date', { ascending: false });
    setAcademicYears(data || []);
    const current = data?.find((y: any) => y.is_current) || data?.[0];
    if (current) setSelYear(current.id);
    setLoading(false);
  };

  const loadClasses = async () => {
    const { data } = await supabase.from('classes')
      .select('id, name, grade, stream, division, classes_start_date, classes_end_date, max_students, is_active, room_number, class_teacher_id')
      .eq('institution_id', user.institution_id).eq('academic_year_id', selYear).order('name');

    if (!data) { setClasses([]); return; }

    // Load student counts
    const classIds = data.map(c => c.id);
    const { data: students } = await supabase.from('students').select('class_id').in('class_id', classIds).eq('is_active', true);
    const countMap: Record<string, number> = {};
    (students || []).forEach((s: any) => { countMap[s.class_id] = (countMap[s.class_id] || 0) + 1; });

    // Load class teachers
    const teacherIds = data.filter(c => c.class_teacher_id).map(c => c.class_teacher_id);
    let teacherMap: Record<string, any> = {};
    if (teacherIds.length) {
      const { data: teachers } = await supabase.from('faculty').select('id, first_name, last_name').in('id', teacherIds);
      (teachers || []).forEach((t: any) => { teacherMap[t.id] = t; });
    }

    const acYear = academicYears.find(y => y.id === selYear);
    const configs: ClassConfig[] = data.map(c => ({
      ...c,
      stream: c.stream || '',
      division: c.division || '',
      room_number: c.room_number || '',
      studentCount: countMap[c.id] || 0,
      class_teacher: c.class_teacher_id ? teacherMap[c.class_teacher_id] || null : null,
    }));

    setClasses(configs);

    // Initialize edit map with current values or academic year defaults
    const map: Record<string, { start: string; end: string }> = {};
    configs.forEach(c => {
      map[c.id] = {
        start: c.classes_start_date || acYear?.start_date || '',
        end: c.classes_end_date || acYear?.end_date || '',
      };
    });
    setEditMap(map);
    setHasChanges(false);
  };

  const updateField = (classId: string, field: 'start' | 'end', value: string) => {
    setEditMap(prev => ({ ...prev, [classId]: { ...prev[classId], [field]: value } }));
    setHasChanges(true);
  };

  const saveClass = async (classId: string) => {
    setSaving(classId);
    const vals = editMap[classId];
    if (!vals) { setSaving(null); return; }
    const { error } = await supabase.from('classes').update({
      classes_start_date: vals.start || null,
      classes_end_date: vals.end || null,
    }).eq('id', classId);
    if (error) alert('Error: ' + error.message);
    else {
      // Update local state
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, classes_start_date: vals.start, classes_end_date: vals.end } : c));
    }
    setSaving(null);
  };

  const saveAll = async () => {
    setSaving('all');
    let errors = 0;
    for (const cls of classes) {
      const vals = editMap[cls.id];
      if (!vals) continue;
      if (vals.start !== (cls.classes_start_date || '') || vals.end !== (cls.classes_end_date || '')) {
        const { error } = await supabase.from('classes').update({
          classes_start_date: vals.start || null,
          classes_end_date: vals.end || null,
        }).eq('id', cls.id);
        if (error) errors++;
      }
    }
    if (errors) alert(`${errors} classes failed to update`);
    else {
      await loadClasses();
      alert('All classes updated successfully!');
    }
    setSaving(null);
    setHasChanges(false);
  };

  const applyBulk = () => {
    if (!bulkGrade) { alert('Select a grade first'); return; }
    const updated = { ...editMap };
    let count = 0;
    classes.forEach(c => {
      if (c.grade === bulkGrade || bulkGrade === '__all__') {
        if (bulkStart) updated[c.id] = { ...updated[c.id], start: bulkStart };
        if (bulkEnd) updated[c.id] = { ...updated[c.id], end: bulkEnd };
        count++;
      }
    });
    setEditMap(updated);
    setHasChanges(true);
    alert(`Applied to ${count} class(es). Click "Save All Changes" to persist.`);
  };

  // Get unique grades for bulk
  const uniqueGrades = [...new Set(classes.map(c => c.grade))].sort();

  const calcWorkingDays = (start: string, end: string) => {
    if (!start || !end) return '—';
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    if (e < s) return '—';
    // Note: This is an estimate (excludes holidays but doesn't query them)
    let count = 0;
    const d = new Date(s);
    while (d <= e) {
      if (!(formOffDays || [0]).includes(d.getDay())) count++;
      d.setDate(d.getDate() + 1);
    }
    return `~${count}`;
  };

  // Get institution's weekly off days for estimate
  const [formOffDays, setFormOffDays] = useState<number[]>([0]);
  useEffect(() => {
    if (!user?.institution_id) return;
    supabase.from('institutions').select('weekly_off_days').eq('id', user.institution_id).single()
      .then(({ data }) => { if (data?.weekly_off_days) setFormOffDays(data.weekly_off_days); });
  }, [user]);

  const acYear = academicYears.find(y => y.id === selYear);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-500">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center gap-4">
          <button onClick={() => router.push('/super-admin')} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Class Configuration</h1>
            <p className="text-sm text-slate-500">Set class-wise start/end dates for accurate working days calculation</p>
          </div>
          {hasChanges && (
            <button onClick={saveAll} disabled={saving === 'all'}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-60">
              {saving === 'all' ? '💾 Saving...' : '💾 Save All Changes'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Academic Year Filter */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name || y.year_name}</option>)}
              </select>
            </div>
            {acYear && (
              <div className="md:col-span-2">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  <strong>Academic Year:</strong> {acYear.start_date} to {acYear.end_date}.
                  Each class can have its own start/end date within this range.
                  Reports will use <strong>class-specific dates</strong> for working days calculations.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Update Section */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 mb-6">
          <h3 className="text-sm font-bold text-amber-800 mb-3" style={{ fontFamily: 'var(--font-display)' }}>⚡ Bulk Update Dates</h3>
          <p className="text-xs text-amber-600 mb-3">Apply start/end dates to all classes of a grade at once. E.g., set all XII classes to start June 15.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">Grade</label>
              <select value={bulkGrade} onChange={e => setBulkGrade(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm">
                <option value="">Select grade...</option>
                <option value="__all__">— All Grades —</option>
                {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">Start Date</label>
              <input type="date" value={bulkStart} onChange={e => setBulkStart(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">End Date</label>
              <input type="date" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm" />
            </div>
            <button onClick={applyBulk}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors">
              Apply to {bulkGrade === '__all__' ? 'All' : bulkGrade || '...'} Classes
            </button>
          </div>
        </div>

        {/* Classes Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Classes ({classes.length})</h2>
              <p className="text-xs text-slate-500 mt-0.5">Set individual start and end dates for each class</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-medium">
                {classes.filter(c => editMap[c.id]?.start).length} with dates
              </span>
              <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg font-medium">
                {classes.filter(c => !editMap[c.id]?.start).length} missing
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase">Class</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase">Grade</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase">Students</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase">Class Teacher</th>
                  <th className="px-4 py-3 text-left font-bold text-emerald-600 text-xs uppercase">Start Date</th>
                  <th className="px-4 py-3 text-left font-bold text-red-600 text-xs uppercase">End Date</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase">Est. Days</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No classes found for this academic year</td></tr>
                ) : classes.map((cls, idx) => {
                  const vals = editMap[cls.id] || { start: '', end: '' };
                  const isChanged = vals.start !== (cls.classes_start_date || '') || vals.end !== (cls.classes_end_date || '');
                  return (
                    <tr key={cls.id} className={`border-b border-slate-100 ${isChanged ? 'bg-amber-50/50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">{cls.name}</span>
                        {cls.room_number && <span className="ml-2 text-xs text-slate-400">Room {cls.room_number}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{cls.grade}</span>
                        {cls.stream && <span className="ml-1 text-xs text-slate-500">{cls.stream}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono font-bold text-slate-700">{cls.studentCount}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {cls.class_teacher ? `${cls.class_teacher.first_name} ${cls.class_teacher.last_name}` : <span className="text-slate-300">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <input type="date" value={vals.start}
                          onChange={e => updateField(cls.id, 'start', e.target.value)}
                          className={`px-2 py-1.5 border rounded-lg text-sm w-36 ${isChanged ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'}`} />
                      </td>
                      <td className="px-4 py-3">
                        <input type="date" value={vals.end}
                          onChange={e => updateField(cls.id, 'end', e.target.value)}
                          className={`px-2 py-1.5 border rounded-lg text-sm w-36 ${isChanged ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'}`} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-xs text-slate-500">{calcWorkingDays(vals.start, vals.end)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isChanged && (
                          <button onClick={() => saveClass(cls.id)} disabled={saving === cls.id}
                            className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                            {saving === cls.id ? '...' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-slate-100 rounded-2xl p-5 text-xs text-slate-600">
          <h4 className="font-bold text-slate-700 mb-2">How class dates affect reports:</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>Low Attendance (Cumulative):</strong> Working days counted from class start date instead of academic year start</li>
            <li><strong>Monthly Cumulative:</strong> Previous months&apos; working days use class start date as the beginning</li>
            <li><strong>Daily Summary:</strong> Shows if the selected date is before a class started</li>
            <li>If no class date is set, the academic year start/end date is used as fallback</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
