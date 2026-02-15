'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Calendar, Users, BarChart3, AlertTriangle, BookOpen, TrendingUp } from 'lucide-react';

export default function ReportsPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (!userData || !['super_admin', 'institution_admin', 'faculty'].includes(userData.role)) {
        router.push('/login'); return;
      }

      // For faculty, load their class teacher and subject assignments
      let isClassTeacher = false;
      let hasSubjects = false;
      if (userData.role === 'faculty') {
        try {
          const { data: faculty } = await supabase.from('faculty').select('id').eq('user_id', userData.id).single();
          if (faculty) {
            const { data: ct } = await supabase.from('classes').select('id').eq('class_teacher_id', faculty.id);
            isClassTeacher = (ct || []).length > 0;
            // Try faculty_assignments first, fall back to class_subjects
            try {
              const { data: fa } = await supabase.from('faculty_assignments').select('id').eq('faculty_id', faculty.id);
              hasSubjects = (fa || []).length > 0;
            } catch (e) {
              try {
                const { data: cs } = await supabase.from('class_subjects').select('id').eq('faculty_id', faculty.id);
                hasSubjects = (cs || []).length > 0;
              } catch (e) { hasSubjects = false; }
            }
          }
        } catch (e) { /* faculty table might not have expected columns */ }
      }
      setUser({ ...userData, isClassTeacher, hasSubjects });
    };
    loadUser();
  }, []);

  const isAdmin = user?.role === 'super_admin' || user?.role === 'institution_admin';
  const isCT = user?.isClassTeacher;
  const hasSubs = user?.hasSubjects;

  const reports = [
    {
      title: 'Monthly Cumulative Attendance',
      description: 'Day-wise attendance for all students with monthly and cumulative stats. Shows P/A/H/S for each day.',
      icon: Calendar,
      color: 'bg-indigo-100 text-indigo-700',
      link: '/super-admin/reports/monthly-cumulative',
      badge: 'Key Report',
      badgeColor: 'bg-red-100 text-red-700',
      access: isAdmin || isCT,
    },
    {
      title: 'Daily Attendance Summary',
      description: 'Present/Absent count for a specific date across all classes with percentage breakdown.',
      icon: FileText,
      color: 'bg-green-100 text-green-700',
      link: '/super-admin/reports/daily-summary',
      badge: 'Active',
      badgeColor: 'bg-green-100 text-green-700',
      access: isAdmin || isCT,
    },
    {
      title: 'Subject-wise Lecture Report',
      description: 'Attendance per subject per faculty — how many lectures taken, student-wise attendance per subject.',
      icon: BookOpen,
      color: 'bg-purple-100 text-purple-700',
      link: '/super-admin/reports/subject-wise',
      badge: 'Active',
      badgeColor: 'bg-purple-100 text-purple-700',
      access: isAdmin || isCT || hasSubs,
    },
    {
      title: 'Low Attendance Alert',
      description: 'Students below 75% attendance threshold. Useful for notices and parent communication.',
      icon: AlertTriangle,
      color: 'bg-red-100 text-red-700',
      link: '/super-admin/reports/low-attendance',
      badge: 'Critical',
      badgeColor: 'bg-red-100 text-red-700',
      access: isAdmin || isCT,
    },
    {
      title: 'Faculty Lecture Summary',
      description: 'Lectures conducted by each faculty — total periods, subjects, classes covered per month.',
      icon: Users,
      color: 'bg-blue-100 text-blue-700',
      link: '/super-admin/reports/faculty-summary',
      badge: 'Active',
      badgeColor: 'bg-blue-100 text-blue-700',
      access: isAdmin,
    },
    {
      title: 'Division Comparison',
      description: 'Compare attendance percentages across divisions (A, B, C) for the same standard.',
      icon: BarChart3,
      color: 'bg-orange-100 text-orange-700',
      link: '/super-admin/reports/division-comparison',
      badge: 'New',
      badgeColor: 'bg-orange-100 text-orange-700',
      access: isAdmin,
    },
    {
      title: 'Attendance Trends',
      description: 'Monthly attendance trends with charts — line graph showing attendance % over months.',
      icon: TrendingUp,
      color: 'bg-teal-100 text-teal-700',
      link: '/super-admin/reports/attendance-trends',
      badge: 'New',
      badgeColor: 'bg-teal-100 text-teal-700',
      access: isAdmin || isCT || hasSubs,
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <button onClick={() => router.push(isAdmin ? '/super-admin' : '/faculty/dashboard')} className="mr-4 p-2 rounded-md hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
              <p className="mt-1 text-sm text-gray-500">Generate attendance reports for your institution</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-700">
            📋 <strong>Faculty View:</strong> You can access reports for {isCT ? 'your class teacher classes' : 'your assigned subjects'}. Locked reports (🔒) require admin access.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, idx) => {
            const Icon = report.icon;
            const isActive = report.badge !== 'Coming Soon' && report.access;
            return (
              <button
                key={idx}
                onClick={() => isActive ? router.push(report.link) : null}
                disabled={!isActive}
                className={`text-left bg-white rounded-xl shadow-sm border-2 p-6 transition-all ${
                  isActive
                    ? 'border-transparent hover:shadow-lg hover:border-indigo-200 cursor-pointer'
                    : 'border-transparent opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${report.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex gap-1">
                    {!report.access && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">🔒 Admin</span>}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${report.badgeColor}`}>
                      {report.badge}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{report.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{report.description}</p>
              </button>
            );
          })}
        </div>

        {/* Recommended Reports Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-800 mb-3">Recommended Reports for Your Institution</h3>
          <div className="space-y-3 text-sm text-blue-700">
            <p><span className="font-bold">1. Monthly Cumulative Attendance</span> — The most important report. Matches your existing format from sppspay.net. Shows day-wise P/A/H/S grid with cumulative stats.</p>
            <p><span className="font-bold">2. Low Attendance Alert</span> — Auto-identify students below 75% attendance for notices and parent meetings. Critical for compliance.</p>
            <p><span className="font-bold">3. Subject-wise Lecture Report</span> — Track individual subject attendance separately. Important for practical/lab subjects with batch-wise tracking.</p>
            <p><span className="font-bold">4. Faculty Lecture Summary</span> — Monitor how many lectures each faculty has conducted. Useful for workload analysis and payroll.</p>
            <p><span className="font-bold">5. Division Comparison</span> — Compare performance across divisions. Helps identify which classes need attention.</p>
            <p><span className="font-bold">6. Attendance Trends</span> — Monthly trends with charts. Great for management presentations and board meetings.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
