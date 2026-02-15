'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Save, BookOpen, Clock, ArrowLeft } from 'lucide-react';

interface Student {
  id: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  attendance_status?: 'present' | 'absent';
  is_late?: boolean;
}

export default function LectureAttendancePage() {
  const [user, setUser] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [periods, setPeriods] = useState<any[]>([]); // Database periods
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [isExtraPeriod, setIsExtraPeriod] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  // Period timing mappings (built from database periods)
  const periodTimings: { [key: string]: { from: string; to: string } } = {};
  periods.forEach(p => {
    periodTimings[p.period_code] = { from: p.time_from, to: p.time_to };
  });

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadPeriods();
      loadFacultyAssignments();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClass && allAssignments.length > 0) {
      // Filter assignments by selected class
      const filtered = allAssignments.filter(a => a.classes?.id === selectedClass);
      setAssignments(filtered);
      setSelectedAssignment(''); // Reset subject selection when class changes
    }
  }, [selectedClass, allAssignments]);

  useEffect(() => {
    if (selectedAssignment && selectedDate) {
      loadStudents();
    }
  }, [selectedAssignment, selectedDate]);

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

    if (!userData) {
      router.push('/login');
      return;
    }

    // Get faculty record
    const { data: facultyData } = await supabase
      .from('faculty')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    setUser({ ...userData, faculty: facultyData });
  };

  const loadPeriods = async () => {
    const { data, error } = await supabase
      .from('periods')
      .select('*')
      .eq('institution_id', user.institution_id)
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      console.error('Error loading periods:', error);
      return;
    }

    setPeriods(data || []);
  };

  const loadFacultyAssignments = async () => {
    if (!user?.faculty?.id) {
      console.log('No faculty data found');
      return;
    }

    console.log('Loading assignments for faculty:', user.faculty.id);
    
    // First, load the faculty_subjects records
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('faculty_subjects')
      .select('id, faculty_id, subject_id, class_id, batch_name, academic_year_id, is_active')
      .eq('faculty_id', user.faculty.id)
      .eq('is_active', true);
    
    if (assignmentError) {
      console.error('Error loading assignments:', assignmentError);
      return;
    }

    if (!assignmentData || assignmentData.length === 0) {
      console.log('No assignments found');
      setAllAssignments([]);
      setClasses([]);
      return;
    }

    // Now manually fetch subject, class, and academic year data for each assignment
    const enrichedAssignments = await Promise.all(
      assignmentData.map(async (assignment) => {
        // Fetch subject
        const { data: subject } = await supabase
          .from('subjects')
          .select('id, code, name, has_batches')
          .eq('id', assignment.subject_id)
          .single();

        // Fetch class
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('id', assignment.class_id)
          .single();

        // Fetch academic year
        const { data: academicYear } = await supabase
          .from('academic_years')
          .select('id, name, is_current')
          .eq('id', assignment.academic_year_id)
          .single();

        return {
          ...assignment,
          subjects: subject,
          classes: classData,
          academic_years: academicYear
        };
      })
    );
    
    // Filter to current academic year
    const filtered = enrichedAssignments.filter(a => a.academic_years?.is_current);
    setAllAssignments(filtered);
    
    // Extract unique classes
    const uniqueClasses = filtered
      .map(a => a.classes)
      .filter((c, index, self) => c && self.findIndex(t => t?.id === c?.id) === index);
    
    setClasses(uniqueClasses);
    console.log('Assignments loaded:', filtered.length, 'Classes:', uniqueClasses.length);
  };

  const loadStudents = async () => {
    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;

    // Load students enrolled in this subject
    const { data: enrolledStudents } = await supabase
      .from('student_subjects')
      .select(`
        student_id,
        batch_name,
        students(id, roll_number, first_name, last_name, class_id)
      `)
      .eq('subject_id', assignment.subjects.id)
      .eq('class_id', assignment.classes.id)
      .eq('is_active', true);

    // Filter by batch if applicable
    let filtered = enrolledStudents || [];
    if (assignment.batch_name) {
      filtered = filtered.filter(e => e.batch_name === assignment.batch_name);
    }

    // Sort by roll number
    const sorted = filtered
      .map(e => e.students)
      .flat()
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const rollA = parseInt(a.roll_number) || 0;
        const rollB = parseInt(b.roll_number) || 0;
        return rollA - rollB;
      });

    setStudents(sorted as any);
  };

  const togglePeriod = (period: string) => {
    let newPeriods: string[];
    if (selectedPeriods.includes(period)) {
      newPeriods = selectedPeriods.filter(p => p !== period);
    } else {
      newPeriods = [...selectedPeriods, period].sort();
    }
    setSelectedPeriods(newPeriods);
    
    // Auto-fill times based on selected periods
    if (newPeriods.length > 0 && !isExtraPeriod) {
      const firstPeriod = newPeriods[0];
      const lastPeriod = newPeriods[newPeriods.length - 1];
      
      if (periodTimings[firstPeriod] && periodTimings[lastPeriod]) {
        setTimeFrom(periodTimings[firstPeriod].from);
        setTimeTo(periodTimings[lastPeriod].to);
      }
    }
  };

  const handleExtraPeriod = () => {
    setIsExtraPeriod(true);
    setSelectedPeriods([]);
    setTimeFrom('');
    setTimeTo('');
  };

  const handleRegularPeriods = () => {
    setIsExtraPeriod(false);
    setSelectedPeriods([]);
    setTimeFrom('');
    setTimeTo('');
  };

  const markAttendance = (studentId: string, status: 'present' | 'absent') => {
    setStudents(students.map(s => 
      s.id === studentId ? { ...s, attendance_status: status, is_late: status === 'absent' ? false : s.is_late } : s
    ));
  };

  const toggleLate = (studentId: string) => {
    setStudents(students.map(s => 
      s.id === studentId ? { ...s, is_late: !s.is_late } : s
    ));
  };

  const markAllPresent = () => {
    setStudents(students.map(s => ({ ...s, attendance_status: 'present' as const })));
  };

  const markAllAbsent = () => {
    setStudents(students.map(s => ({ ...s, attendance_status: 'absent' as const, is_late: false })));
  };

  const handleSave = async () => {
    // Validation
    if (isExtraPeriod) {
      if (!timeFrom || !timeTo) {
        alert('Please enter time range for extra period');
        return;
      }
    } else {
      if (selectedPeriods.length === 0) {
        alert('Please select at least one period');
        return;
      }
    }

    if (!selectedAssignment) {
      alert('Please select a subject');
      return;
    }

    setSaving(true);
    try {
      const assignment = assignments.find(a => a.id === selectedAssignment);
      
      // Create lecture session
      const { data: session, error: sessionError } = await supabase
        .from('lecture_sessions')
        .insert({
          institution_id: user.institution_id,
          academic_year_id: assignment.academic_years.id,
          date: selectedDate,
          class_id: assignment.classes.id,
          subject_id: assignment.subjects.id,
          faculty_id: user.faculty.id,
          period_from: isExtraPeriod ? 'EXTRA' : selectedPeriods[0],
          period_to: isExtraPeriod ? null : (selectedPeriods.length > 1 ? selectedPeriods[selectedPeriods.length - 1] : null),
          time_from: timeFrom,
          time_to: timeTo,
          batch_name: assignment.batch_name,
          session_type: isExtraPeriod ? 'extra' : 'regular',
          created_by: user.id
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Save attendance for each student
      const attendanceRecords = students
        .filter(s => s.attendance_status)
        .map(s => ({
          lecture_session_id: session.id,
          student_id: s.id,
          status: s.attendance_status,
          is_late: s.is_late || false,
          marked_by: user.id
        }));

      if (attendanceRecords.length > 0) {
        const { error: attendanceError } = await supabase
          .from('lecture_attendance')
          .insert(attendanceRecords);

        if (attendanceError) throw attendanceError;
      }

      alert(`Successfully saved attendance for ${attendanceRecords.length} students!`);
      
      // Reset form
      setSelectedPeriods([]);
      setTimeFrom('');
      setTimeTo('');
      setStudents(students.map(s => ({ ...s, attendance_status: undefined, is_late: false })));
      
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error saving attendance: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const assignment = assignments.find(a => a.id === selectedAssignment);
  const stats = {
    total: students.length,
    present: students.filter(s => s.attendance_status === 'present').length,
    absent: students.filter(s => s.attendance_status === 'absent').length,
    late: students.filter(s => s.is_late).length,
    unmarked: students.filter(s => !s.attendance_status).length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/faculty/dashboard')}
                className="mr-4 p-2 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Mark Lecture Attendance</h1>
                <p className="mt-1 text-sm text-gray-500">Record attendance for your lectures</p>
              </div>
            </div>
            {stats.total > 0 && (
              <button
                onClick={handleSave}
                disabled={saving || stats.unmarked === stats.total}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-sm text-gray-500 mt-1">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class/Division *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Subject *</label>
              <select
                value={selectedAssignment}
                onChange={(e) => setSelectedAssignment(e.target.value)}
                disabled={!selectedClass}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select Subject</option>
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.subjects.name}
                    {a.batch_name && ` (${a.batch_name})`}
                  </option>
                ))}
              </select>
            </div>

            {selectedAssignment && (
              <>
                <div className="col-span-3">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="block text-sm font-medium text-gray-700">Period Type:</label>
                    <button
                      onClick={handleRegularPeriods}
                      className={`px-4 py-2 rounded-md border-2 ${
                        !isExtraPeriod
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-600'
                      }`}
                    >
                      Regular Periods
                    </button>
                    <button
                      onClick={handleExtraPeriod}
                      className={`px-4 py-2 rounded-md border-2 ${
                        isExtraPeriod
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-600'
                      }`}
                    >
                      Extra Period
                    </button>
                  </div>

                  {!isExtraPeriod && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Periods * (Click multiple)
                      </label>
                      {periods.length === 0 ? (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                          <p className="text-sm text-yellow-700">
                            <strong>No periods configured!</strong> Please ask your administrator to configure periods in the Period Configuration page.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {periods.map(p => (
                              <button
                                key={p.id}
                                onClick={() => togglePeriod(p.period_code)}
                                className={`px-4 py-2 rounded-md border-2 transition-all ${
                                  selectedPeriods.includes(p.period_code)
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-600'
                                }`}
                                title={`${p.time_from} - ${p.time_to}`}
                              >
                                {p.period_name}
                              </button>
                            ))}
                          </div>
                          {selectedPeriods.length > 0 && (
                            <p className="text-sm text-green-600 mt-2 font-medium">
                              Selected: {selectedPeriods.length === 1 ? periods.find(p => p.period_code === selectedPeriods[0])?.period_name : `${periods.find(p => p.period_code === selectedPeriods[0])?.period_name} - ${periods.find(p => p.period_code === selectedPeriods[selectedPeriods.length - 1])?.period_name}`}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {isExtraPeriod && (
                    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                      <p className="text-sm text-orange-700">
                        <strong>Extra Period Mode:</strong> Enter custom time range below
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Range * {!isExtraPeriod && '(Auto-filled from periods)'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={timeFrom}
                      onChange={(e) => setTimeFrom(e.target.value)}
                      placeholder="From"
                      readOnly={!isExtraPeriod && periods.length > 0}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md ${
                        !isExtraPeriod && periods.length > 0 ? 'bg-gray-50' : ''
                      }`}
                    />
                    <input
                      type="time"
                      value={timeTo}
                      onChange={(e) => setTimeTo(e.target.value)}
                      placeholder="To"
                      readOnly={!isExtraPeriod && periods.length > 0}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md ${
                        !isExtraPeriod && periods.length > 0 ? 'bg-gray-50' : ''
                      }`}
                    />
                  </div>
                  {timeFrom && timeTo && (
                    <p className="text-sm text-gray-600 mt-1">
                      Duration: {(() => {
                        const from = new Date(`2000-01-01T${timeFrom}`);
                        const to = new Date(`2000-01-01T${timeTo}`);
                        const diff = (to.getTime() - from.getTime()) / 60000;
                        return `${diff} minutes`;
                      })()}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Session Info */}
        {students.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 mb-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-indigo-200 text-sm">Subject</p>
                <p className="text-xl font-bold">
                  {assignments.find(a => a.id === selectedAssignment)?.subjects.name}
                </p>
              </div>
              <div>
                <p className="text-indigo-200 text-sm">Class</p>
                <p className="text-xl font-bold">
                  {assignments.find(a => a.id === selectedAssignment)?.classes.name}
                </p>
              </div>
              <div>
                <p className="text-indigo-200 text-sm">Period(s)</p>
                <p className="text-xl font-bold">
                  {isExtraPeriod ? (
                    <span className="bg-orange-500 px-3 py-1 rounded-md">EXTRA</span>
                  ) : selectedPeriods.length === 1 ? (
                    periods.find(p => p.period_code === selectedPeriods[0])?.period_name || selectedPeriods[0]
                  ) : selectedPeriods.length > 1 ? (
                    `${periods.find(p => p.period_code === selectedPeriods[0])?.period_name || selectedPeriods[0]} - ${periods.find(p => p.period_code === selectedPeriods[selectedPeriods.length - 1])?.period_name || selectedPeriods[selectedPeriods.length - 1]}`
                  ) : (
                    'Not selected'
                  )}
                </p>
              </div>
              <div>
                <p className="text-indigo-200 text-sm">Time</p>
                <p className="text-xl font-bold">
                  {timeFrom && timeTo ? `${timeFrom} - ${timeTo}` : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {students.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Present</p>
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Absent</p>
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Late</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Unmarked</p>
              <p className="text-2xl font-bold text-gray-400">{stats.unmarked}</p>
            </div>
          </div>
        )}

        {/* Students */}
        {students.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                {assignment?.subjects.name} - {assignment?.classes.name}
                {assignment?.batch_name && ` (${assignment.batch_name})`}
              </h2>
              <div className="space-x-2">
                <button onClick={markAllPresent} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                  Mark All Present
                </button>
                <button onClick={markAllAbsent} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                  Mark All Absent
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Late</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map(student => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{student.roll_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{student.first_name} {student.last_name}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => markAttendance(student.id, 'present')}
                            className={`px-4 py-2 rounded-md ${
                              student.attendance_status === 'present'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => markAttendance(student.id, 'absent')}
                            className={`px-4 py-2 rounded-md ${
                              student.attendance_status === 'absent'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={student.is_late || false}
                          onChange={() => toggleLate(student.id)}
                          disabled={student.attendance_status !== 'present'}
                          className="h-5 w-5 text-yellow-600 rounded disabled:opacity-50"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
