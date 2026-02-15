export type UserRole = 'super_admin' | 'institution_admin' | 'faculty' | 'student' | 'parent';
export type InstitutionType = 'school' | 'junior_college' | 'college' | 'university';
export type SubjectType = 'core' | 'optional' | 'practical' | 'lab';
export type SessionType = 'lecture' | 'practical' | 'day';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type AttendanceMethod = 'manual' | 'biometric' | 'qr_code' | 'mobile_app';
export type SessionStatus = 'pending' | 'in_progress' | 'completed';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'sick' | 'casual' | 'emergency' | 'other';
export type NotificationType = 'absence_alert' | 'low_attendance' | 'leave_status' | 'system';

export interface Institution {
  id: string;
  name: string;
  code: string;
  type: InstitutionType;
  board?: string;
  address?: Record<string, any>;
  contact?: Record<string, any>;
  settings?: Record<string, any>;
  subscription_plan?: string;
  subscription_valid_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  institution_id?: string;
  role: UserRole;
  full_name: string;
  email?: string;
  phone?: string;
  profile_photo?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  institution_id: string;
  academic_year_id: string;
  class_id: string;
  admission_number: string;
  roll_number?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  address?: Record<string, any>;
  emergency_contact?: Record<string, any>;
  created_at: string;
  user?: User;
}

export interface AttendanceSession {
  id: string;
  institution_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id?: string;
  faculty_id?: string;
  session_date: string;
  session_type: SessionType;
  lecture_number?: number;
  start_time?: string;
  end_time?: string;
  method: AttendanceMethod;
  status: SessionStatus;
  total_students?: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string;
  marked_by?: string;
  method: AttendanceMethod;
  device_info?: Record<string, any>;
  location?: Record<string, any>;
  notes?: string;
  created_at: string;
}
