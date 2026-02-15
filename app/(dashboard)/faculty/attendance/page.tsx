'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Calendar, Users, Save, ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, Info } from 'lucide-react';

interface Period {
  id: string;
  period_code: string;
  period_name: string;
  time_from: string;
  time_to: string;
  display_order: number;
}

interface LectureSession {
  id: string;
  period_from: string;
  period_to: string | null;
  session_type: string;
  batch_name: string | null;
  subject_name: string;
  subject_code: string;
  faculty_name: string;
}

interface StudentRow {
  id: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  period_attendance: { [periodCode: string]: { status: string; is_late: boolean; subject: string; faculty: string; session_id: string } };
  day_status: 'present' | 'absent' | 'late' | null;
  existing_day_record: boolean;
}

export default function ClassTeacherAttendancePage() {
  const [user, setUser] = useState<any>(null);
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessions, setSessions] = useState<LectureSession[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      // Super admin can access without faculty record
      if (user.role === 'super_admin' || user.faculty?.id) {
        loadMyClasses();
        loadPeriods();
      }
    }
  }, [user]);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      loadAttendanceGrid();
    }
  }, [selectedClass, selectedDate]);

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

    // Auto-detect institution_id for super_admin if missing
    let instId = userData.institution_id;
    if (!instId) {
      const { data: institutions } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
      if (institutions && institutions.length > 0) {
        instId = institutions[0].id;
        await supabase.from('users').update({ institution_id: instId }).eq('id', userData.id);
      }
    }

    // Faculty record (may not exist for super_admin)
    const { data: facultyData } = await supabase
      .from('faculty')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    setUser({ ...userData, institution_id: instId, faculty: facultyData });
  };

  const loadMyClasses = async () => {
    let query;
    if (user.role === 'super_admin' || user.role === 'institution_admin') {
      // Super admin / institution admin sees ALL classes
      if (!user.institution_id) { setLoading(false); return; }
      query = supabase.from('classes').select('id, name')
        .eq('institution_id', user.institution_id)
        .eq('is_active', true).order('name');
    } else {
      // Faculty only sees classes they are class teacher of
      if (!user.faculty?.id) { setLoading(false); return; }
      query = supabase.from('classes').select('id, name')
        .eq('class_teacher_id', user.faculty.id)
        .eq('is_active', true).order('name');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading classes:', error);
      setLoading(false);
      return;
    }

    setMyClasses(data || []);
    if (data && data.length > 0) {
      setSelectedClass(data[0].id);
    }
    setLoading(false);
  };

  const loadPeriods = async () => {
    if (!user?.institution_id) return;
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

  const loadAttendanceGrid = async () => {
    if (!selectedClass || !selectedDate) return;
    setLoadingGrid(true);

    try {
      // 1. Load all students in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, roll_number, first_name, last_name')
        .eq('class_id', selectedClass)
        .eq('is_active', true)
        .order('roll_number');

      if (studentsError) throw studentsError;

      const sortedStudents = (studentsData || []).sort((a, b) => {
        const rollA = parseInt(a.roll_number) || 0;
        const rollB = parseInt(b.roll_number) || 0;
        return rollA - rollB;
      });

      // 2. Load all lecture sessions for this class + date
      const { data: sessionData, error: sessionError } = await supabase
        .from('lecture_sessions')
        .select('id, period_from, period_to, session_type, batch_name, subject_id, faculty_id')
        .eq('class_id', selectedClass)
        .eq('date', selectedDate)
        .order('time_from');

      if (sessionError) throw sessionError;

      // 3. Enrich sessions with subject/faculty names
      const enrichedSessions: LectureSession[] = [];
      for (const session of (sessionData || [])) {
        const { data: subject } = await supabase
          .from('subjects')
          .select('name, code')
          .eq('id', session.subject_id)
          .single();

        // Get faculty name - try users table first via faculty record
        let facultyName = 'Faculty';
        const { data: facultyRecord } = await supabase
          .from('faculty')
          .select('user_id, employee_id')
          .eq('id', session.faculty_id)
          .single();

        if (facultyRecord?.user_id) {
          const { data: fUser } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', facultyRecord.user_id)
            .single();
          facultyName = fUser?.full_name || facultyRecord.employee_id || 'Faculty';
        } else if (facultyRecord?.employee_id) {
          facultyName = facultyRecord.employee_id;
        }

        enrichedSessions.push({
          id: session.id,
          period_from: session.period_from,
          period_to: session.period_to,
          session_type: session.session_type,
          batch_name: session.batch_name,
          subject_name: subject?.name || 'Unknown',
          subject_code: subject?.code || '?',
          faculty_name: facultyName
        });
      }

      setSessions(enrichedSessions);

      // 4. Load ALL lecture_attendance for these sessions
      const sessionIds = enrichedSessions.map(s => s.id);
      let allAttendance: any[] = [];

      if (sessionIds.length > 0) {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('lecture_attendance')
          .select('lecture_session_id, student_id, status, is_late')
          .in('lecture_session_id', sessionIds);

        if (attendanceError) throw attendanceError;
        allAttendance = attendanceData || [];
      }

      // 5. Load existing day attendance (class teacher's records)
      const { data: dayAttendance } = await supabase
        .from('attendance')
        .select('student_id, status, is_late')
        .eq('class_id', selectedClass)
        .eq('date', selectedDate);

      // Build attendance map: { sessionId: { studentId: { status, is_late } } }
      const attendanceMap: { [sessionId: string]: { [studentId: string]: { status: string; is_late: boolean } } } = {};
      allAttendance.forEach(a => {
        if (!attendanceMap[a.lecture_session_id]) {
          attendanceMap[a.lecture_session_id] = {};
        }
        attendanceMap[a.lecture_session_id][a.student_id] = {
          status: a.status,
          is_late: a.is_late
        };
      });

      // Build day attendance map
      const dayMap: { [studentId: string]: { status: string; is_late: boolean } } = {};
      (dayAttendance || []).forEach(a => {
        dayMap[a.student_id] = { status: a.status, is_late: a.is_late || false };
      });

      // 6. Build student rows with period-wise data
      const studentRows: StudentRow[] = sortedStudents.map(student => {
        const periodAttendance: StudentRow['period_attendance'] = {};

        enrichedSessions.forEach(session => {
          if (session.session_type === 'extra') return;

          const studentAttendance = attendanceMap[session.id]?.[student.id];
          if (!studentAttendance) return;

          const periodCodes = getSessionPeriodCodes(session);
          periodCodes.forEach(code => {
            periodAttendance[code] = {
              status: studentAttendance.status,
              is_late: studentAttendance.is_late,
              subject: session.subject_code,
              faculty: session.faculty_name,
              session_id: session.id
            };
          });
        });

        const dayRecord = dayMap[student.id];

        return {
          id: student.id,
          roll_number: student.roll_number,
          first_name: student.first_name,
          last_name: student.last_name,
          period_attendance: periodAttendance,
          day_status: dayRecord ? (dayRecord.is_late ? 'late' : dayRecord.status as any) : null,
          existing_day_record: !!dayRecord
        };
      });

      setStudents(studentRows);
    } catch (error: any) {
      console.error('Error loading attendance grid:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoadingGrid(false);
    }
  };

  const getSessionPeriodCodes = (session: LectureSession): string[] => {
    if (!session.period_from || session.period_from === 'EXTRA') return [];

    const codes: string[] = [session.period_from];

    if (session.period_to && session.period_to !== session.period_from) {
      const fromIdx = periods.findIndex(p => p.period_code === session.period_from);
      const toIdx = periods.findIndex(p => p.period_code === session.period_to);

      if (fromIdx >= 0 && toIdx >= 0) {
        for (let i = fromIdx; i <= toIdx; i++) {
          if (!codes.includes(periods[i].period_code)) {
            codes.push(periods[i].period_code);
          }
        }
      }
    }

    return codes;
  };

  const markDayStatus = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setStudents(prev => prev.map(s =>
      s.id === studentId ? { ...s, day_status: s.day_status === status ? null : status } : s
    ));
  };

  const markAllDayPresent = () => {
    setStudents(prev => prev.map(s => ({ ...s, day_status: 'present' as const })));
  };

  const markAllDayAbsent = () => {
    setStudents(prev => prev.map(s => ({ ...s, day_status: 'absent' as const })));
  };

  const autoCalculateDayStatus = () => {
    setStudents(prev => prev.map(student => {
      const periodEntries = Object.values(student.period_attendance);
      if (periodEntries.length === 0) return { ...student, day_status: null };

      const presentCount = periodEntries.filter(p => p.status === 'present').length;
      const totalCount = periodEntries.length;
      const hasLate = periodEntries.some(p => p.is_late);

      if (presentCount === 0) return { ...student, day_status: 'absent' as const };
      if (hasLate || (presentCount < totalCount && presentCount > 0)) return { ...student, day_status: 'late' as const };
      return { ...student, day_status: 'present' as const };
    }));
  };

  const saveDayAttendance = async () => {
    const markedStudents = students.filter(s => s.day_status !== null);

    if (markedStudents.length === 0) {
      alert('Please mark at least one student\'s day attendance');
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from('attendance')
        .delete()
        .eq('class_id', selectedClass)
        .eq('date', selectedDate);

      const records = markedStudents.map(student => ({
        institution_id: user.institution_id,
        class_id: selectedClass,
        student_id: student.id,
        date: selectedDate,
        status: student.day_status === 'late' ? 'present' : student.day_status,
        is_late: student.day_status === 'late',
        marked_by: user.id,
        marked_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('attendance')
        .insert(records);

      if (error) throw error;

      alert(`Day attendance saved for ${records.length} students!`);

      setStudents(prev => prev.map(s => ({
        ...s,
        existing_day_record: s.day_status !== null
      })));
    } catch (error: any) {
      console.error('Error saving:', error);
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: students.length,
    present: students.filter(s => s.day_status === 'present' || s.day_status === 'late').length,
    absent: students.filter(s => s.day_status === 'absent').length,
    late: students.filter(s => s.day_status === 'late').length,
    unmarked: students.filter(s => s.day_status === null).length,
    lecturesTaken: sessions.length
  };

  const getPeriodCellStyle = (entry?: { status: string; is_late: boolean }) => {
    if (!entry) return 'bg-gray-50 text-gray-300';
    if (entry.is_late) return 'bg-yellow-100 text-yellow-800';
    if (entry.status === 'present') return 'bg-green-100 text-green-800';
    if (entry.status === 'absent') return 'bg-red-100 text-red-800';
    return 'bg-gray-50 text-gray-400';
  };

  const getPeriodCellText = (entry?: { status: string; is_late: boolean }) => {
    if (!entry) return '—';
    if (entry.is_late) return 'L';
    if (entry.status === 'present') return 'P';
    if (entry.status === 'absent') return 'A';
    return '—';
  };

  const periodHasSession = (periodCode: string): LectureSession | undefined => {
    return sessions.find(s => {
      if (s.session_type === 'extra') return false;
      const codes = getSessionPeriodCodes(s);
      return codes.includes(periodCode);
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  if (loading && myClasses.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (myClasses.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-6">
              <button onClick={() => router.push('/faculty/dashboard')} className="mr-4 p-2 rounded-md hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Class Teacher - Day Attendance</h1>
                <p className="mt-1 text-sm text-gray-500">View lectures and mark day attendance</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
            <div className="flex">
              <Users className="h-6 w-6 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-lg font-medium text-yellow-800">Not a Class Teacher</h3>
                <p className="mt-2 text-sm text-yellow-700">
                  You are not assigned as a class teacher for any class. Contact your administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const extraSessions = sessions.filter(s => s.session_type === 'extra');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button onClick={() => router.push('/faculty/dashboard')} className="mr-4 p-2 rounded-md hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Class Teacher - Day Attendance</h1>
                <p className="mt-1 text-sm text-gray-500">
                  View period-wise lectures and mark day attendance for your class
                </p>
              </div>
            </div>
            {students.length > 0 && (
              <button
                onClick={saveDayAttendance}
                disabled={saving || stats.unmarked === stats.total}
                className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium shadow-sm"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : 'Save Day Attendance'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">My Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base"
              >
                {myClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base"
              />
              <p className="text-sm text-gray-500 mt-1">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', {
                  weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        {students.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Students</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Lectures</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.lecturesTaken}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-green-600 uppercase font-medium">Present</p>
              <p className="text-2xl font-bold text-green-600">{stats.present}{stats.late > 0 ? <span className="text-sm text-yellow-600 ml-1">({stats.late} late)</span> : ''}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-red-600 uppercase font-medium">Absent</p>
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-400 uppercase font-medium">Unmarked</p>
              <p className="text-2xl font-bold text-gray-400">{stats.unmarked}</p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {students.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4" />
                <span>Period columns show subject teacher&apos;s attendance. Mark day status on the right.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={autoCalculateDayStatus}
                  className="inline-flex items-center px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-medium"
                  title="Auto-calculate day status from period attendance"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Auto Calculate
                </button>
                <button
                  onClick={markAllDayPresent}
                  className="inline-flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-sm font-medium"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  All Present
                </button>
                <button
                  onClick={markAllDayAbsent}
                  className="inline-flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm font-medium"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  All Absent
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        {students.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-medium text-gray-700">Legend:</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-7 h-7 rounded flex items-center justify-center bg-green-100 text-green-800 font-bold text-xs">P</span>
                Present
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-7 h-7 rounded flex items-center justify-center bg-red-100 text-red-800 font-bold text-xs">A</span>
                Absent
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-7 h-7 rounded flex items-center justify-center bg-yellow-100 text-yellow-800 font-bold text-xs">L</span>
                Late
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-7 h-7 rounded flex items-center justify-center bg-gray-50 text-gray-300 font-bold text-xs">—</span>
                No lecture
              </span>
            </div>
          </div>
        )}

        {/* Main Grid */}
        {loadingGrid ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 text-indigo-400 animate-spin" />
            <p className="mt-4 text-gray-500">Loading attendance grid...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {selectedClass ? 'No students found' : 'Select a class'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {selectedClass
                ? 'No active students in this class'
                : 'Please select your class to view the attendance grid'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  {/* Header Row 1: Subject codes above period columns */}
                  <tr className="bg-indigo-50 border-b border-indigo-200">
                    <th className="sticky left-0 z-20 bg-indigo-50 px-3 py-2" style={{ minWidth: '60px' }}></th>
                    <th className="sticky left-[60px] z-20 bg-indigo-50 px-3 py-2" style={{ minWidth: '160px' }}></th>
                    {periods.map(period => {
                      const session = periodHasSession(period.period_code);
                      return (
                        <th
                          key={`subj-${period.id}`}
                          className="px-1 py-2 text-center text-[10px] font-medium text-indigo-600 whitespace-nowrap"
                          style={{ minWidth: '44px' }}
                        >
                          {session ? session.subject_code : ''}
                        </th>
                      );
                    })}
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 bg-indigo-50" style={{ minWidth: '200px' }}>
                      Day Status
                    </th>
                  </tr>

                  {/* Header Row 2: Period codes */}
                  <tr className="bg-gray-50 border-b-2 border-gray-300">
                    <th className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase" style={{ minWidth: '60px' }}>
                      Roll
                    </th>
                    <th className="sticky left-[60px] z-20 bg-gray-50 px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase" style={{ minWidth: '160px' }}>
                      Student Name
                    </th>
                    {periods.map(period => {
                      const session = periodHasSession(period.period_code);
                      return (
                        <th
                          key={period.id}
                          className={`px-1 py-3 text-center text-xs font-bold uppercase ${
                            session ? 'text-indigo-700 bg-indigo-50/50' : 'text-gray-400'
                          }`}
                          style={{ minWidth: '44px' }}
                          title={`${period.period_name}: ${formatTime(period.time_from)} - ${formatTime(period.time_to)}${session ? ` (${session.subject_name})` : ''}`}
                        >
                          {period.period_code}
                        </th>
                      );
                    })}
                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase bg-gray-100" style={{ minWidth: '200px' }}>
                      <div className="flex items-center justify-center gap-4">
                        <span>Present</span>
                        <span>Absent</span>
                        <span>Late</span>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {students.map((student, idx) => {
                    const periodEntries = Object.values(student.period_attendance);
                    const lectureCount = periodEntries.length;
                    const presentCount = periodEntries.filter(p => p.status === 'present').length;

                    return (
                      <tr
                        key={student.id}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}
                      >
                        <td className="sticky left-0 z-10 px-3 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap"
                          style={{ minWidth: '60px', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                        >
                          {student.roll_number}
                        </td>

                        <td className="sticky left-[60px] z-10 px-3 py-2.5 text-sm text-gray-800 whitespace-nowrap"
                          style={{ minWidth: '160px', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                        >
                          {student.first_name} {student.last_name}
                          {lectureCount > 0 && (
                            <span className="ml-2 text-[10px] text-gray-400">
                              ({presentCount}/{lectureCount})
                            </span>
                          )}
                        </td>

                        {periods.map(period => {
                          const entry = student.period_attendance[period.period_code];
                          const hasSession = periodHasSession(period.period_code);
                          const tooltipKey = `${student.id}-${period.period_code}`;

                          return (
                            <td
                              key={period.id}
                              className="px-1 py-2.5 text-center"
                              style={{ minWidth: '44px' }}
                            >
                              {hasSession ? (
                                <div
                                  className="relative"
                                  onMouseEnter={() => setShowTooltip(tooltipKey)}
                                  onMouseLeave={() => setShowTooltip(null)}
                                >
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs font-bold cursor-default ${getPeriodCellStyle(entry)}`}>
                                    {getPeriodCellText(entry)}
                                  </span>

                                  {showTooltip === tooltipKey && entry && (
                                    <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
                                      <p className="font-bold">{entry.subject}</p>
                                      <p>{entry.faculty}</p>
                                      <p>{entry.status === 'present' ? (entry.is_late ? 'Late' : 'Present') : 'Absent'}</p>
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                        <div className="border-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded text-xs text-gray-200">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}

                        <td className="px-3 py-2.5 bg-gray-50/50" style={{ minWidth: '200px' }}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => markDayStatus(student.id, 'present')}
                              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                student.day_status === 'present'
                                  ? 'bg-green-600 text-white shadow-sm'
                                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                              }`}
                            >
                              P
                            </button>
                            <button
                              onClick={() => markDayStatus(student.id, 'absent')}
                              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                student.day_status === 'absent'
                                  ? 'bg-red-600 text-white shadow-sm'
                                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                              }`}
                            >
                              A
                            </button>
                            <button
                              onClick={() => markDayStatus(student.id, 'late')}
                              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                student.day_status === 'late'
                                  ? 'bg-yellow-500 text-white shadow-sm'
                                  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                              }`}
                            >
                              L
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Extra Sessions Info */}
        {extraSessions.length > 0 && (
          <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-orange-800 mb-3">Extra Lectures Today</h3>
            <div className="space-y-2">
              {extraSessions.map(session => (
                <div key={session.id} className="flex items-center gap-4 text-sm text-orange-700">
                  <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded text-xs font-bold">EXTRA</span>
                  <span className="font-medium">{session.subject_name}</span>
                  <span>by {session.faculty_name}</span>
                  {session.batch_name && <span className="text-orange-500">({session.batch_name})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
