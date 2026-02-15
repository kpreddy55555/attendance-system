'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Users, BookOpen } from 'lucide-react';

interface Student {
  id: string;
  gr_number: string;
  first_name: string;
  last_name: string;
  roll_number: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  has_batches: boolean;
  batch_count: number;
  is_optional: boolean;
}

interface Enrollment {
  student_id: string;
  subject_id: string;
  batch_name: string | null;
  language_group: string | null;
}

export default function StudentEnrollmentPage() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  
  const [enrollments, setEnrollments] = useState<Map<string, Enrollment>>(new Map());
  const [existingEnrollments, setExistingEnrollments] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadInstitutions();
    loadAcademicYears();
  }, []);

  useEffect(() => {
    if (selectedInstitution) {
      loadClasses();
      loadSubjects();
    }
  }, [selectedInstitution]);

  useEffect(() => {
    if (selectedClass && selectedSubject && selectedYear) {
      loadStudents();
      loadExistingEnrollments();
    }
  }, [selectedClass, selectedSubject, selectedYear]);

  const loadInstitutions = async () => {
    const { data } = await supabase
      .from('institutions')
      .select('*')
      .eq('is_active', true);
    setInstitutions(data || []);
    if (data && data.length > 0) setSelectedInstitution(data[0].id);
  };

  const loadAcademicYears = async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('*')
      .order('start_date', { ascending: false });
    setAcademicYears(data || []);
    const current = data?.find(y => y.is_current);
    if (current) setSelectedYear(current.id);
  };

  const loadClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('institution_id', selectedInstitution)
      .eq('is_active', true)
      .order('name');
    setClasses(data || []);
  };

  const loadSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('*')
      .eq('institution_id', selectedInstitution)
      .eq('is_active', true)
      .order('code');
    setSubjects(data || []);
  };

  const loadStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, gr_number, first_name, last_name, roll_number')
      .eq('class_id', selectedClass)
      .eq('is_active', true)
      .order('roll_number', { ascending: true });
    
    // Sort numerically by roll number
    const sorted = (data || []).sort((a, b) => {
      const rollA = parseInt(a.roll_number) || 0;
      const rollB = parseInt(b.roll_number) || 0;
      return rollA - rollB;
    });
    
    setStudents(sorted);
  };

  const loadExistingEnrollments = async () => {
    const { data } = await supabase
      .from('student_subjects')
      .select('student_id, batch_name, language_group')
      .eq('subject_id', selectedSubject)
      .eq('academic_year_id', selectedYear);
    
    const enrolled = new Set<string>();
    const enrollmentMap = new Map<string, Enrollment>();
    
    (data || []).forEach(e => {
      enrolled.add(e.student_id);
      enrollmentMap.set(e.student_id, {
        student_id: e.student_id,
        subject_id: selectedSubject,
        batch_name: e.batch_name,
        language_group: e.language_group
      });
    });
    
    setExistingEnrollments(enrolled);
    setEnrollments(enrollmentMap);
  };

  const toggleEnrollment = (studentId: string) => {
    const newEnrollments = new Map(enrollments);
    
    if (newEnrollments.has(studentId)) {
      newEnrollments.delete(studentId);
    } else {
      newEnrollments.set(studentId, {
        student_id: studentId,
        subject_id: selectedSubject,
        batch_name: null,
        language_group: null
      });
    }
    
    setEnrollments(newEnrollments);
  };

  const updateBatch = (studentId: string, batchName: string) => {
    const newEnrollments = new Map(enrollments);
    const enrollment = newEnrollments.get(studentId);
    if (enrollment) {
      enrollment.batch_name = batchName;
      setEnrollments(newEnrollments);
    }
  };

  const updateLanguageGroup = (studentId: string, group: string) => {
    const newEnrollments = new Map(enrollments);
    const enrollment = newEnrollments.get(studentId);
    if (enrollment) {
      enrollment.language_group = group;
      setEnrollments(newEnrollments);
    }
  };

  const handleEnrollAll = () => {
    const newEnrollments = new Map<string, Enrollment>();
    students.forEach(student => {
      newEnrollments.set(student.id, {
        student_id: student.id,
        subject_id: selectedSubject,
        batch_name: null,
        language_group: null
      });
    });
    setEnrollments(newEnrollments);
  };

  const handleUnenrollAll = () => {
    setEnrollments(new Map());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing enrollments for this subject
      await supabase
        .from('student_subjects')
        .delete()
        .eq('subject_id', selectedSubject)
        .eq('academic_year_id', selectedYear);
      
      // Insert new enrollments
      const enrollmentData = Array.from(enrollments.values()).map(e => ({
        student_id: e.student_id,
        subject_id: selectedSubject,
        class_id: selectedClass,
        academic_year_id: selectedYear,
        batch_name: e.batch_name,
        language_group: e.language_group,
        is_active: true
      }));
      
      if (enrollmentData.length > 0) {
        const { error } = await supabase
          .from('student_subjects')
          .insert(enrollmentData);
        
        if (error) throw error;
      }
      
      alert(`Successfully enrolled ${enrollmentData.length} students!`);
      await loadExistingEnrollments();
    } catch (error: any) {
      console.error('Error saving enrollments:', error);
      alert('Error saving enrollments: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedSubjectData = subjects.find(s => s.id === selectedSubject);

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
                <h1 className="text-3xl font-bold text-gray-900">Student-Subject Enrollment</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Enroll students in subjects and assign batches
                </p>
              </div>
            </div>
            {enrollments.size > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : `Save ${enrollments.size} Enrollments`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Institution
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Academic Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class *
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select Class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select Subject</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                    {s.is_optional && ' (Optional)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Students List */}
        {selectedClass && selectedSubject && students.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  Enroll Students in {selectedSubjectData?.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {enrollments.size} of {students.length} students enrolled
                </p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={handleEnrollAll}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Enroll All
                </button>
                <button
                  onClick={handleUnenrollAll}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Unenroll All
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Enroll
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Roll No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      GR Number
                    </th>
                    {selectedSubjectData?.has_batches && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Batch
                      </th>
                    )}
                    {selectedSubjectData?.code === 'HIN' || selectedSubjectData?.code === 'TEL' ? (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Language Group
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map(student => {
                    const isEnrolled = enrollments.has(student.id);
                    const enrollment = enrollments.get(student.id);
                    
                    return (
                      <tr key={student.id} className={isEnrolled ? 'bg-green-50' : ''}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isEnrolled}
                            onChange={() => toggleEnrollment(student.id)}
                            className="h-4 w-4 text-green-600 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {student.roll_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {student.first_name} {student.last_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {student.gr_number}
                        </td>
                        {selectedSubjectData?.has_batches && (
                          <td className="px-6 py-4">
                            {isEnrolled && (
                              <select
                                value={enrollment?.batch_name || ''}
                                onChange={(e) => updateBatch(student.id, e.target.value)}
                                className="block w-32 px-2 py-1 text-sm border border-gray-300 rounded-md"
                              >
                                <option value="">No Batch</option>
                                {Array.from({ length: selectedSubjectData.batch_count }, (_, i) => (
                                  <option key={i} value={`BATCH ${['I', 'II', 'III'][i]}`}>
                                    BATCH {['I', 'II', 'III'][i]}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        )}
                        {(selectedSubjectData?.code === 'HIN' || selectedSubjectData?.code === 'TEL') && isEnrolled && (
                          <td className="px-6 py-4">
                            <select
                              value={enrollment?.language_group || ''}
                              onChange={(e) => updateLanguageGroup(student.id, e.target.value)}
                              className="block w-32 px-2 py-1 text-sm border border-gray-300 rounded-md"
                            >
                              <option value="">Select</option>
                              <option value="Group 1">Group 1</option>
                              <option value="Group 2">Group 2</option>
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedClass && selectedSubject && students.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No active students in this class
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
