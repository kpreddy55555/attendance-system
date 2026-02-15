'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, Trash2, ArrowLeft, Upload } from 'lucide-react';

interface Holiday {
  id: string;
  date: string;
  name: string;
  holiday_type: string;
}

export default function HolidaysPage() {
  const [user, setUser] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [institution, setInstitution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('public');
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user) loadAcademicYears(); }, [user]);
  useEffect(() => { if (selectedYear) loadHolidays(); }, [selectedYear]);

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/login'); return; }
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (userData?.role !== 'super_admin') { router.push('/login'); return; }

    // If institution_id is missing, auto-detect from first institution
    let instId = userData.institution_id;
    if (!instId) {
      const { data: institutions } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
      if (institutions && institutions.length > 0) {
        instId = institutions[0].id;
        // Update user record so this doesn't happen again
        await supabase.from('users').update({ institution_id: instId }).eq('id', userData.id);
      }
    }
    setUser({ ...userData, institution_id: instId });
    // Load institution to get weekly_off_days
    if (instId) {
      const { data: inst } = await supabase.from('institutions').select('*').eq('id', instId).single();
      setInstitution(inst);
    }
  };

  const loadAcademicYears = async () => {
    if (!user?.institution_id) { setLoading(false); return; }
    const { data } = await supabase.from('academic_years').select('*')
      .eq('institution_id', user.institution_id).eq('is_active', true).order('start_date', { ascending: false });
    setAcademicYears(data || []);
    const current = data?.find(y => y.is_current) || data?.[0];
    if (current) setSelectedYear(current.id);
    setLoading(false);
  };

  const loadHolidays = async () => {
    if (!user?.institution_id) return;
    const year = academicYears.find(y => y.id === selectedYear);
    if (!year) return;
    const { data, error } = await supabase.from('holidays').select('*')
      .eq('institution_id', user.institution_id)
      .gte('date', year.start_date).lte('date', year.end_date)
      .order('date');
    if (error) { console.error(error); return; }
    setHolidays(data || []);
  };

  const addHoliday = async () => {
    if (!newDate || !newName) { alert('Date and name are required'); return; }
    if (!user?.institution_id) { alert('No institution found. Please configure your institution first.'); return; }
    setSaving(true);
    try {
      const endDate = newEndDate || newDate; // If no end date, single day
      const start = new Date(newDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      if (end < start) { alert('End date must be on or after start date'); setSaving(false); return; }

      const entries: any[] = [];
      const d = new Date(start);
      while (d <= end) {
        const ds = d.toISOString().split('T')[0];
        const entry: any = {
          institution_id: user.institution_id,
          date: ds, name: newName.trim(), holiday_type: newType
        };
        if (selectedYear) entry.academic_year_id = selectedYear;
        entries.push(entry);
        d.setDate(d.getDate() + 1);
      }

      // Upsert all days in the range
      const { error } = await supabase.from('holidays').upsert(entries, { onConflict: 'institution_id,date' });
      if (error) throw error;
      const msg = entries.length > 1 ? `Added ${entries.length} days (${newDate} to ${endDate})` : 'Holiday added';
      alert(msg);
      setNewDate(''); setNewEndDate(''); setNewName(''); setNewType('public'); setShowAdd(false);
      await loadHolidays();
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const deleteHoliday = async (id: string, name: string) => {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    await loadHolidays();
  };

  const addWeeklyOffDays = async () => {
    const year = academicYears.find(y => y.id === selectedYear);
    if (!year) { alert('Please select an academic year first.'); return; }
    if (!user?.institution_id) { alert('No institution found.'); return; }
    
    const offDays: number[] = Array.isArray(institution?.weekly_off_days) ? institution.weekly_off_days : [0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const offDayNames = offDays.map(d => dayNames[d]).join(', ');
    
    if (!confirm(`Add all ${offDayNames} for this academic year as holidays?`)) return;
    setSaving(true);
    try {
      const start = new Date(year.start_date);
      const end = new Date(year.end_date);
      const entries: any[] = [];
      const current = new Date(start);
      while (current <= end) {
        if (offDays.includes(current.getDay())) {
          const entry: any = {
            institution_id: user.institution_id,
            date: current.toISOString().split('T')[0],
            name: dayNames[current.getDay()],
            holiday_type: 'public'
          };
          if (selectedYear) entry.academic_year_id = selectedYear;
          entries.push(entry);
        }
        current.setDate(current.getDate() + 1);
      }
      // Upsert to avoid duplicates
      const { error } = await supabase.from('holidays').upsert(entries, { onConflict: 'institution_id,date' });
      if (error) throw error;
      alert(`Added ${entries.length} weekly off days (${offDayNames})`);
      await loadHolidays();
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  const filteredHolidays = selectedMonth
    ? holidays.filter(h => h.date.substring(0, 7) === selectedMonth)
    : holidays;

  // Get unique months from holidays
  const months = [...new Set(holidays.map(h => h.date.substring(0, 7)))].sort();

  const typeColors: Record<string, string> = {
    public: 'bg-red-100 text-red-800',
    institutional: 'bg-blue-100 text-blue-800',
    exam: 'bg-purple-100 text-purple-800',
    vacation: 'bg-green-100 text-green-800',
    other: 'bg-gray-100 text-gray-800',
    working_override: 'bg-emerald-100 text-emerald-800'
  };

  const typeLabels: Record<string, string> = {
    public: 'Holiday',
    institutional: 'Institutional',
    exam: 'Exam',
    vacation: 'Vacation',
    other: 'Other',
    working_override: '✅ Extra Working Day'
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div>Loading...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button onClick={() => router.push('/super-admin')} className="mr-4 p-2 rounded-md hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Holiday Management</h1>
                <p className="mt-1 text-sm text-gray-500">Configure holidays for attendance reports</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addWeeklyOffDays} disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 text-sm">
                <Calendar className="w-4 h-4 mr-2" /> Add Weekly Off Days
              </button>
              <button onClick={() => setShowAdd(!showAdd)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
                <Plus className="w-4 h-4 mr-2" /> Add Holiday
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Weekly Off Days Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Weekly Off Days: {(Array.isArray(institution?.weekly_off_days) ? institution.weekly_off_days : [0]).map((d: number) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(', ')}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Configure in Institution Settings. Use "Add Weekly Off Days" button to bulk-add them as holidays for the selected academic year.
              Use <strong>"✅ Extra Working Day"</strong> type to mark days when school worked despite being a weekly off or holiday.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Month</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="">All Months</option>
                {months.map(m => {
                  const d = new Date(m + '-01T00:00:00');
                  return <option key={m} value={m}>{d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>;
                })}
              </select>
            </div>
            <div className="flex items-end">
              <p className="text-sm text-gray-600">
                Total: <span className="font-bold text-indigo-600">{filteredHolidays.length}</span> holidays
                {selectedMonth && <span> in this month</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Add Holiday Form */}
        {showAdd && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Add New Holiday</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date <span className="text-gray-400">(optional)</span></label>
                <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)}
                  min={newDate} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Holiday Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Diwali Vacation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="public">Public Holiday</option>
                <option value="institutional">Institutional</option>
                <option value="exam">Exam</option>
                <option value="vacation">Vacation</option>
                <option value="other">Other</option>
                <option value="working_override">✅ Extra Working Day</option>
              </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">&nbsp;</label>
                <button onClick={addHoliday} disabled={saving}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium">
                  {saving ? 'Saving...' : newEndDate && newEndDate !== newDate ? `Save ${Math.ceil((new Date(newEndDate + 'T00:00:00').getTime() - new Date(newDate + 'T00:00:00').getTime()) / 86400000) + 1} Days` : 'Save'}
                </button>
              </div>
            </div>
            {newEndDate && newEndDate !== newDate && newDate && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                📅 This will add <strong>{Math.ceil((new Date(newEndDate + 'T00:00:00').getTime() - new Date(newDate + 'T00:00:00').getTime()) / 86400000) + 1} days</strong> from {newDate} to {newEndDate} as &ldquo;{newName || '...'}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Holidays List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Holiday Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredHolidays.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No holidays configured.</td></tr>
              ) : filteredHolidays.map(h => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium">{h.date}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}
                  </td>
                  <td className="px-6 py-3 text-sm">{h.name}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[h.holiday_type] || typeColors.other}`}>
                      {typeLabels[h.holiday_type] || h.holiday_type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => deleteHoliday(h.id, h.name)}
                      className="text-red-600 hover:text-red-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
