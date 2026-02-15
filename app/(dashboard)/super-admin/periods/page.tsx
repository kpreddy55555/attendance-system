'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Clock, Plus, Edit2, Trash2, Save, X, ArrowLeft, AlertCircle } from 'lucide-react';

interface Period {
  id?: string;
  institution_id: string;
  period_code: string;
  period_name: string;
  time_from: string;
  time_to: string;
  display_order: number;
  is_active: boolean;
  isNew?: boolean;
}

export default function PeriodsManagementPage() {
  const [user, setUser] = useState<any>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.institution_id) {
      loadPeriods();
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (userError) {
        console.error('Error loading user:', userError);
        setError('Failed to load user data. Please re-login.');
        setLoading(false);
        return;
      }

      if (userData?.role !== 'super_admin') {
        router.push('/login');
        return;
      }

      setUser(userData);
    } catch (err) {
      console.error('Auth error:', err);
      setLoading(false);
    }
  };

  const loadPeriods = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('periods')
        .select('*')
        .eq('institution_id', user.institution_id)
        .order('display_order');

      if (fetchError) {
        console.error('Error loading periods:', fetchError);
        
        // Check if table doesn't exist
        if (fetchError.message?.includes('relation') || fetchError.code === '42P01') {
          setError(
            'The "periods" table does not exist in your database. Please run the migration SQL from database/migration-periods-fix.sql in your Supabase SQL Editor.'
          );
        } else if (fetchError.message?.includes('permission') || fetchError.code === '42501') {
          setError(
            'Permission denied. RLS policies may not be set up for the periods table. Please run the migration SQL from database/migration-periods-fix.sql in your Supabase SQL Editor.'
          );
        } else {
          setError(`Error loading periods: ${fetchError.message}`);
        }
        
        setPeriods([]);
        return;
      }

      setPeriods(data || []);
    } catch (err: any) {
      console.error('Error:', err);
      setError('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addNewPeriod = () => {
    const maxOrder = periods.length > 0 ? Math.max(...periods.map(p => p.display_order)) : 0;
    const newPeriod: Period = {
      institution_id: user.institution_id,
      period_code: '',
      period_name: '',
      time_from: '',
      time_to: '',
      display_order: maxOrder + 1,
      is_active: true,
      isNew: true
    };
    setPeriods([...periods, newPeriod]);
    setIsAddingNew(true);
    setEditingId(null); // Clear any other editing
  };

  const updatePeriod = (index: number, field: string, value: any) => {
    const newPeriods = [...periods];
    newPeriods[index] = { ...newPeriods[index], [field]: value };
    setPeriods(newPeriods);
  };

  const savePeriod = async (period: Period, index: number) => {
    // Validation
    if (!period.period_code.trim()) {
      alert('Period code is required');
      return;
    }
    if (!period.period_name.trim()) {
      alert('Period name is required');
      return;
    }
    if (!period.time_from || !period.time_to) {
      alert('Time from and time to are required');
      return;
    }

    setSaving(true);
    try {
      if (period.isNew) {
        const { data, error } = await supabase
          .from('periods')
          .insert({
            institution_id: period.institution_id,
            period_code: period.period_code.trim(),
            period_name: period.period_name.trim(),
            time_from: period.time_from,
            time_to: period.time_to,
            display_order: period.display_order,
            is_active: period.is_active
          })
          .select()
          .single();

        if (error) {
          if (error.message?.includes('duplicate') || error.code === '23505') {
            alert(`Period code "${period.period_code}" already exists. Please use a different code.`);
          } else if (error.message?.includes('permission') || error.code === '42501') {
            alert('Permission denied. Please run the migration SQL to fix RLS policies.');
          } else {
            alert('Error: ' + error.message);
          }
          return;
        }

        alert('Period added successfully!');
        setIsAddingNew(false);
      } else {
        const { error } = await supabase
          .from('periods')
          .update({
            period_code: period.period_code.trim(),
            period_name: period.period_name.trim(),
            time_from: period.time_from,
            time_to: period.time_to,
            display_order: period.display_order,
            is_active: period.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', period.id);

        if (error) throw error;
        
        alert('Period updated successfully!');
        setEditingId(null);
      }

      await loadPeriods();
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePeriod = async (period: Period, index: number) => {
    if (!confirm(`Delete "${period.period_name}"? This cannot be undone.`)) return;

    setSaving(true);
    try {
      if (period.id) {
        const { error } = await supabase
          .from('periods')
          .delete()
          .eq('id', period.id);

        if (error) throw error;
      }

      await loadPeriods();
      alert('Period deleted successfully!');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = (index: number) => {
    if (periods[index].isNew) {
      setPeriods(periods.filter((_, i) => i !== index));
      setIsAddingNew(false);
    }
    setEditingId(null);
  };

  // Format time for display
  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/super-admin')}
                className="mr-4 p-2 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Period Configuration</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Configure period timings for your institution
                </p>
              </div>
            </div>
            <button
              onClick={addNewPeriod}
              disabled={isAddingNew}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Period
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Card */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> These periods will be used in the lecture attendance system. 
                Configure your institution&apos;s daily schedule here. Faculty members will see these periods when marking attendance.
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={loadPeriods}
                  className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                >
                  Retry Loading
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-lg text-gray-500">Loading periods...</div>
          </div>
        ) : (
          /* Periods Table */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Period Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Period Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Display Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {periods.length === 0 && !isAddingNew ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No periods configured. Click &quot;Add Period&quot; to start.
                    </td>
                  </tr>
                ) : (
                  periods.map((period, index) => {
                    // FIX: Only mark as editing if it's the specific period being edited or if it's the new row
                    const isEditing = period.isNew 
                      ? isAddingNew 
                      : editingId === period.id;
                    
                    return (
                      <tr key={period.id || `new-${index}`} className={isEditing ? 'bg-yellow-50' : ''}>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={period.period_code}
                              onChange={(e) => updatePeriod(index, 'period_code', e.target.value.toUpperCase())}
                              placeholder="A, B, 1, 2..."
                              className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              autoFocus={period.isNew}
                            />
                          ) : (
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                              {period.period_code}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={period.period_name}
                              onChange={(e) => updatePeriod(index, 'period_name', e.target.value)}
                              placeholder="Period A, Period 1..."
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          ) : (
                            <span className="font-medium">{period.period_name}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="time"
                              value={period.time_from}
                              onChange={(e) => updatePeriod(index, 'time_from', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          ) : (
                            <span>{formatTime(period.time_from)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="time"
                              value={period.time_to}
                              onChange={(e) => updatePeriod(index, 'time_to', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          ) : (
                            <span>{formatTime(period.time_to)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="number"
                              value={period.display_order}
                              onChange={(e) => updatePeriod(index, 'display_order', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          ) : (
                            <span className="text-gray-600">{period.display_order}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <select
                              value={period.is_active.toString()}
                              onChange={(e) => updatePeriod(index, 'is_active', e.target.value === 'true')}
                              className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="true">Active</option>
                              <option value="false">Inactive</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              period.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {period.is_active ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => savePeriod(period, index)}
                                disabled={saving}
                                className="inline-flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </button>
                              <button
                                onClick={() => cancelEdit(index)}
                                disabled={saving}
                                className="inline-flex items-center px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingId(period.id || null)}
                                disabled={isAddingNew}
                                className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Edit2 className="w-4 h-4 mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => deletePeriod(period, index)}
                                disabled={isAddingNew}
                                className="inline-flex items-center px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sample Periods Help */}
        {!loading && periods.length === 0 && !error && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Suggested Period Configuration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-indigo-600">A</span> — Period A (7:45 - 8:30)
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-indigo-600">B</span> — Period B (8:30 - 9:15)
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-indigo-600">C</span> — Period C (9:15 - 10:00)
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-indigo-600">1</span> — Period 1 (10:15 - 11:00)
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-indigo-600">2</span> — Period 2 (11:00 - 11:45)
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-indigo-600">3</span> — Period 3 (11:45 - 12:30)
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-indigo-600">4</span> — Period 4 (12:30 - 1:15)
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-indigo-600">5-8</span> — Periods 5-8 (afternoon)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
