'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Users, Save, ArrowLeft } from 'lucide-react';

export default function ClassTeachersPage() {
  const [user, setUser] = useState<any>(null);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<{ [key: string]: string }>({});
  
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [saving, setSaving] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadInstitutions();
    }
  }, [user]);

  useEffect(() => {
    if (selectedInstitution) {
      loadAcademicYears();
      loadFaculty();
    }
  }, [selectedInstitution]);

  useEffect(() => {
    if (selectedInstitution && selectedYear) {
      loadClasses();
    }
  }, [selectedInstitution, selectedYear]);

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userData?.role !== 'super_admin') {
      router.push('/login');
      return;
    }

    setUser(userData);
  };

  const loadInstitutions = async () => {
    const { data } = await supabase
      .from('institutions')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    setInstitutions(data || []);
    if (data && data.length > 0) {
      setSelectedInstitution(user.institution_id || data[0].id);
    }
  };

  const loadAcademicYears = async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('*')
      .eq('institution_id', selectedInstitution)
      .order('start_date', { ascending: false });
    
    setAcademicYears(data || []);
    if (data && data.length > 0) {
      const current = data.find(y => y.is_current) || data[0];
      setSelectedYear(current.id);
    }
  };

  const loadClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, class_teacher_id')
      .eq('institution_id', selectedInstitution)
      .eq('academic_year_id', selectedYear)
      .eq('is_active', true)
      .order('name');
    
    setClasses(data || []);
    
    // Build assignments object from existing data
    const assignmentsObj: { [key: string]: string } = {};
    (data || []).forEach(c => {
      if (c.class_teacher_id) {
        assignmentsObj[c.id] = c.class_teacher_id;
      }
    });
    setAssignments(assignmentsObj);
  };

  const loadFaculty = async () => {
    const { data } = await supabase
      .from('faculty')
      .select('*')
      .eq('institution_id', selectedInstitution)
      .eq('is_active', true)
      .order('first_name');
    
    setFaculty(data || []);
  };

  const updateAssignment = (classId: string, facultyId: string) => {
    setAssignments({
      ...assignments,
      [classId]: facultyId
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each class with its assigned class teacher
      for (const classItem of classes) {
        const { error } = await supabase
          .from('classes')
          .update({
            class_teacher_id: assignments[classItem.id] || null
          })
          .eq('id', classItem.id);
        
        if (error) throw error;
      }
      
      alert('Class teachers assigned successfully!');
      await loadClasses();
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
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
                <h1 className="text-3xl font-bold text-gray-900">Class Teacher Assignment</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Assign class teachers for each class
                </p>
              </div>
            </div>
            {classes.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : 'Save Assignments'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Institution</label>
              <select
                value={selectedInstitution}
                onChange={(e) => setSelectedInstitution(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {institutions.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.is_current && '(Current)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Class teachers will have access to view all lecture sessions 
                and period-wise attendance for their assigned class in the Daily Attendance page.
              </p>
            </div>
          </div>
        </div>

        {/* Assignments Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Class Teacher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    No classes found for this academic year
                  </td>
                </tr>
              ) : (
                classes.map((classItem) => {
                  const assignedFaculty = faculty.find(f => f.id === assignments[classItem.id]);
                  return (
                    <tr key={classItem.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Users className="w-5 h-5 text-gray-400 mr-3" />
                          <span className="font-medium text-gray-900">{classItem.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={assignments[classItem.id] || ''}
                          onChange={(e) => updateAssignment(classItem.id, e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">-- Select Class Teacher --</option>
                          {faculty.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.first_name} {f.last_name} ({f.employee_id})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        {assignments[classItem.id] ? (
                          <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                            Assigned
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                            Not Assigned
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {classes.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-500">Total Classes</p>
                <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Assigned</p>
                <p className="text-2xl font-bold text-green-600">
                  {Object.values(assignments).filter(v => v).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Not Assigned</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {classes.length - Object.values(assignments).filter(v => v).length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
