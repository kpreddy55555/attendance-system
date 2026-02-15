'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UserRole {
  id: string;
  role: 'super_admin' | 'institution_admin' | 'faculty' | 'student' | 'parent';
  institution_id: string;
  full_name: string;
  email: string;
  // Faculty-specific
  faculty_id?: string;
  classTeacherOf?: string[]; // class IDs where this user is class teacher
  assignedSubjects?: { class_id: string; subject_id: string }[]; // faculty assignments
}

export function useUserRole() {
  const [user, setUser] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }

      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (!userData) { setLoading(false); return; }

      let instId = userData.institution_id;
      if (!instId) {
        const { data: inst } = await supabase.from('institutions').select('id').eq('is_active', true).limit(1);
        if (inst?.length) instId = inst[0].id;
      }

      const base: UserRole = {
        id: userData.id,
        role: userData.role,
        institution_id: instId,
        full_name: userData.full_name,
        email: userData.email,
      };

      // If faculty, load their class teacher assignments and faculty assignments
      if (userData.role === 'faculty') {
        try {
          const { data: faculty } = await supabase.from('faculty')
            .select('id').eq('user_id', userData.id).single();
          
          if (faculty) {
            base.faculty_id = faculty.id;

            // Classes where they are class teacher
            try {
              const { data: ctClasses } = await supabase.from('classes')
                .select('id').eq('class_teacher_id', faculty.id);
              base.classTeacherOf = (ctClasses || []).map(c => c.id);
            } catch { base.classTeacherOf = []; }

            // Faculty subject assignments (table may not exist)
            try {
              const { data: assignments } = await supabase.from('faculty_assignments')
                .select('class_id, subject_id').eq('faculty_id', faculty.id);
              base.assignedSubjects = assignments || [];
            } catch {
              // Try class_subjects as fallback
              try {
                const { data: cs } = await supabase.from('class_subjects')
                  .select('class_id, subject_id').eq('faculty_id', faculty.id);
                base.assignedSubjects = cs || [];
              } catch { base.assignedSubjects = []; }
            }
          }
        } catch { /* faculty table query failed */ }
      }

      setUser(base);
    } catch (err) {
      console.error('Error loading user role:', err);
    }
    setLoading(false);
  };

  // Helper: can this user access a specific report?
  const canAccess = (report: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'institution_admin') return true;
    
    const facultyReports: Record<string, boolean> = {
      'daily-summary': (user.classTeacherOf || []).length > 0,
      'monthly-cumulative': (user.classTeacherOf || []).length > 0,
      'low-attendance': (user.classTeacherOf || []).length > 0,
      'subject-wise': true, // Subject teachers can see their subjects
      'attendance-trends': true,
      'faculty-summary': false, // Admin only
      'division-comparison': false, // Admin only
    };

    return facultyReports[report] ?? false;
  };

  // Helper: get filtered class IDs this user can see
  const getAccessibleClasses = (allClasses: any[]): any[] => {
    if (!user) return [];
    if (user.role === 'super_admin' || user.role === 'institution_admin') return allClasses;
    
    // Class teachers see their own classes
    if (user.classTeacherOf?.length) {
      return allClasses.filter(c => user.classTeacherOf!.includes(c.id));
    }

    // Subject teachers see classes they're assigned to
    if (user.assignedSubjects?.length) {
      const classIds = new Set(user.assignedSubjects.map(a => a.class_id));
      return allClasses.filter(c => classIds.has(c.id));
    }

    return [];
  };

  return { user, loading, canAccess, getAccessibleClasses };
}
