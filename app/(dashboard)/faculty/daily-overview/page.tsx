'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Calendar, ArrowLeft, Users, CheckCircle, XCircle, Clock } from 'lucide-react';

interface LectureSession {
  id: string;
  date: string;
  period_from: string;
  period_to: string;
  time_from: string;
  time_to: string;
  session_type: string;
  batch_name: string;
  subjects: { name: string; code: string };
  faculty: { first_name: string; last_name: string; employee_id: string };
  lecture_attendance: any[];
}

export default function DailyOverviewPage() {
  const [user, setUser] = useState<any>(null);
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.faculty?.id) {
      loadMyClasses();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      loadSessions();
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

    if (!userData || userData.role !== 'faculty') {
      router.push('/login');
      return;
    }

    const { data: facultyData } = await supabase
      .from('faculty')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    setUser({ ...userData, faculty: facultyData });
  };

  const loadMyClasses = async () => {
    // Load classes where this faculty is the class teacher
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('class_teacher_id', user.faculty.id)
      .eq('is_active', true)
      .order('name');

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

  const loadSessions = async () => {
    setLoading(true);
    
    // Load all lecture sessions for this class and date
    const { data: sessionData, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select(`
        id,
        date,
        period_from,
        period_to,
        time_from,
        time_to,
        session_type,
        batch_name
      `)
      .eq('class_id', selectedClass)
      .eq('date', selectedDate)
      .order('time_from');

    if (sessionError) {
      console.error('Error loading sessions:', sessionError);
      setLoading(false);
      return;
    }

    if (!sessionData || sessionData.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    // Manually fetch related data for each session
    const enrichedSessions = await Promise.all(
      sessionData.map(async (session) => {
        // Fetch subject
        const { data: lectureData } = await supabase
          .from('lecture_sessions')
          .select('subject_id, faculty_id')
          .eq('id', session.id)
          .single();

        const { data: subject } = await supabase
          .from('subjects')
          .select('name, code')
          .eq('id', lectureData?.subject_id)
          .single();

        const { data: faculty } = await supabase
          .from('faculty')
          .select('first_name, last_name, employee_id')
          .eq('id', lectureData?.faculty_id)
          .single();

        // Fetch attendance records
        const { data: attendance } = await supabase
          .from('lecture_attendance')
          .select('status, is_late')
          .eq('lecture_session_id', session.id);

        return {
          ...session,
          subjects: subject || { name: 'Unknown', code: 'N/A' },
          faculty: faculty || { first_name: 'Unknown', last_name: '', employee_id: 'N/A' },
          lecture_attendance: attendance || []
        };
      })
    );

    setSessions(enrichedSessions);
    setLoading(false);
  };

  const calculateStats = (session: LectureSession) => {
    const total = session.lecture_attendance.length;
    const present = session.lecture_attendance.filter(a => a.status === 'present').length;
    const absent = session.lecture_attendance.filter(a => a.status === 'absent').length;
    const late = session.lecture_attendance.filter(a => a.is_late).length;

    return { total, present, absent, late };
  };

  const calculateOverallStats = () => {
    const allAttendance = sessions.flatMap(s => s.lecture_attendance);
    const total = allAttendance.length;
    const present = allAttendance.filter(a => a.status === 'present').length;
    const absent = allAttendance.filter(a => a.status === 'absent').length;
    const late = allAttendance.filter(a => a.is_late).length;

    return { total, present, absent, late };
  };

  if (loading && myClasses.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (myClasses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-6">
              <button
                onClick={() => router.push('/faculty/dashboard')}
                className="mr-4 p-2 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Daily Attendance Overview</h1>
                <p className="mt-1 text-sm text-gray-500">View all lecture sessions for your class</p>
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
                  You are not assigned as a class teacher for any class. Please contact your administrator 
                  if you believe this is an error.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const overallStats = calculateOverallStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <button
              onClick={() => router.push('/faculty/dashboard')}
              className="mr-4 p-2 rounded-md hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Daily Attendance Overview</h1>
              <p className="mt-1 text-sm text-gray-500">View all lecture sessions for your class</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">My Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
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
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-sm text-gray-500 mt-1">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
        </div>

        {/* Overall Stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Present</p>
              <p className="text-2xl font-bold text-green-600">{overallStats.present}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Absent</p>
              <p className="text-2xl font-bold text-red-600">{overallStats.absent}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Late Arrivals</p>
              <p className="text-2xl font-bold text-yellow-600">{overallStats.late}</p>
            </div>
          </div>
        )}

        {/* Sessions List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-lg text-gray-500">Loading sessions...</div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No sessions found</h3>
            <p className="mt-2 text-sm text-gray-500">
              No lecture sessions were recorded for this class on {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const stats = calculateStats(session);
              const percentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

              return (
                <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold">
                          {session.subjects.name} ({session.subjects.code})
                        </h3>
                        <p className="text-indigo-200 text-sm mt-1">
                          {session.faculty.first_name} {session.faculty.last_name} ({session.faculty.employee_id})
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{percentage}%</div>
                        <div className="text-indigo-200 text-sm">Attendance</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Period(s)</p>
                        <p className="font-medium">
                          {session.session_type === 'extra' ? (
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">EXTRA</span>
                          ) : session.period_to ? (
                            `${session.period_from}-${session.period_to}`
                          ) : (
                            session.period_from
                          )}
                          {session.batch_name && (
                            <span className="ml-2 text-xs text-gray-500">({session.batch_name})</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Time</p>
                        <p className="font-medium">{session.time_from} - {session.time_to}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Students</p>
                        <p className="font-medium text-gray-900">{stats.total}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Present</p>
                        <p className="font-medium text-green-600 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {stats.present}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Absent</p>
                        <p className="font-medium text-red-600 flex items-center">
                          <XCircle className="w-4 h-4 mr-1" />
                          {stats.absent}
                        </p>
                      </div>
                    </div>

                    {stats.late > 0 && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                        <p className="text-sm text-yellow-700 flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          <strong>{stats.late} student(s)</strong> marked as late
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
