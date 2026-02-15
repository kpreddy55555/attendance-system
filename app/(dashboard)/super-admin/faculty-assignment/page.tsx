'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

export default function FacultyAssignmentPage() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadInstitutions();
    loadAcademicYears();
  }, []);

  useEffect(() => {
    if (selectedInstitution) {
      loadFaculty();
      loadClasses();
      loadSubjects();
    }
  }, [selectedInstitution]);

  useEffect(() => {
    if (selectedFaculty && selectedYear) {
      loadAssignments();
    }
  }, [selectedFaculty, selectedYear]);

  const loadInstitutions = async () => {
    const { data } = await supabase.from('institutions').select('*').eq('is_active', true);
    setInstitutions(data || []);
    if (data && data.length > 0) setSelectedInstitution(data[0].id);
  };

  const loadAcademicYears = async () => {
    const { data } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
    setAcademicYears(data || []);
    const current = data?.find(y => y.is_current);
    if (current) setSelectedYear(current.id);
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

  const loadClasses = async () => {
    console.log('Loading classes for institution:', selectedInstitution);
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('institution_id', selectedInstitution)
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error loading classes:', error);
    } else {
      console.log('Classes loaded:', data?.length, data);
      setClasses(data || []);
    }
  };

  const loadSubjects = async () => {
    console.log('Loading subjects for institution:', selectedInstitution);
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('institution_id', selectedInstitution)
      .eq('is_active', true)
      .order('code');
    
    if (error) {
      console.error('Error loading subjects:', error);
    } else {
      console.log('Subjects loaded:', data?.length, data);
      setSubjects(data || []);
    }
  };

  const loadAssignments = async () => {
    console.log('Loading assignments for faculty:', selectedFaculty, 'year:', selectedYear);
    
    // First, load the faculty_subjects records
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('faculty_subjects')
      .select('id, faculty_id, subject_id, class_id, batch_name, academic_year_id')
      .eq('faculty_id', selectedFaculty)
      .eq('academic_year_id', selectedYear);
    
    if (assignmentError) {
      console.error('Error loading assignments:', assignmentError);
      setAssignments([]);
      return;
    }

    if (!assignmentData || assignmentData.length === 0) {
      console.log('No assignments found');
      setAssignments([]);
      return;
    }

    // Now manually fetch subject and class data for each assignment
    const enrichedAssignments = await Promise.all(
      assignmentData.map(async (assignment) => {
        // Fetch subject
        const { data: subject } = await supabase
          .from('subjects')
          .select('id, code, name')
          .eq('id', assignment.subject_id)
          .single();

        // Fetch class
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('id', assignment.class_id)
          .single();

        return {
          ...assignment,
          subjects: subject,
          classes: classData
        };
      })
    );

    console.log('Assignments loaded:', enrichedAssignments.length, enrichedAssignments);
    setAssignments(enrichedAssignments);
  };

  const addAssignment = () => {
    setAssignments([...assignments, {
      id: `new-${Date.now()}`,
      faculty_id: selectedFaculty,
      subject_id: '',
      class_id: '',
      batch_name: '',
      academic_year_id: selectedYear,
      isNew: true
    }]);
  };

  const updateAssignment = (index: number, field: string, value: any) => {
    const newAssignments = [...assignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setAssignments(newAssignments);
  };

  const removeAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('faculty_subjects')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
      
      alert('Assignment deleted successfully!');
      await loadAssignments();
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error deleting: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only insert NEW assignments (ones with isNew flag)
      const newAssignmentsToSave = assignments
        .filter(a => a.isNew && a.subject_id && a.class_id)
        .map(a => ({
          faculty_id: selectedFaculty,
          subject_id: a.subject_id,
          class_id: a.class_id,
          academic_year_id: selectedYear,
          batch_name: a.batch_name || null,
          is_active: true
        }));
      
      if (newAssignmentsToSave.length > 0) {
        const { error } = await supabase.from('faculty_subjects').insert(newAssignmentsToSave);
        if (error) throw error;
      }
      
      alert(`Successfully saved ${newAssignmentsToSave.length} assignment(s)!`);
      await loadAssignments();
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

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
                <h1 className="text-3xl font-bold text-gray-900">Faculty-Subject Assignment</h1>
                <p className="mt-1 text-sm text-gray-500">Assign teachers to subjects and classes</p>
              </div>
            </div>
            {assignments.filter(a => a.isNew).length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : `Save ${assignments.filter(a => a.isNew).length} New Assignment(s)`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Institution</label>
              <select value={selectedInstitution} onChange={(e) => setSelectedInstitution(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty *</label>
              <select value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="">Select Faculty</option>
                {faculty.map(f => <option key={f.id} value={f.id}>{f.first_name} {f.last_name} ({f.employee_id})</option>)}
              </select>
            </div>
          </div>
        </div>

        {selectedFaculty && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Subject Assignments</h2>
              <button onClick={addAssignment} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                + Add Assignment
              </button>
            </div>

            <div className="p-6">
              {/* Saved Assignments - Display Mode */}
              {assignments.filter(a => !a.isNew).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Current Assignments</h3>
                  <div className="space-y-2">
                    {assignments.filter(a => !a.isNew).map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-md">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {assignment.subjects?.code} - {assignment.subjects?.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            Class: {assignment.classes?.name}
                            {assignment.batch_name && ` • Batch: ${assignment.batch_name}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(assignment.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Assignments - Edit Mode */}
              {assignments.filter(a => a.isNew).length === 0 ? (
                assignments.filter(a => !a.isNew).length === 0 && (
                  <p className="text-center text-gray-500 py-8">No assignments yet. Click "Add Assignment" to start.</p>
                )
              ) : (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">New Assignments</h3>
                  <div className="space-y-4">
                    {assignments.filter(a => a.isNew).map((assignment, index) => {
                      const actualIndex = assignments.indexOf(assignment);
                      return (
                        <div key={assignment.id} className="flex gap-4 items-end border-b pb-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                            <select
                              value={assignment.subject_id}
                              onChange={(e) => updateAssignment(actualIndex, 'subject_id', e.target.value)}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="">Select Subject</option>
                              {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                            <select
                              value={assignment.class_id}
                              onChange={(e) => updateAssignment(actualIndex, 'class_id', e.target.value)}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="">Select Class</option>
                              {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-48">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Batch (Optional)</label>
                            <input
                              type="text"
                              value={assignment.batch_name || ''}
                              onChange={(e) => updateAssignment(actualIndex, 'batch_name', e.target.value)}
                              placeholder="e.g., BATCH I"
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <button
                            onClick={() => removeAssignment(actualIndex)}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
